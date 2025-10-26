import { query } from "../../db/connection.server.js";

export const ItemModel = {
  async findAll(shopDomain, options = {}) {
    const {
      categoryId,
      search,
      isActive,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      limit = 50,
      offset = 0
    } = options;
    
    const conditions = ['s.shop_domain = $1'];
    const values = [shopDomain];
    let paramIndex = 2;
    
    if (categoryId) {
      conditions.push(`i.category_id = $${paramIndex++}`);
      values.push(categoryId);
    }
    
    if (isActive !== undefined) {
      conditions.push(`i.is_active = $${paramIndex++}`);
      values.push(isActive);
    }
    
    if (search) {
      conditions.push(`(
        i.name ILIKE $${paramIndex} OR 
        i.serial_number ILIKE $${paramIndex} OR
        i.description ILIKE $${paramIndex}
      )`);
      values.push(`%${search}%`);
      paramIndex++;
    }
    
    const validSortColumns = ['name', 'serial_number', 'created_at', 'updated_at', 'verification_count'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    values.push(limit, offset);
    
    const result = await query(
      `SELECT i.*, c.name as category_name
       FROM items i
       INNER JOIN categories c ON i.category_id = c.id
       INNER JOIN shops s ON i.shop_id = s.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY i.${sortColumn} ${order}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      values
    );
    
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM items i
       INNER JOIN shops s ON i.shop_id = s.id
       WHERE ${conditions.join(' AND ')}`,
      values.slice(0, values.length - 2)
    );
    
    return {
      items: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    };
  },

  async findById(itemId, shopDomain) {
    const result = await query(
      `SELECT i.*, c.name as category_name
       FROM items i
       INNER JOIN categories c ON i.category_id = c.id
       INNER JOIN shops s ON i.shop_id = s.id
       WHERE i.id = $1 AND s.shop_domain = $2`,
      [itemId, shopDomain]
    );
    
    return result.rows[0] || null;
  },

  async findBySerialNumber(serialNumber, shopDomain) {
    const result = await query(
      `SELECT i.*, c.name as category_name
       FROM items i
       INNER JOIN categories c ON i.category_id = c.id
       INNER JOIN shops s ON i.shop_id = s.id
       WHERE i.serial_number = $1 
         AND s.shop_domain = $2 
         AND i.is_active = true`,
      [serialNumber, shopDomain]
    );
    
    return result.rows[0] || null;
  },

  async create(shopDomain, itemData) {
    const {
      categoryId,
      name,
      description,
      serialNumber,
      imageUrl,
      shopifyFileId,
      additionalInfo
    } = itemData;
    
    const result = await query(
      `INSERT INTO items (
        shop_id, category_id, name, description, 
        serial_number, image_url, shopify_file_id, additional_info
       )
       SELECT s.id, $2, $3, $4, $5, $6, $7, $8
       FROM shops s
       WHERE s.shop_domain = $1
       RETURNING *`,
      [
        shopDomain, categoryId, name, description,
        serialNumber, imageUrl, shopifyFileId,
        additionalInfo ? JSON.stringify(additionalInfo) : '{}'
      ]
    );
    
    return result.rows[0];
  },

  async update(itemId, shopDomain, itemData) {
    const {
      name,
      description,
      serialNumber,
      imageUrl,
      shopifyFileId,
      additionalInfo,
      isActive
    } = itemData;
    
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
    if (serialNumber !== undefined) {
      updates.push(`serial_number = $${paramIndex++}`);
      values.push(serialNumber);
    }
    if (imageUrl !== undefined) {
      updates.push(`image_url = $${paramIndex++}`);
      values.push(imageUrl);
    }
    if (shopifyFileId !== undefined) {
      updates.push(`shopify_file_id = $${paramIndex++}`);
      values.push(shopifyFileId);
    }
    if (additionalInfo !== undefined) {
      updates.push(`additional_info = $${paramIndex++}`);
      values.push(JSON.stringify(additionalInfo));
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }
    
    if (updates.length === 0) return null;
    
    values.push(itemId, shopDomain);
    
    const result = await query(
      `UPDATE items i
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       FROM shops s
       WHERE i.id = $${paramIndex++}
         AND i.shop_id = s.id
         AND s.shop_domain = $${paramIndex++}
       RETURNING i.*`,
      values
    );
    
    return result.rows[0] || null;
  },

  async delete(itemId, shopDomain) {
    const result = await query(
      `DELETE FROM items i
       USING shops s
       WHERE i.id = $1
         AND i.shop_id = s.id
         AND s.shop_domain = $2
       RETURNING i.*`,
      [itemId, shopDomain]
    );
    
    return result.rows[0] || null;
  },

  async logVerification(itemId, ipAddress, userAgent) {
    await query(
      `INSERT INTO verification_logs (item_id, shop_id, ip_address, user_agent)
       SELECT $1, shop_id, $2::inet, $3
       FROM items
       WHERE id = $1`,
      [itemId, ipAddress, userAgent]
    );
    
    await query(
      `UPDATE items
       SET verification_count = verification_count + 1,
           last_verified_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [itemId]
    );
  },

  async serialNumberExists(serialNumber, shopDomain, excludeItemId = null) {
    const conditions = ['s.shop_domain = $1', 'i.serial_number = $2'];
    const values = [shopDomain, serialNumber];
    
    if (excludeItemId) {
      conditions.push('i.id != $3');
      values.push(excludeItemId);
    }
    
    const result = await query(
      `SELECT EXISTS(
        SELECT 1 FROM items i
        INNER JOIN shops s ON i.shop_id = s.id
        WHERE ${conditions.join(' AND ')}
      ) as exists`,
      values
    );
    
    return result.rows[0].exists;
  }
};