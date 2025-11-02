-- ============================================================================
-- ADDITIONAL WHOLESALE FEATURES SCHEMA
-- ============================================================================
-- This extends the wholesale system with:
-- - Individual variant pricing
-- - Login to view prices settings
-- - Additional fee rules
-- - Sale clock settings

-- ============================================================================
-- INDIVIDUAL VARIANT PRICING
-- ============================================================================

-- Individual variant-level pricing (overrides rule-based pricing)
CREATE TABLE IF NOT EXISTS individual_variant_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL,
    variant_id BIGINT NOT NULL,
    sku VARCHAR(255),
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'fixed_price')),
    discount_value DECIMAL(10,2) NOT NULL,
    customer_tags TEXT, -- Comma-separated or NULL for all
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_individual_variant_shop ON individual_variant_pricing(shop_id);
CREATE INDEX IF NOT EXISTS idx_individual_variant_product ON individual_variant_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_individual_variant_sku ON individual_variant_pricing(sku);

-- ============================================================================
-- LOGIN TO VIEW PRICES SETTINGS
-- ============================================================================

-- Settings for login-to-view-prices feature
CREATE TABLE IF NOT EXISTS hide_prices_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE UNIQUE,
    enabled BOOLEAN DEFAULT FALSE,
    hide_add_to_cart BOOLEAN DEFAULT TRUE,
    custom_message TEXT DEFAULT 'Login to see prices',
    button_text VARCHAR(100) DEFAULT 'Login to View Prices',
    apply_to_collections TEXT, -- JSON array of collection IDs
    exclude_collections TEXT, -- JSON array of collection IDs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ADDITIONAL FEES
-- ============================================================================

-- Fee rules for wholesale orders
CREATE TABLE IF NOT EXISTS additional_fee_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    fee_type VARCHAR(20) NOT NULL CHECK (fee_type IN ('percentage', 'fixed_amount')),
    fee_value DECIMAL(10,2) NOT NULL,
    customer_tags TEXT, -- Comma-separated or NULL for all
    description TEXT,
    applies_to VARCHAR(50) DEFAULT 'all' CHECK (applies_to IN ('all', 'wholesale_only', 'tagged')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fee_rules_shop ON additional_fee_rules(shop_id);
CREATE INDEX IF NOT EXISTS idx_fee_rules_status ON additional_fee_rules(status);

-- ============================================================================
-- SALE CLOCK SETTINGS (stored in wholesale_settings table as JSONB)
-- ============================================================================
-- Sale clock settings are stored in the existing wholesale_settings table
-- as a JSONB column called 'sale_clock_config'
-- Format:
-- {
--   "enabled": true,
--   "bg_color": "#000000",
--   "fg_color": "#ffffff",
--   "text_align": "left",
--   "font_size": 14,
--   "border_radius": 4
-- }

-- Add sale_clock_config column to wholesale_settings if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'wholesale_settings'
        AND column_name = 'sale_clock_config'
    ) THEN
        ALTER TABLE wholesale_settings
        ADD COLUMN sale_clock_config JSONB DEFAULT '{"enabled": false}'::jsonb;
    END IF;
END $$;

-- ============================================================================
-- LOGIN PAGE CUSTOMIZATION SETTINGS
-- ============================================================================

-- Extend wholesale_settings with login page customization
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'wholesale_settings'
        AND column_name = 'login_page_mode'
    ) THEN
        ALTER TABLE wholesale_settings
        ADD COLUMN login_page_mode VARCHAR(20) DEFAULT 'append'
            CHECK (login_page_mode IN ('none', 'replace', 'append'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'wholesale_settings'
        AND column_name = 'wholesale_signup_url'
    ) THEN
        ALTER TABLE wholesale_settings
        ADD COLUMN wholesale_signup_url TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'wholesale_settings'
        AND column_name = 'wholesale_signup_label'
    ) THEN
        ALTER TABLE wholesale_settings
        ADD COLUMN wholesale_signup_label VARCHAR(255) DEFAULT 'Create wholesale account';
    END IF;
END $$;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get individual variant price for a customer
CREATE OR REPLACE FUNCTION get_individual_variant_price(
    p_shop_domain VARCHAR,
    p_variant_id BIGINT,
    p_customer_tags TEXT,
    p_retail_price DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
    v_pricing RECORD;
    v_wholesale_price DECIMAL;
BEGIN
    -- Get individual variant pricing
    SELECT ivp.* INTO v_pricing
    FROM individual_variant_pricing ivp
    INNER JOIN shops s ON ivp.shop_id = s.id
    WHERE s.shop_domain = p_shop_domain
      AND ivp.variant_id = p_variant_id
      AND (
          ivp.customer_tags IS NULL
          OR ivp.customer_tags = ''
          OR p_customer_tags LIKE '%' || ivp.customer_tags || '%'
      );

    IF NOT FOUND THEN
        RETURN p_retail_price;
    END IF;

    -- Calculate wholesale price based on discount type
    CASE v_pricing.discount_type
        WHEN 'percentage' THEN
            v_wholesale_price := p_retail_price * (1 - (v_pricing.discount_value / 100));
        WHEN 'fixed_amount' THEN
            v_wholesale_price := GREATEST(0, p_retail_price - v_pricing.discount_value);
        WHEN 'fixed_price' THEN
            v_wholesale_price := v_pricing.discount_value;
        ELSE
            v_wholesale_price := p_retail_price;
    END CASE;

    RETURN v_wholesale_price;
END;
$$ LANGUAGE plpgsql;

-- Check if prices should be hidden for a customer
CREATE OR REPLACE FUNCTION should_hide_prices(
    p_shop_domain VARCHAR,
    p_is_logged_in BOOLEAN
)
RETURNS BOOLEAN AS $$
DECLARE
    v_enabled BOOLEAN;
BEGIN
    SELECT hps.enabled INTO v_enabled
    FROM hide_prices_settings hps
    INNER JOIN shops s ON hps.shop_id = s.id
    WHERE s.shop_domain = p_shop_domain;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- If feature is enabled and user is NOT logged in, hide prices
    RETURN v_enabled AND NOT p_is_logged_in;
END;
$$ LANGUAGE plpgsql;

-- Calculate additional fees for an order
CREATE OR REPLACE FUNCTION calculate_additional_fees(
    p_shop_domain VARCHAR,
    p_customer_tags TEXT,
    p_subtotal DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
    v_fee RECORD;
    v_total_fees DECIMAL := 0;
BEGIN
    FOR v_fee IN
        SELECT afr.*
        FROM additional_fee_rules afr
        INNER JOIN shops s ON afr.shop_id = s.id
        WHERE s.shop_domain = p_shop_domain
          AND afr.status = 'active'
          AND (
              afr.applies_to = 'all'
              OR (afr.applies_to = 'tagged' AND p_customer_tags LIKE '%' || afr.customer_tags || '%')
          )
    LOOP
        CASE v_fee.fee_type
            WHEN 'percentage' THEN
                v_total_fees := v_total_fees + (p_subtotal * (v_fee.fee_value / 100));
            WHEN 'fixed_amount' THEN
                v_total_fees := v_total_fees + v_fee.fee_value;
        END CASE;
    END LOOP;

    RETURN v_total_fees;
END;
$$ LANGUAGE plpgsql;
