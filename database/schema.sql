-- Collectible Tracker Database Schema for PostgreSQL on AWS RDS

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Shops table (stores merchant information)
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_domain VARCHAR(255) UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    scope TEXT,
    subscription_plan VARCHAR(50) DEFAULT 'none',
    subscription_status VARCHAR(50) DEFAULT 'inactive',
    billing_id VARCHAR(255),
    trial_ends_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on shop_domain for faster lookups
CREATE INDEX idx_shops_domain ON shops(shop_domain);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id, name)
);

-- Create indexes for categories
CREATE INDEX idx_categories_shop ON categories(shop_id);
CREATE INDEX idx_categories_active ON categories(shop_id, is_active);

-- Items table (collectibles)
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    serial_number VARCHAR(255) NOT NULL,
    image_url TEXT,
    shopify_file_id VARCHAR(255),
    additional_info JSONB DEFAULT '{}',
    verification_count INTEGER DEFAULT 0,
    last_verified_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id, serial_number)
);

-- Create indexes for items
CREATE INDEX idx_items_category ON items(category_id);
CREATE INDEX idx_items_shop ON items(shop_id);
CREATE INDEX idx_items_serial ON items(shop_id, serial_number);
CREATE INDEX idx_items_active ON items(shop_id, is_active);
CREATE INDEX idx_items_name_search ON items USING gin(to_tsvector('english', name));

-- Verification logs table (tracks when serial numbers are checked)
CREATE TABLE IF NOT EXISTS verification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for verification logs
CREATE INDEX idx_verification_logs_item ON verification_logs(item_id);
CREATE INDEX idx_verification_logs_date ON verification_logs(verified_at);

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to all tables
CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON shops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for category counts (useful for billing enforcement)
CREATE OR REPLACE VIEW category_counts AS
SELECT 
    shop_id,
    COUNT(*) as total_categories,
    COUNT(*) FILTER (WHERE is_active = true) as active_categories
FROM categories
GROUP BY shop_id;

-- View for item counts per category
CREATE OR REPLACE VIEW category_item_counts AS
SELECT 
    c.id as category_id,
    c.shop_id,
    c.name as category_name,
    COUNT(i.id) as item_count,
    COUNT(i.id) FILTER (WHERE i.is_active = true) as active_item_count
FROM categories c
LEFT JOIN items i ON c.id = i.category_id
GROUP BY c.id, c.shop_id, c.name;

-- Function to check subscription limits
CREATE OR REPLACE FUNCTION check_category_limit(p_shop_id UUID, p_plan VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    category_count INTEGER;
    limit_allowed INTEGER;
BEGIN
    SELECT active_categories INTO category_count
    FROM category_counts
    WHERE shop_id = p_shop_id;
    
    IF category_count IS NULL THEN
        category_count := 0;
    END IF;
    
    CASE p_plan
        WHEN 'BASIC_9_99' THEN limit_allowed := 2;
        WHEN 'PRO_29_99' THEN limit_allowed := 5;
        WHEN 'PREMIUM_49_99' THEN limit_allowed := 999999;
        ELSE limit_allowed := 0;
    END CASE;
    
    RETURN category_count < limit_allowed;
END;
$$ LANGUAGE plpgsql;

-- Insert sample data for development (optional - remove for production)
-- This can be commented out for production
/*
INSERT INTO shops (shop_domain, access_token, subscription_plan, subscription_status)
VALUES ('dev-store.myshopify.com', 'sample_token', 'BASIC_9_99', 'active');
*/