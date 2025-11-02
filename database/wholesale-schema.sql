-- Wholesale Portal Database Schema Extension
-- This schema adds wholesale functionality to the existing Collectible Tracker app

-- ============================================================================
-- WHOLESALE PRICING RULES
-- ============================================================================

-- Main pricing rules table
CREATE TABLE IF NOT EXISTS pricing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('wholesale', 'volume', 'individual')),
    status VARCHAR(50) DEFAULT 'unpublished' CHECK (status IN ('published', 'unpublished')),
    discount_type VARCHAR(50) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'fixed_price')),
    discount_value DECIMAL(10,2) NOT NULL,
    customer_selection VARCHAR(50) DEFAULT 'tagged' CHECK (customer_selection IN ('tagged', 'all_logged_in', 'all_customers')),
    customer_tags JSONB DEFAULT '[]',
    product_scope VARCHAR(50) DEFAULT 'all' CHECK (product_scope IN ('all', 'collections', 'specific')),
    product_ids JSONB DEFAULT '[]',
    collection_ids JSONB DEFAULT '[]',
    excluded_product_ids JSONB DEFAULT '[]',
    excluded_collection_ids JSONB DEFAULT '[]',
    start_date TIMESTAMP NULL,
    end_date TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pricing_rules_shop ON pricing_rules(shop_id);
CREATE INDEX idx_pricing_rules_status ON pricing_rules(shop_id, status);
CREATE INDEX idx_pricing_rules_type ON pricing_rules(rule_type);
CREATE INDEX idx_pricing_rules_dates ON pricing_rules(start_date, end_date);

-- ============================================================================
-- VOLUME PRICING TIERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS volume_pricing_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pricing_rule_id UUID NOT NULL REFERENCES pricing_rules(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    discount_type VARCHAR(50) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'fixed_price')),
    discount_value DECIMAL(10,2) NOT NULL,
    tier_application VARCHAR(50) DEFAULT 'per_variant' CHECK (tier_application IN ('per_variant', 'per_product', 'across_products')),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_volume_tiers_rule ON volume_pricing_tiers(pricing_rule_id);
CREATE INDEX idx_volume_tiers_quantity ON volume_pricing_tiers(pricing_rule_id, quantity);

-- ============================================================================
-- ORDER LIMIT RULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_limit_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'inactive' CHECK (status IN ('active', 'inactive')),
    customer_tags JSONB DEFAULT '[]',
    scope VARCHAR(50) DEFAULT 'all_orders' CHECK (scope IN ('all_orders', 'first_only', 'separate_first')),
    condition_logic VARCHAR(10) DEFAULT 'all' CHECK (condition_logic IN ('all', 'any')),
    failure_action VARCHAR(50) DEFAULT 'block' CHECK (failure_action IN ('block', 'allow_retail')),
    customer_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_limits_shop ON order_limit_rules(shop_id);
CREATE INDEX idx_order_limits_status ON order_limit_rules(shop_id, status);

-- ============================================================================
-- ORDER LIMIT CONDITIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_limit_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_limit_rule_id UUID NOT NULL REFERENCES order_limit_rules(id) ON DELETE CASCADE,
    condition_field VARCHAR(50) NOT NULL CHECK (condition_field IN ('cart_total_amount', 'cart_total_items', 'cart_total_weight')),
    condition_operator VARCHAR(20) NOT NULL CHECK (condition_operator IN ('is_minimum', 'is_maximum', 'equals', 'between')),
    condition_value DECIMAL(10,2) NOT NULL,
    condition_value_max DECIMAL(10,2) NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_conditions_rule ON order_limit_conditions(order_limit_rule_id);

