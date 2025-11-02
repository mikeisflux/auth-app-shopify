// Wholesale Portal Model - handles wholesale functionality
import { query } from '../db/connection.server.js';

export const WholesaleModel = {
  // ============================================================================
  // PRICING RULES
  // ============================================================================

  async getPricingRules(shopDomain, filters = {}) {
    let whereClause = 'WHERE s.shop_domain = $1';
    const params = [shopDomain];
    let paramIndex = 2;

    if (filters.status) {
      whereClause += ` AND pr.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.ruleType) {
      whereClause += ` AND pr.rule_type = $${paramIndex}`;
      params.push(filters.ruleType);
      paramIndex++;
    }

    const result = await query(
      `SELECT pr.*,
              COUNT(DISTINCT vpt.id) as tier_count
       FROM pricing_rules pr
       INNER JOIN shops s ON pr.shop_id = s.id
       LEFT JOIN volume_pricing_tiers vpt ON pr.id = vpt.pricing_rule_id
       ${whereClause}
       GROUP BY pr.id
       ORDER BY pr.created_at DESC`,
      params
    );

    return result.rows;
  },

  async getPricingRuleById(ruleId, shopDomain) {
    const result = await query(
      `SELECT pr.*
       FROM pricing_rules pr
       INNER JOIN shops s ON pr.shop_id = s.id
       WHERE pr.id = $1 AND s.shop_domain = $2`,
      [ruleId, shopDomain]
    );

    if (result.rows.length === 0) return null;

    // Get volume tiers if it's a volume pricing rule
    const tiersResult = await query(
      `SELECT * FROM volume_pricing_tiers
       WHERE pricing_rule_id = $1
       ORDER BY quantity ASC`,
      [ruleId]
    );

    return {
      ...result.rows[0],
      tiers: tiersResult.rows
    };
  },

  async createPricingRule(shopDomain, ruleData) {
    const {
      name,
      ruleType,
      status,
      discountType,
      discountValue,
      customerSelection,
      customerTags,
      productScope,
      productIds,
      collectionIds,
      excludedProductIds,
      excludedCollectionIds,
      startDate,
      endDate,
      tiers
    } = ruleData;

    // Insert pricing rule
    const result = await query(
      `INSERT INTO pricing_rules (
        shop_id, name, rule_type, status, discount_type, discount_value,
        customer_selection, customer_tags, product_scope, product_ids,
        collection_ids, excluded_product_ids, excluded_collection_ids,
        start_date, end_date
      )
       SELECT s.id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
       FROM shops s
       WHERE s.shop_domain = $1
       RETURNING *`,
      [
        shopDomain, name, ruleType, status || 'unpublished', discountType, discountValue,
        customerSelection || 'tagged', JSON.stringify(customerTags || []),
        productScope || 'all', JSON.stringify(productIds || []),
        JSON.stringify(collectionIds || []), JSON.stringify(excludedProductIds || []),
        JSON.stringify(excludedCollectionIds || []), startDate, endDate
      ]
    );

    const rule = result.rows[0];

    // Insert volume tiers if provided
    if (tiers && tiers.length > 0 && ruleType === 'volume') {
      for (const tier of tiers) {
        await query(
          `INSERT INTO volume_pricing_tiers (
            pricing_rule_id, quantity, discount_type, discount_value,
            tier_application, sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            rule.id, tier.quantity, tier.discountType || discountType,
            tier.discountValue, tier.tierApplication || 'per_variant',
            tier.sortOrder || 0
          ]
        );
      }
    }

    return await this.getPricingRuleById(rule.id, shopDomain);
  },

  async updatePricingRule(ruleId, shopDomain, ruleData) {
    const {
      name, status, discountType, discountValue, customerSelection,
      customerTags, productScope, productIds, collectionIds,
      excludedProductIds, excludedCollectionIds, startDate, endDate
    } = ruleData;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (discountType !== undefined) {
      updates.push(`discount_type = $${paramIndex++}`);
      values.push(discountType);
    }
    if (discountValue !== undefined) {
      updates.push(`discount_value = $${paramIndex++}`);
      values.push(discountValue);
    }
    if (customerSelection !== undefined) {
      updates.push(`customer_selection = $${paramIndex++}`);
      values.push(customerSelection);
    }
    if (customerTags !== undefined) {
      updates.push(`customer_tags = $${paramIndex++}`);
      values.push(JSON.stringify(customerTags));
    }
    if (productScope !== undefined) {
      updates.push(`product_scope = $${paramIndex++}`);
      values.push(productScope);
    }
    if (productIds !== undefined) {
      updates.push(`product_ids = $${paramIndex++}`);
      values.push(JSON.stringify(productIds));
    }
    if (collectionIds !== undefined) {
      updates.push(`collection_ids = $${paramIndex++}`);
      values.push(JSON.stringify(collectionIds));
    }
    if (excludedProductIds !== undefined) {
      updates.push(`excluded_product_ids = $${paramIndex++}`);
      values.push(JSON.stringify(excludedProductIds));
    }
    if (excludedCollectionIds !== undefined) {
      updates.push(`excluded_collection_ids = $${paramIndex++}`);
      values.push(JSON.stringify(excludedCollectionIds));
    }
    if (startDate !== undefined) {
      updates.push(`start_date = $${paramIndex++}`);
      values.push(startDate);
    }
    if (endDate !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      values.push(endDate);
    }

    if (updates.length === 0) return null;

    values.push(ruleId, shopDomain);

    const result = await query(
      `UPDATE pricing_rules pr
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       FROM shops s
       WHERE pr.id = $${paramIndex++}
         AND pr.shop_id = s.id
         AND s.shop_domain = $${paramIndex++}
       RETURNING pr.*`,
      values
    );

    if (result.rows.length === 0) return null;

    return await this.getPricingRuleById(ruleId, shopDomain);
  },

  async deletePricingRule(ruleId, shopDomain) {
    const result = await query(
      `DELETE FROM pricing_rules pr
       USING shops s
       WHERE pr.id = $1
         AND pr.shop_id = s.id
         AND s.shop_domain = $2
       RETURNING pr.*`,
      [ruleId, shopDomain]
    );

    return result.rows[0] || null;
  },

  // ============================================================================
  // WHOLESALE CUSTOMERS
  // ============================================================================

  async getWholesaleCustomers(shopDomain, filters = {}) {
    let whereClause = 'WHERE s.shop_domain = $1';
    const params = [shopDomain];
    let paramIndex = 2;

    if (filters.approved !== undefined) {
      whereClause += ` AND wc.wholesale_approved = $${paramIndex}`;
      params.push(filters.approved);
      paramIndex++;
    }

    if (filters.search) {
      whereClause += ` AND (wc.email ILIKE $${paramIndex} OR wc.notes ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const result = await query(
      `SELECT wc.*
       FROM wholesale_customers wc
       INNER JOIN shops s ON wc.shop_id = s.id
       ${whereClause}
       ORDER BY wc.created_at DESC
       LIMIT ${filters.limit || 100}
       OFFSET ${filters.offset || 0}`,
      params
    );

    return result.rows;
  },

  async getWholesaleCustomerById(customerId, shopDomain) {
    const result = await query(
      `SELECT wc.*
       FROM wholesale_customers wc
       INNER JOIN shops s ON wc.shop_id = s.id
       WHERE wc.id = $1 AND s.shop_domain = $2`,
      [customerId, shopDomain]
    );

    return result.rows[0] || null;
  },

  async getWholesaleCustomerByShopifyId(shopifyCustomerId, shopDomain) {
    const result = await query(
      `SELECT wc.*
       FROM wholesale_customers wc
       INNER JOIN shops s ON wc.shop_id = s.id
       WHERE wc.shopify_customer_id = $1 AND s.shop_domain = $2`,
      [shopifyCustomerId, shopDomain]
    );

    return result.rows[0] || null;
  },

  async createWholesaleCustomer(shopDomain, customerData) {
    const {
      shopifyCustomerId, email, wholesaleApproved, approvedBy,
      customerTags, notes
    } = customerData;

    const result = await query(
      `INSERT INTO wholesale_customers (
        shop_id, shopify_customer_id, email, wholesale_approved,
        approval_date, approved_by, customer_tags, notes
      )
       SELECT s.id, $2, $3, $4, $5, $6, $7, $8
       FROM shops s
       WHERE s.shop_domain = $1
       RETURNING *`,
      [
        shopDomain, shopifyCustomerId, email, wholesaleApproved || false,
        wholesaleApproved ? new Date() : null, approvedBy,
        JSON.stringify(customerTags || []), notes
      ]
    );

    return result.rows[0];
  },

  async updateWholesaleCustomer(customerId, shopDomain, customerData) {
    const {
      wholesaleApproved, approvedBy, customerTags, orderCount,
      totalSpent, notes
    } = customerData;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (wholesaleApproved !== undefined) {
      updates.push(`wholesale_approved = $${paramIndex++}`);
      values.push(wholesaleApproved);
      if (wholesaleApproved) {
        updates.push(`approval_date = CURRENT_TIMESTAMP`);
      }
    }
    if (approvedBy !== undefined) {
      updates.push(`approved_by = $${paramIndex++}`);
      values.push(approvedBy);
    }
    if (customerTags !== undefined) {
      updates.push(`customer_tags = $${paramIndex++}`);
      values.push(JSON.stringify(customerTags));
    }
    if (orderCount !== undefined) {
      updates.push(`order_count = $${paramIndex++}`);
      values.push(orderCount);
    }
    if (totalSpent !== undefined) {
      updates.push(`total_spent = $${paramIndex++}`);
      values.push(totalSpent);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }

    if (updates.length === 0) return null;

    values.push(customerId, shopDomain);

    const result = await query(
      `UPDATE wholesale_customers wc
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       FROM shops s
       WHERE wc.id = $${paramIndex++}
         AND wc.shop_id = s.id
         AND s.shop_domain = $${paramIndex++}
       RETURNING wc.*`,
      values
    );

    return result.rows[0] || null;
  },

  async deleteWholesaleCustomer(customerId, shopDomain) {
    const result = await query(
      `DELETE FROM wholesale_customers wc
       USING shops s
       WHERE wc.id = $1
         AND wc.shop_id = s.id
         AND s.shop_domain = $2
       RETURNING wc.*`,
      [customerId, shopDomain]
    );

    return result.rows[0] || null;
  },

  // ============================================================================
  // SHIPPING RULES
  // ============================================================================

  async getShippingRules(shopDomain, filters = {}) {
    let whereClause = 'WHERE s.shop_domain = $1';
    const params = [shopDomain];
    let paramIndex = 2;

    if (filters.status) {
      whereClause += ` AND sr.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    const result = await query(
      `SELECT sr.*
       FROM shipping_rules sr
       INNER JOIN shops s ON sr.shop_id = s.id
       ${whereClause}
       ORDER BY sr.created_at DESC`,
      params
    );

    return result.rows;
  },

  async getShippingRuleById(ruleId, shopDomain) {
    const result = await query(
      `SELECT sr.*
       FROM shipping_rules sr
       INNER JOIN shops s ON sr.shop_id = s.id
       WHERE sr.id = $1 AND s.shop_domain = $2`,
      [ruleId, shopDomain]
    );

    return result.rows[0] || null;
  },

  async createShippingRule(shopDomain, ruleData) {
    const {
      title, message, status, customerSelection, customerTags,
      geographicScope, countryCodes, rateType, rateCalculationBasis,
      shippingCharge, minimumThreshold, maximumThreshold
    } = ruleData;

    const result = await query(
      `INSERT INTO shipping_rules (
        shop_id, title, message, status, customer_selection, customer_tags,
        geographic_scope, country_codes, rate_type, rate_calculation_basis,
        shipping_charge, minimum_threshold, maximum_threshold
      )
       SELECT s.id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
       FROM shops s
       WHERE s.shop_domain = $1
       RETURNING *`,
      [
        shopDomain, title, message, status || 'active', customerSelection || 'tagged',
        JSON.stringify(customerTags || []), geographicScope || 'all_countries',
        JSON.stringify(countryCodes || []), rateType || 'flat',
        rateCalculationBasis || 'amount', shippingCharge || 0,
        minimumThreshold || 0, maximumThreshold
      ]
    );

    return result.rows[0];
  },

  async updateShippingRule(ruleId, shopDomain, ruleData) {
    const {
      title, message, status, customerSelection, customerTags,
      geographicScope, countryCodes, rateType, rateCalculationBasis,
      shippingCharge, minimumThreshold, maximumThreshold
    } = ruleData;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (message !== undefined) {
      updates.push(`message = $${paramIndex++}`);
      values.push(message);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (customerSelection !== undefined) {
      updates.push(`customer_selection = $${paramIndex++}`);
      values.push(customerSelection);
    }
    if (customerTags !== undefined) {
      updates.push(`customer_tags = $${paramIndex++}`);
      values.push(JSON.stringify(customerTags));
    }
    if (geographicScope !== undefined) {
      updates.push(`geographic_scope = $${paramIndex++}`);
      values.push(geographicScope);
    }
    if (countryCodes !== undefined) {
      updates.push(`country_codes = $${paramIndex++}`);
      values.push(JSON.stringify(countryCodes));
    }
    if (rateType !== undefined) {
      updates.push(`rate_type = $${paramIndex++}`);
      values.push(rateType);
    }
    if (rateCalculationBasis !== undefined) {
      updates.push(`rate_calculation_basis = $${paramIndex++}`);
      values.push(rateCalculationBasis);
    }
    if (shippingCharge !== undefined) {
      updates.push(`shipping_charge = $${paramIndex++}`);
      values.push(shippingCharge);
    }
    if (minimumThreshold !== undefined) {
      updates.push(`minimum_threshold = $${paramIndex++}`);
      values.push(minimumThreshold);
    }
    if (maximumThreshold !== undefined) {
      updates.push(`maximum_threshold = $${paramIndex++}`);
      values.push(maximumThreshold);
    }

    if (updates.length === 0) return null;

    values.push(ruleId, shopDomain);

    const result = await query(
      `UPDATE shipping_rules sr
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       FROM shops s
       WHERE sr.id = $${paramIndex++}
         AND sr.shop_id = s.id
         AND s.shop_domain = $${paramIndex++}
       RETURNING sr.*`,
      values
    );

    return result.rows[0] || null;
  },

  async deleteShippingRule(ruleId, shopDomain) {
    const result = await query(
      `DELETE FROM shipping_rules sr
       USING shops s
       WHERE sr.id = $1
         AND sr.shop_id = s.id
         AND s.shop_domain = $2
       RETURNING sr.*`,
      [ruleId, shopDomain]
    );

    return result.rows[0] || null;
  },

  // ============================================================================
  // SETTINGS
  // ============================================================================

  async getSettings(shopDomain) {
    const result = await query(
      `SELECT ws.*
       FROM wholesale_settings ws
       INNER JOIN shops s ON ws.shop_id = s.id
       WHERE s.shop_domain = $1`,
      [shopDomain]
    );

    return result.rows[0] || null;
  },

  async updateSettings(shopDomain, settings) {
    // First try to update
    const result = await query(
      `UPDATE wholesale_settings ws
       SET show_crossed_prices = COALESCE($2, show_crossed_prices),
           compare_at_as_crossed = COALESCE($3, compare_at_as_crossed),
           coupon_field_mode = COALESCE($4, coupon_field_mode),
           prevent_shopify_auto_discounts = COALESCE($5, prevent_shopify_auto_discounts),
           checkout_method = COALESCE($6, checkout_method),
           app_mode = COALESCE($7, app_mode),
           updated_at = CURRENT_TIMESTAMP
       FROM shops s
       WHERE ws.shop_id = s.id AND s.shop_domain = $1
       RETURNING ws.*`,
      [
        shopDomain,
        settings.showCrossedPrices,
        settings.compareAtAsCrossed,
        settings.couponFieldMode,
        settings.preventShopifyAutoDiscounts,
        settings.checkoutMethod,
        settings.appMode
      ]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // If no rows updated, insert new settings
    const insertResult = await query(
      `INSERT INTO wholesale_settings (shop_id)
       SELECT id FROM shops WHERE shop_domain = $1
       RETURNING *`,
      [shopDomain]
    );

    return insertResult.rows[0];
  },

  // ============================================================================
  // ORDER LIMITS
  // ============================================================================

  async getOrderLimits(shopDomain, filters = {}) {
    let whereClause = 'WHERE s.shop_domain = $1';
    const params = [shopDomain];
    let paramIndex = 2;

    if (filters.status) {
      whereClause += ` AND olr.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    const result = await query(
      `SELECT olr.*,
              COUNT(DISTINCT olc.id) as condition_count
       FROM order_limit_rules olr
       INNER JOIN shops s ON olr.shop_id = s.id
       LEFT JOIN order_limit_conditions olc ON olr.id = olc.order_limit_rule_id
       ${whereClause}
       GROUP BY olr.id
       ORDER BY olr.created_at DESC`,
      params
    );

    return result.rows;
  },

  async getOrderLimitById(limitId, shopDomain) {
    const result = await query(
      `SELECT olr.*
       FROM order_limit_rules olr
       INNER JOIN shops s ON olr.shop_id = s.id
       WHERE olr.id = $1 AND s.shop_domain = $2`,
      [limitId, shopDomain]
    );

    if (result.rows.length === 0) return null;

    // Get conditions
    const conditionsResult = await query(
      `SELECT * FROM order_limit_conditions
       WHERE order_limit_rule_id = $1
       ORDER BY sort_order ASC`,
      [limitId]
    );

    return {
      ...result.rows[0],
      conditions: conditionsResult.rows
    };
  },

  async createOrderLimit(shopDomain, limitData) {
    const {
      name, status, scope, conditionLogic, failureAction,
      customerMessage, customerTags, conditions
    } = limitData;

    const result = await query(
      `INSERT INTO order_limit_rules (
        shop_id, name, status, scope, condition_logic,
        failure_action, customer_message, customer_tags
      )
       SELECT s.id, $2, $3, $4, $5, $6, $7, $8
       FROM shops s
       WHERE s.shop_domain = $1
       RETURNING *`,
      [
        shopDomain, name, status || 'active', scope || 'all_orders',
        conditionLogic || 'all', failureAction || 'block',
        customerMessage, JSON.stringify(customerTags || [])
      ]
    );

    const limit = result.rows[0];

    // Insert conditions
    if (conditions && conditions.length > 0) {
      for (let i = 0; i < conditions.length; i++) {
        const cond = conditions[i];
        await query(
          `INSERT INTO order_limit_conditions (
            order_limit_rule_id, condition_field, condition_operator,
            condition_value, condition_value_max, sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            limit.id, cond.field, cond.operator,
            parseFloat(cond.value), cond.value_max ? parseFloat(cond.value_max) : null,
            i
          ]
        );
      }
    }

    return await this.getOrderLimitById(limit.id, shopDomain);
  },

  async updateOrderLimit(limitId, shopDomain, limitData) {
    const {
      name, status, scope, conditionLogic, failureAction,
      customerMessage, customerTags
    } = limitData;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (scope !== undefined) {
      updates.push(`scope = $${paramIndex++}`);
      values.push(scope);
    }
    if (conditionLogic !== undefined) {
      updates.push(`condition_logic = $${paramIndex++}`);
      values.push(conditionLogic);
    }
    if (failureAction !== undefined) {
      updates.push(`failure_action = $${paramIndex++}`);
      values.push(failureAction);
    }
    if (customerMessage !== undefined) {
      updates.push(`customer_message = $${paramIndex++}`);
      values.push(customerMessage);
    }
    if (customerTags !== undefined) {
      updates.push(`customer_tags = $${paramIndex++}`);
      values.push(JSON.stringify(customerTags));
    }

    if (updates.length === 0) return null;

    values.push(limitId, shopDomain);

    const result = await query(
      `UPDATE order_limit_rules olr
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       FROM shops s
       WHERE olr.id = $${paramIndex++}
         AND olr.shop_id = s.id
         AND s.shop_domain = $${paramIndex++}
       RETURNING olr.*`,
      values
    );

    if (result.rows.length === 0) return null;

    return await this.getOrderLimitById(limitId, shopDomain);
  },

  async deleteOrderLimit(limitId, shopDomain) {
    const result = await query(
      `DELETE FROM order_limit_rules olr
       USING shops s
       WHERE olr.id = $1
         AND olr.shop_id = s.id
         AND s.shop_domain = $2
       RETURNING olr.*`,
      [limitId, shopDomain]
    );

    return result.rows[0] || null;
  },

  // ============================================================================
  // STATISTICS
  // ============================================================================

  async getStatistics(shopDomain) {
    const result = await query(
      `SELECT
         (SELECT COUNT(*) FROM pricing_rules pr
          INNER JOIN shops s ON pr.shop_id = s.id
          WHERE s.shop_domain = $1 AND pr.status = 'published') as active_pricing_rules,
         (SELECT COUNT(*) FROM wholesale_customers wc
          INNER JOIN shops s ON wc.shop_id = s.id
          WHERE s.shop_domain = $1) as total_customers,
         (SELECT COUNT(*) FROM wholesale_customers wc
          INNER JOIN shops s ON wc.shop_id = s.id
          WHERE s.shop_domain = $1 AND wc.wholesale_approved = true) as approved_customers,
         (SELECT COUNT(*) FROM shipping_rules sr
          INNER JOIN shops s ON sr.shop_id = s.id
          WHERE s.shop_domain = $1 AND sr.status = 'active') as active_shipping_rules,
         (SELECT COALESCE(SUM(wc.order_count), 0) FROM wholesale_customers wc
          INNER JOIN shops s ON wc.shop_id = s.id
          WHERE s.shop_domain = $1) as total_orders,
         (SELECT COALESCE(SUM(wc.total_spent), 0) FROM wholesale_customers wc
          INNER JOIN shops s ON wc.shop_id = s.id
          WHERE s.shop_domain = $1) as total_revenue`,
      [shopDomain]
    );

    return result.rows[0] || {
      active_pricing_rules: 0,
      total_customers: 0,
      approved_customers: 0,
      active_shipping_rules: 0,
      total_orders: 0,
      total_revenue: 0
    };
  }
};
