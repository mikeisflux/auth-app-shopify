import { query } from "../../db/connection.server.js";

export const CategoryModel = {
  async findAll(shopDomain, includeInactive = false) {
    const whereClause = includeInactive 
      ? 'WHERE s.shop_domain = $1' 
      : 'WHERE s.shop_domain = $1 AND c.is_active = true';
    
    const result = await query(
      `SELECT c.*, 
              COALESCE(cic.item_count, 0) as item_count,
              COALESCE(cic.active_item_count, 0) as active_item_count
       FROM categories c
       INNER JOIN shops s ON c.shop_id = s.id
       LEFT JOIN category_item_counts cic ON c.id = cic.category_id
       ${whereClause}
       ORDER BY c.display_order ASC, c.created_at ASC`,
      [shopDomain]
    );
    
    return result.rows;
  },

  async findById(categoryId, shopDomain) {
    const result = await query(
      `SELECT c.*, 
              COALESCE(cic.item_count, 0) as item_count,
              COALESCE(cic.active_item_count, 0) as active_item_count
       FROM categories c
       INNER JOIN shops s ON c.shop_id = s.id
       LEFT JOIN category_item_counts cic ON c.id = cic.category_id
       WHERE c.id = $1 AND s.shop_domain = $2`,
      [categoryId, shopDomain]
    );
    
    return result.rows[0] || null;
  },

  async create(shopDomain, categoryData) {
    const { name, description, displayOrder } = categoryData;
    
    const result = await query(
      `INSERT INTO categories (shop_id, name, description, display_order)
       SELECT s.id, $2, $3, $4
       FROM shops s
       WHERE s.shop_domain = $1
       RETURNING *`,
      [shopDomain, name, description, displayOrder || 0]
    );
    
    return result.rows[0];
  },

  async update(categoryId, shopDomain, categoryData) {
    const { name, description, displayOrder, isActive } = categoryData;
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (displayOrder !== undefined) {
      updates.push(`display_order = $${paramIndex++}`);
      values.push(displayOrder);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }
    
    if (updates.length === 0) return null;
    
    values.push(categoryId, shopDomain);
    
    const result = await query(
      `UPDATE categories c
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       FROM shops s
       WHERE c.id = $${paramIndex++} 
         AND c.shop_id = s.id 
         AND s.shop_domain = $${paramIndex++}
       RETURNING c.*`,
      values
    );
    
    return result.rows[0] || null;
  },

  async hardDelete(categoryId, shopDomain) {
    const result = await query(
      `DELETE FROM categories c
       USING shops s
       WHERE c.id = $1 
         AND c.shop_id = s.id 
         AND s.shop_domain = $2
       RETURNING c.*`,
      [categoryId, shopDomain]
    );
    
    return result.rows[0] || null;
  }
};