-- ============================================================================
-- SHIPPING RULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS shipping_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    title VARCHAR(80) NOT NULL,
    message VARCHAR(160),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    customer_selection VARCHAR(50) DEFAULT 'tagged' CHECK (customer_selection IN ('tagged', 'all_logged_in', 'all_customers')),
    customer_tags JSONB DEFAULT '[]',
    geographic_scope VARCHAR(50) DEFAULT 'all_countries' CHECK (geographic_scope IN ('all_countries', 'specific_countries')),
    country_codes JSONB DEFAULT '[]',
    rate_type VARCHAR(50) DEFAULT 'flat' CHECK (rate_type IN ('flat', 'percentage', 'conditional')),
    rate_calculation_basis VARCHAR(20) DEFAULT 'amount' CHECK (rate_calculation_basis IN ('amount', 'quantity', 'weight')),
    shipping_charge DECIMAL(10,2) DEFAULT 0,
    minimum_threshold DECIMAL(10,2) DEFAULT 0,
    maximum_threshold DECIMAL(10,2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shipping_rules_shop ON shipping_rules(shop_id);
CREATE INDEX idx_shipping_rules_status ON shipping_rules(shop_id, status);

-- ============================================================================
-- WHOLESALE CUSTOMERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS wholesale_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    shopify_customer_id BIGINT NOT NULL,
    email VARCHAR(255) NOT NULL,
    wholesale_approved BOOLEAN DEFAULT FALSE,
    approval_date TIMESTAMP NULL,
    approved_by VARCHAR(255),
    customer_tags JSONB DEFAULT '[]',
    order_count INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id, shopify_customer_id)
);

CREATE INDEX idx_wholesale_customers_shop ON wholesale_customers(shop_id);
CREATE INDEX idx_wholesale_customers_email ON wholesale_customers(shop_id, email);
CREATE INDEX idx_wholesale_customers_approval ON wholesale_customers(shop_id, wholesale_approved);
CREATE INDEX idx_wholesale_customers_shopify_id ON wholesale_customers(shopify_customer_id);

-- ============================================================================
-- PRICE CACHE (for performance optimization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS price_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_variant_id BIGINT NOT NULL,
    customer_tag VARCHAR(100) NOT NULL,
    retail_price DECIMAL(10,2) NOT NULL,
    wholesale_price DECIMAL(10,2) NOT NULL,
    discount_percentage DECIMAL(5,2),
    pricing_rule_id UUID REFERENCES pricing_rules(id) ON DELETE SET NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id, product_variant_id, customer_tag)
);

CREATE INDEX idx_price_cache_shop ON price_cache(shop_id);
CREATE INDEX idx_price_cache_variant ON price_cache(product_variant_id);
CREATE INDEX idx_price_cache_expiration ON price_cache(expires_at);

