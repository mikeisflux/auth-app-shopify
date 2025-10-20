// Shop model - handles merchant store data
import { query } from '../db/connection.server.js';

export const ShopModel = {
  // Find shop by domain
  async findByDomain(shopDomain) {
    const result = await query(
      'SELECT * FROM shops WHERE shop_domain = $1',
      [shopDomain]
    );
    return result.rows[0] || null;
  },

  // Create or update shop
  async upsert(shopData) {
    const { shopDomain, accessToken, scope } = shopData;
    
    const result = await query(
      `INSERT INTO shops (shop_domain, access_token, scope)
       VALUES ($1, $2, $3)
       ON CONFLICT (shop_domain) 
       DO UPDATE SET 
         access_token = EXCLUDED.access_token,
         scope = EXCLUDED.scope,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [shopDomain, accessToken, scope]
    );
    
    return result.rows[0];
  },

  // Update subscription
  async updateSubscription(shopDomain, subscriptionData) {
    const { plan, status, billingId, trialEndsAt } = subscriptionData;
    
    const result = await query(
      `UPDATE shops 
       SET subscription_plan = $1,
           subscription_status = $2,
           billing_id = $3,
           trial_ends_at = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE shop_domain = $5
       RETURNING *`,
      [plan, status, billingId, trialEndsAt, shopDomain]
    );
    
    return result.rows[0];
  },

  // Get subscription status
  async getSubscription(shopDomain) {
    const result = await query(
      `SELECT subscription_plan, subscription_status, trial_ends_at, billing_id
       FROM shops 
       WHERE shop_domain = $1`,
      [shopDomain]
    );
    
    return result.rows[0] || null;
  },

  // Check if shop can create more categories
  async canCreateCategory(shopDomain) {
    const result = await query(
      `SELECT s.subscription_plan, 
              COALESCE(cc.active_categories, 0) as current_categories
       FROM shops s
       LEFT JOIN category_counts cc ON s.id = cc.shop_id
       WHERE s.shop_domain = $1`,
      [shopDomain]
    );
    
    const shop = result.rows[0];
    if (!shop) return false;
    
    const limits = {
      'BASIC_9_99': 2,
      'PRO_29_99': 5,
      'PREMIUM_49_99': 999999,
      'none': 0
    };
    
    const limit = limits[shop.subscription_plan] || 0;
    return shop.current_categories < limit;
  },

  // Get category count for shop
  async getCategoryCount(shopDomain) {
    const result = await query(
      `SELECT COALESCE(cc.active_categories, 0) as count
       FROM shops s
       LEFT JOIN category_counts cc ON s.id = cc.shop_id
       WHERE s.shop_domain = $1`,
      [shopDomain]
    );
    
    return result.rows[0]?.count || 0;
  },

  // Delete shop (GDPR compliance)
  async delete(shopDomain) {
    const result = await query(
      'DELETE FROM shops WHERE shop_domain = $1 RETURNING *',
      [shopDomain]
    );
    
    return result.rows[0] || null;
  }
};