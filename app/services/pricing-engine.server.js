// Wholesale Pricing Calculation Engine
import { WholesaleModel } from "../models/wholesale.server";

export const PricingEngine = {
  /**
   * Calculate wholesale price for a product variant
   * @param {Object} params - Calculation parameters
   * @param {string} params.shopDomain - Shop domain
   * @param {number} params.retailPrice - Original retail price
   * @param {number} params.productId - Shopify product ID
   * @param {number} params.variantId - Shopify variant ID
   * @param {string[]} params.customerTags - Customer tags
   * @param {number} params.quantity - Quantity being purchased
   * @param {string[]} params.collectionIds - Product's collection IDs
   * @returns {Object} Pricing result
   */
  async calculatePrice({
    shopDomain,
    retailPrice,
    productId,
    variantId,
    customerTags = [],
    quantity = 1,
    collectionIds = []
  }) {
    try {
      // Get all active pricing rules for the shop
      const rules = await WholesaleModel.getPricingRules(shopDomain, {
        status: 'published'
      });

      // Filter rules applicable to this customer and product
      const applicableRules = this._filterApplicableRules(
        rules,
        customerTags,
        productId,
        collectionIds
      );

      if (applicableRules.length === 0) {
        return {
          originalPrice: retailPrice,
          finalPrice: retailPrice,
          discount: 0,
          discountPercentage: 0,
          rulesApplied: []
        };
      }

      // Apply rules based on priority
      let bestPrice = retailPrice;
      let bestRule = null;

      for (const rule of applicableRules) {
        let calculatedPrice;

        if (rule.rule_type === 'volume') {
          // Handle volume pricing
          const ruleWithTiers = await WholesaleModel.getPricingRuleById(
            rule.id,
            shopDomain
          );
          calculatedPrice = this._applyVolumePricing(
            retailPrice,
            quantity,
            ruleWithTiers.tiers
          );
        } else {
          // Handle standard wholesale or individual pricing
          calculatedPrice = this._calculateDiscount(
            retailPrice,
            rule.discount_type,
            rule.discount_value
          );
        }

        // Keep the best (lowest) price
        if (calculatedPrice < bestPrice) {
          bestPrice = calculatedPrice;
          bestRule = rule;
        }
      }

      const discount = retailPrice - bestPrice;
      const discountPercentage = ((discount / retailPrice) * 100).toFixed(2);

      return {
        originalPrice: retailPrice,
        finalPrice: bestPrice,
        discount: discount,
        discountPercentage: parseFloat(discountPercentage),
        rulesApplied: bestRule ? [bestRule] : []
      };
    } catch (error) {
      console.error('Pricing calculation error:', error);
      // Return retail price on error
      return {
        originalPrice: retailPrice,
        finalPrice: retailPrice,
        discount: 0,
        discountPercentage: 0,
        rulesApplied: [],
        error: error.message
      };
    }
  },

  /**
   * Filter rules that apply to the current customer and product
   */
  _filterApplicableRules(rules, customerTags, productId, collectionIds) {
    return rules.filter(rule => {
      // Check if rule is within date range
      if (rule.start_date && new Date(rule.start_date) > new Date()) {
        return false;
      }
      if (rule.end_date && new Date(rule.end_date) < new Date()) {
        return false;
      }

      // Check customer eligibility
      if (rule.customer_selection === 'all_customers') {
        // All customers eligible
      } else if (rule.customer_selection === 'all_logged_in') {
        // Must be logged in (caller should verify)
      } else if (rule.customer_selection === 'tagged') {
        // Check if customer has matching tags
        const ruleTags = JSON.parse(rule.customer_tags || '[]');
        const hasMatchingTag = customerTags.some(tag =>
          ruleTags.includes(tag)
        );
        if (!hasMatchingTag) {
          return false;
        }
      }

      // Check product scope
      if (rule.product_scope === 'all') {
        // Check excludes
        const excludedProducts = JSON.parse(rule.excluded_product_ids || '[]');
        const excludedCollections = JSON.parse(rule.excluded_collection_ids || '[]');

        if (excludedProducts.includes(productId.toString())) {
          return false;
        }

        if (excludedCollections.some(colId =>
          collectionIds.includes(colId.toString())
        )) {
          return false;
        }
      } else if (rule.product_scope === 'collections') {
        const ruleCollections = JSON.parse(rule.collection_ids || '[]');
        const inCollection = collectionIds.some(colId =>
          ruleCollections.includes(colId.toString())
        );
        if (!inCollection) {
          return false;
        }
      } else if (rule.product_scope === 'specific') {
        const ruleProducts = JSON.parse(rule.product_ids || '[]');
        if (!ruleProducts.includes(productId.toString())) {
          return false;
        }
      }

      return true;
    });
  },

  /**
   * Calculate discounted price based on discount type
   */
  _calculateDiscount(retailPrice, discountType, discountValue) {
    switch (discountType) {
      case 'percentage':
        return retailPrice * (1 - (discountValue / 100));

      case 'fixed_amount':
        return Math.max(0, retailPrice - discountValue);

      case 'fixed_price':
        return discountValue;

      default:
        return retailPrice;
    }
  },

  /**
   * Apply volume pricing tiers
   */
  _applyVolumePricing(retailPrice, quantity, tiers) {
    if (!tiers || tiers.length === 0) {
      return retailPrice;
    }

    // Sort tiers by quantity descending
    const sortedTiers = [...tiers].sort((a, b) => b.quantity - a.quantity);

    // Find the first tier that the quantity meets
    const applicableTier = sortedTiers.find(tier => quantity >= tier.quantity);

    if (!applicableTier) {
      return retailPrice;
    }

    return this._calculateDiscount(
      retailPrice,
      applicableTier.discount_type,
      applicableTier.discount_value
    );
  },

  /**
   * Calculate cart-level pricing with all items
   */
  async calculateCartPricing(shopDomain, cartItems, customerTags = []) {
    const results = await Promise.all(
      cartItems.map(item =>
        this.calculatePrice({
          shopDomain,
          retailPrice: item.price,
          productId: item.product_id,
          variantId: item.variant_id,
          customerTags,
          quantity: item.quantity,
          collectionIds: item.collection_ids || []
        })
      )
    );

    const subtotal = results.reduce((sum, result) =>
      sum + (result.finalPrice * results[results.indexOf(result)].quantity), 0
    );

    const totalDiscount = results.reduce((sum, result) =>
      sum + result.discount, 0
    );

    return {
      items: results.map((result, index) => ({
        ...cartItems[index],
        ...result
      })),
      subtotal,
      totalDiscount,
      originalSubtotal: cartItems.reduce((sum, item) =>
        sum + (item.price * item.quantity), 0
      )
    };
  },

  /**
   * Validate order against order limits
   */
  async validateOrderLimits({
    shopDomain,
    customerTags = [],
    cartTotal,
    cartItems,
    cartWeight,
    isFirstOrder = false
  }) {
    const limits = await WholesaleModel.getOrderLimits(shopDomain, {
      status: 'active'
    });

    const applicableLimits = limits.filter(limit => {
      // Check customer tags
      const limitTags = JSON.parse(limit.customer_tags || '[]');
      if (limitTags.length > 0) {
        const hasMatchingTag = customerTags.some(tag => limitTags.includes(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }

      // Check scope
      if (limit.scope === 'first_only' && !isFirstOrder) {
        return false;
      }

      return true;
    });

    const violations = [];

    for (const limit of applicableLimits) {
      const limitWithConditions = await WholesaleModel.getOrderLimitById(
        limit.id,
        shopDomain
      );

      const conditionResults = limitWithConditions.conditions.map(condition => {
        let value;
        switch (condition.condition_field) {
          case 'cart_total_amount':
            value = cartTotal;
            break;
          case 'cart_total_items':
            value = cartItems;
            break;
          case 'cart_total_weight':
            value = cartWeight;
            break;
          default:
            return false;
        }

        switch (condition.condition_operator) {
          case 'is_minimum':
            return value >= condition.condition_value;
          case 'is_maximum':
            return value <= condition.condition_value;
          case 'equals':
            return value === condition.condition_value;
          case 'between':
            return value >= condition.condition_value &&
                   value <= condition.condition_value_max;
          default:
            return false;
        }
      });

      // Check if limit is violated
      const passed = limit.condition_logic === 'all'
        ? conditionResults.every(r => r === true)
        : conditionResults.some(r => r === true);

      if (!passed) {
        violations.push({
          limitId: limit.id,
          limitName: limit.name,
          message: limit.customer_message,
          action: limit.failure_action
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      shouldBlock: violations.some(v => v.action === 'block')
    };
  }
};
