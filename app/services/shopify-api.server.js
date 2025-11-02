// Shopify API Integration Service
import { authenticate } from "../shopify.server";

export const ShopifyAPIService = {
  /**
   * Get customer by ID with tags
   */
  async getCustomer(admin, customerId) {
    try {
      const response = await admin.rest.resources.Customer.find({
        session: admin.session,
        id: customerId
      });

      return {
        id: response.id,
        email: response.email,
        first_name: response.first_name,
        last_name: response.last_name,
        tags: response.tags ? response.tags.split(', ') : [],
        orders_count: response.orders_count || 0,
        total_spent: parseFloat(response.total_spent || 0)
      };
    } catch (error) {
      console.error('Error fetching customer:', error);
      throw new Error(`Failed to fetch customer: ${error.message}`);
    }
  },

  /**
   * Search customers by email or tag
   */
  async searchCustomers(admin, query) {
    try {
      const response = await admin.rest.resources.Customer.search({
        session: admin.session,
        query: query
      });

      return response.map(customer => ({
        id: customer.id,
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
        tags: customer.tags ? customer.tags.split(', ') : [],
        orders_count: customer.orders_count || 0
      }));
    } catch (error) {
      console.error('Error searching customers:', error);
      throw new Error(`Failed to search customers: ${error.message}`);
    }
  },

  /**
   * Update customer tags
   */
  async updateCustomerTags(admin, customerId, tags) {
    try {
      const customer = new admin.rest.resources.Customer({
        session: admin.session
      });
      customer.id = customerId;
      customer.tags = tags.join(', ');
      await customer.save({
        update: true
      });

      return true;
    } catch (error) {
      console.error('Error updating customer tags:', error);
      throw new Error(`Failed to update customer tags: ${error.message}`);
    }
  },

  /**
   * Add tags to customer (without removing existing)
   */
  async addCustomerTags(admin, customerId, newTags) {
    try {
      const customer = await this.getCustomer(admin, customerId);
      const existingTags = customer.tags || [];
      const uniqueTags = [...new Set([...existingTags, ...newTags])];

      await this.updateCustomerTags(admin, customerId, uniqueTags);
      return uniqueTags;
    } catch (error) {
      console.error('Error adding customer tags:', error);
      throw new Error(`Failed to add customer tags: ${error.message}`);
    }
  },

  /**
   * Remove tags from customer
   */
  async removeCustomerTags(admin, customerId, tagsToRemove) {
    try {
      const customer = await this.getCustomer(admin, customerId);
      const existingTags = customer.tags || [];
      const updatedTags = existingTags.filter(tag => !tagsToRemove.includes(tag));

      await this.updateCustomerTags(admin, customerId, updatedTags);
      return updatedTags;
    } catch (error) {
      console.error('Error removing customer tags:', error);
      throw new Error(`Failed to remove customer tags: ${error.message}`);
    }
  },

  /**
   * Get product by ID
   */
  async getProduct(admin, productId) {
    try {
      const response = await admin.rest.resources.Product.find({
        session: admin.session,
        id: productId
      });

      return {
        id: response.id,
        title: response.title,
        handle: response.handle,
        variants: response.variants.map(v => ({
          id: v.id,
          title: v.title,
          price: parseFloat(v.price),
          sku: v.sku,
          inventory_quantity: v.inventory_quantity
        })),
        images: response.images.map(img => img.src)
      };
    } catch (error) {
      console.error('Error fetching product:', error);
      throw new Error(`Failed to fetch product: ${error.message}`);
    }
  },

  /**
   * Get products by collection
   */
  async getProductsByCollection(admin, collectionId) {
    try {
      const response = await admin.rest.resources.Collection.products({
        session: admin.session,
        id: collectionId
      });

      return response.map(product => ({
        id: product.id,
        title: product.title,
        handle: product.handle
      }));
    } catch (error) {
      console.error('Error fetching products by collection:', error);
      throw new Error(`Failed to fetch products: ${error.message}`);
    }
  },

  /**
   * Get all collections
   */
  async getCollections(admin) {
    try {
      const response = await admin.rest.resources.CustomCollection.all({
        session: admin.session
      });

      return response.map(collection => ({
        id: collection.id,
        title: collection.title,
        handle: collection.handle
      }));
    } catch (error) {
      console.error('Error fetching collections:', error);
      throw new Error(`Failed to fetch collections: ${error.message}`);
    }
  },

  /**
   * Create a draft order with wholesale pricing
   */
  async createDraftOrder(admin, orderData) {
    try {
      const {
        customerId,
        lineItems,
        shippingLine,
        note,
        tags = []
      } = orderData;

      const draftOrder = new admin.rest.resources.DraftOrder({
        session: admin.session
      });

      draftOrder.customer = { id: customerId };
      draftOrder.line_items = lineItems.map(item => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
        applied_discount: item.discount ? {
          value_type: 'percentage',
          value: item.discount_percentage,
          amount: item.discount,
          title: item.discount_title || 'Wholesale Discount'
        } : null
      }));

      if (shippingLine) {
        draftOrder.shipping_line = {
          title: shippingLine.title,
          price: shippingLine.price,
          custom: true
        };
      }

      if (note) {
        draftOrder.note = note;
      }

      if (tags.length > 0) {
        draftOrder.tags = tags.join(', ');
      }

      await draftOrder.save();

      return {
        id: draftOrder.id,
        invoice_url: draftOrder.invoice_url,
        name: draftOrder.name,
        total_price: draftOrder.total_price
      };
    } catch (error) {
      console.error('Error creating draft order:', error);
      throw new Error(`Failed to create draft order: ${error.message}`);
    }
  },

  /**
   * Complete a draft order
   */
  async completeDraftOrder(admin, draftOrderId) {
    try {
      const draftOrder = new admin.rest.resources.DraftOrder({
        session: admin.session
      });
      draftOrder.id = draftOrderId;
      await draftOrder.complete();

      return true;
    } catch (error) {
      console.error('Error completing draft order:', error);
      throw new Error(`Failed to complete draft order: ${error.message}`);
    }
  },

  /**
   * Get customer's order count (to check if first order)
   */
  async getCustomerOrderCount(admin, customerId) {
    try {
      const customer = await this.getCustomer(admin, customerId);
      return customer.orders_count || 0;
    } catch (error) {
      console.error('Error getting customer order count:', error);
      return 0;
    }
  },

  /**
   * Create a price rule (discount code approach - alternative to draft orders)
   */
  async createPriceRule(admin, ruleData) {
    try {
      const {
        title,
        value,
        valueType = 'percentage',
        customerSelection = 'all',
        targetType = 'line_item',
        startsAt,
        endsAt
      } = ruleData;

      const priceRule = new admin.rest.resources.PriceRule({
        session: admin.session
      });

      priceRule.title = title;
      priceRule.target_type = targetType;
      priceRule.target_selection = 'all';
      priceRule.allocation_method = 'across';
      priceRule.value_type = valueType;
      priceRule.value = value;
      priceRule.customer_selection = customerSelection;
      priceRule.starts_at = startsAt || new Date().toISOString();

      if (endsAt) {
        priceRule.ends_at = endsAt;
      }

      await priceRule.save();

      return {
        id: priceRule.id,
        title: priceRule.title
      };
    } catch (error) {
      console.error('Error creating price rule:', error);
      throw new Error(`Failed to create price rule: ${error.message}`);
    }
  },

  /**
   * Create a discount code for a price rule
   */
  async createDiscountCode(admin, priceRuleId, code) {
    try {
      const discountCode = new admin.rest.resources.DiscountCode({
        session: admin.session
      });
      discountCode.price_rule_id = priceRuleId;
      discountCode.code = code;

      await discountCode.save();

      return {
        id: discountCode.id,
        code: discountCode.code
      };
    } catch (error) {
      console.error('Error creating discount code:', error);
      throw new Error(`Failed to create discount code: ${error.message}`);
    }
  },

  /**
   * Get product metafields (for wholesale data)
   */
  async getProductMetafields(admin, productId, namespace = 'wholesale') {
    try {
      const response = await admin.rest.resources.Metafield.all({
        session: admin.session,
        metafield: {
          owner_id: productId,
          owner_resource: 'product'
        }
      });

      return response.filter(m => m.namespace === namespace);
    } catch (error) {
      console.error('Error fetching product metafields:', error);
      return [];
    }
  },

  /**
   * Set product metafield (for storing wholesale data)
   */
  async setProductMetafield(admin, productId, key, value, type = 'json') {
    try {
      const metafield = new admin.rest.resources.Metafield({
        session: admin.session
      });

      metafield.namespace = 'wholesale';
      metafield.key = key;
      metafield.value = typeof value === 'string' ? value : JSON.stringify(value);
      metafield.type = type;
      metafield.owner_id = productId;
      metafield.owner_resource = 'product';

      await metafield.save();

      return true;
    } catch (error) {
      console.error('Error setting product metafield:', error);
      throw new Error(`Failed to set product metafield: ${error.message}`);
    }
  }
};