-- ============================================================================
-- WHOLESALE APP SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS wholesale_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE UNIQUE,
    show_crossed_prices BOOLEAN DEFAULT TRUE,
    compare_at_as_crossed BOOLEAN DEFAULT FALSE,
    coupon_field_mode VARCHAR(20) DEFAULT 'disabled' CHECK (coupon_field_mode IN ('all', 'tagged', 'disabled')),
    prevent_shopify_auto_discounts BOOLEAN DEFAULT FALSE,
    checkout_method VARCHAR(20) DEFAULT 'draft_order' CHECK (checkout_method IN ('draft_order', 'coupon_code')),
    discount_label VARCHAR(50) DEFAULT 'DISCOUNT',
    login_page_mode VARCHAR(20) DEFAULT 'append' CHECK (login_page_mode IN ('none', 'replace', 'append')),
    wholesale_signup_url VARCHAR(255),
    wholesale_signup_label VARCHAR(100) DEFAULT 'Create wholesale account',
    additional_fee_enabled BOOLEAN DEFAULT FALSE,
    sale_clock_enabled BOOLEAN DEFAULT TRUE,
    sale_clock_bg_color VARCHAR(7) DEFAULT '#000000',
    sale_clock_fg_color VARCHAR(7) DEFAULT '#ffffff',
    sale_clock_text_align VARCHAR(10) DEFAULT 'left' CHECK (sale_clock_text_align IN ('left', 'center', 'right')),
    app_mode VARCHAR(10) DEFAULT 'test' CHECK (app_mode IN ('live', 'test')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ELIGIBILITY CHECKS (audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS eligibility_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    pricing_rule_id UUID REFERENCES pricing_rules(id) ON DELETE CASCADE,
    eligible BOOLEAN NOT NULL,
    reason TEXT,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_eligibility_shop_email ON eligibility_checks(shop_id, email);
CREATE INDEX idx_eligibility_checked_at ON eligibility_checks(checked_at);

-- ============================================================================
-- WEBHOOK LOGS (for debugging and compliance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS wholesale_webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    webhook_topic VARCHAR(100) NOT NULL,
    shopify_webhook_id VARCHAR(100),
    payload JSONB,
    processed BOOLEAN DEFAULT FALSE,
    processing_error TEXT,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL
);

CREATE INDEX idx_webhook_logs_shop ON wholesale_webhook_logs(shop_id);
CREATE INDEX idx_webhook_logs_topic ON wholesale_webhook_logs(shop_id, webhook_topic);
CREATE INDEX idx_webhook_logs_processed ON wholesale_webhook_logs(processed, received_at);

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================

CREATE TRIGGER update_pricing_rules_updated_at BEFORE UPDATE ON pricing_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_limit_rules_updated_at BEFORE UPDATE ON order_limit_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipping_rules_updated_at BEFORE UPDATE ON shipping_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wholesale_customers_updated_at BEFORE UPDATE ON wholesale_customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wholesale_settings_updated_at BEFORE UPDATE ON wholesale_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

-- View for active pricing rules
CREATE OR REPLACE VIEW active_pricing_rules AS
SELECT
    pr.*,
    COUNT(DISTINCT wc.id) as applicable_customers
FROM pricing_rules pr
LEFT JOIN wholesale_customers wc ON
    wc.shop_id = pr.shop_id
    AND wc.customer_tags ?| ARRAY(SELECT jsonb_array_elements_text(pr.customer_tags))
WHERE pr.status = 'published'
    AND (pr.start_date IS NULL OR pr.start_date <= CURRENT_TIMESTAMP)
    AND (pr.end_date IS NULL OR pr.end_date >= CURRENT_TIMESTAMP)
GROUP BY pr.id;

-- View for wholesale customer summary
CREATE OR REPLACE VIEW wholesale_customer_summary AS
SELECT
    wc.shop_id,
    COUNT(*) as total_customers,
    COUNT(*) FILTER (WHERE wholesale_approved = true) as approved_customers,
    COUNT(*) FILTER (WHERE wholesale_approved = false) as pending_customers,
    SUM(order_count) as total_orders,
    SUM(total_spent) as total_revenue
FROM wholesale_customers wc
GROUP BY wc.shop_id;

-- View for pricing rule effectiveness
CREATE OR REPLACE VIEW pricing_rule_stats AS
SELECT
    pr.id,
    pr.shop_id,
    pr.name,
    pr.rule_type,
    COUNT(DISTINCT pc.product_variant_id) as products_cached,
    AVG(pc.discount_percentage) as avg_discount_percentage
FROM pricing_rules pr
LEFT JOIN price_cache pc ON pr.id = pc.pricing_rule_id
GROUP BY pr.id, pr.shop_id, pr.name, pr.rule_type;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if customer is eligible for a pricing rule
CREATE OR REPLACE FUNCTION is_customer_eligible(
    p_customer_tags JSONB,
    p_rule_tags JSONB,
    p_customer_selection VARCHAR
)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_customer_selection = 'all_customers' THEN
        RETURN TRUE;
    ELSIF p_customer_selection = 'all_logged_in' THEN
        RETURN TRUE; -- Caller should verify customer is logged in
    ELSIF p_customer_selection = 'tagged' THEN
        -- Check if customer has any of the required tags
        RETURN EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(p_customer_tags) ct
            WHERE ct IN (SELECT jsonb_array_elements_text(p_rule_tags))
        );
    END IF;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate wholesale price
CREATE OR REPLACE FUNCTION calculate_wholesale_price(
    p_retail_price DECIMAL,
    p_discount_type VARCHAR,
    p_discount_value DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
    CASE p_discount_type
        WHEN 'percentage' THEN
            RETURN p_retail_price * (1 - (p_discount_value / 100));
        WHEN 'fixed_amount' THEN
            RETURN GREATEST(0, p_retail_price - p_discount_value);
        WHEN 'fixed_price' THEN
            RETURN p_discount_value;
        ELSE
            RETURN p_retail_price;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to clear expired price cache
CREATE OR REPLACE FUNCTION clear_expired_price_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM price_cache WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA FOR DEVELOPMENT (Optional)
-- ============================================================================

-- Insert default wholesale settings for existing shops
INSERT INTO wholesale_settings (shop_id)
SELECT id FROM shops
WHERE id NOT IN (SELECT shop_id FROM wholesale_settings)
ON CONFLICT (shop_id) DO NOTHING;
