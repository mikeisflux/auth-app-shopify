-- Wholesale Portal Extensions - Additional Features
-- Run this AFTER wholesale-schema.sql

-- Extension for UUID generation (if not already exists)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PRODUCT VISIBILITY RULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_visibility_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    rule_name VARCHAR(255) NOT NULL,
    visibility_type VARCHAR(20) NOT NULL CHECK (visibility_type IN ('show', 'hide')),
    customer_tags JSONB DEFAULT '[]',
    product_ids JSONB DEFAULT '[]',
    collection_ids JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_visibility_rules_shop ON product_visibility_rules(shop_id);
CREATE INDEX IF NOT EXISTS idx_visibility_rules_status ON product_visibility_rules(shop_id, status);

CREATE TRIGGER update_product_visibility_rules_updated_at BEFORE UPDATE ON product_visibility_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- NET TERMS (Pay Later)
-- ============================================================================

CREATE TABLE IF NOT EXISTS net_terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES wholesale_customers(id) ON DELETE CASCADE,
    credit_limit DECIMAL(10,2) DEFAULT 0,
    net_days INTEGER DEFAULT 30,
    current_balance DECIMAL(10,2) DEFAULT 0,
    available_credit DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id)
);

CREATE INDEX IF NOT EXISTS idx_net_terms_shop ON net_terms(shop_id);
CREATE INDEX IF NOT EXISTS idx_net_terms_customer ON net_terms(customer_id);
CREATE INDEX IF NOT EXISTS idx_net_terms_status ON net_terms(status);

CREATE TRIGGER update_net_terms_updated_at BEFORE UPDATE ON net_terms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Net terms invoices
CREATE TABLE IF NOT EXISTS net_terms_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    net_terms_id UUID NOT NULL REFERENCES net_terms(id) ON DELETE CASCADE,
    shopify_order_id BIGINT NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_net_invoices_terms ON net_terms_invoices(net_terms_id);
CREATE INDEX IF NOT EXISTS idx_net_invoices_status ON net_terms_invoices(status);
CREATE INDEX IF NOT EXISTS idx_net_invoices_due_date ON net_terms_invoices(due_date);

CREATE TRIGGER update_net_terms_invoices_updated_at BEFORE UPDATE ON net_terms_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CUSTOMER APPROVAL WORKFLOW
-- ============================================================================

CREATE TABLE IF NOT EXISTS approval_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES wholesale_customers(id) ON DELETE CASCADE,
    request_type VARCHAR(50) DEFAULT 'wholesale_access',
    requested_by VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP NULL,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_shop ON approval_requests(shop_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_customer ON approval_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);

CREATE TRIGGER update_approval_requests_updated_at BEFORE UPDATE ON approval_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS FOR EXTENSIONS
-- ============================================================================

-- Function to check product visibility for customer
CREATE OR REPLACE FUNCTION check_product_visibility(
    p_shop_id UUID,
    p_product_id BIGINT,
    p_customer_tags JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
    show_rule RECORD;
    hide_rule RECORD;
BEGIN
    -- Check if there are any SHOW rules for this product
    SELECT * INTO show_rule
    FROM product_visibility_rules
    WHERE shop_id = p_shop_id
      AND status = 'active'
      AND visibility_type = 'show'
      AND (
        product_ids @> to_jsonb(p_product_id::text)
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(collection_ids) coll_id
          -- Would need to check if product is in collection
        )
      )
    LIMIT 1;

    -- If there's a SHOW rule, customer must have matching tags
    IF FOUND THEN
        RETURN EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(p_customer_tags) ct
            WHERE ct IN (SELECT jsonb_array_elements_text(show_rule.customer_tags))
        );
    END IF;

    -- Check if there are any HIDE rules
    SELECT * INTO hide_rule
    FROM product_visibility_rules
    WHERE shop_id = p_shop_id
      AND status = 'active'
      AND visibility_type = 'hide'
      AND (
        product_ids @> to_jsonb(p_product_id::text)
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(collection_ids) coll_id
          -- Would need to check if product is in collection
        )
      )
    LIMIT 1;

    -- If there's a HIDE rule and customer has matching tags, hide the product
    IF FOUND THEN
        RETURN NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(p_customer_tags) ct
            WHERE ct IN (SELECT jsonb_array_elements_text(hide_rule.customer_tags))
        );
    END IF;

    -- No rules apply, product is visible
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate available credit for net terms
CREATE OR REPLACE FUNCTION get_available_credit(p_net_terms_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    credit_limit DECIMAL;
    current_balance DECIMAL;
BEGIN
    SELECT nt.credit_limit, nt.current_balance
    INTO credit_limit, current_balance
    FROM net_terms nt
    WHERE id = p_net_terms_id;

    RETURN GREATEST(0, credit_limit - current_balance);
END;
$$ LANGUAGE plpgsql;

-- Function to update net terms balance
CREATE OR REPLACE FUNCTION update_net_terms_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE net_terms
        SET current_balance = (
            SELECT COALESCE(SUM(amount), 0)
            FROM net_terms_invoices
            WHERE net_terms_id = NEW.net_terms_id
              AND status IN ('pending', 'overdue')
        ),
        available_credit = credit_limit - (
            SELECT COALESCE(SUM(amount), 0)
            FROM net_terms_invoices
            WHERE net_terms_id = NEW.net_terms_id
              AND status IN ('pending', 'overdue')
        )
        WHERE id = NEW.net_terms_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_balance_on_invoice_change
AFTER INSERT OR UPDATE ON net_terms_invoices
FOR EACH ROW EXECUTE FUNCTION update_net_terms_balance();

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

-- View for net terms summary
CREATE OR REPLACE VIEW net_terms_summary AS
SELECT
    nt.id,
    nt.shop_id,
    wc.email as customer_email,
    nt.credit_limit,
    nt.current_balance,
    nt.available_credit,
    nt.net_days,
    nt.status,
    COUNT(nti.id) as total_invoices,
    COUNT(nti.id) FILTER (WHERE nti.status = 'pending') as pending_invoices,
    COUNT(nti.id) FILTER (WHERE nti.status = 'overdue') as overdue_invoices,
    COALESCE(SUM(nti.amount) FILTER (WHERE nti.status = 'pending'), 0) as pending_amount,
    COALESCE(SUM(nti.amount) FILTER (WHERE nti.status = 'overdue'), 0) as overdue_amount
FROM net_terms nt
INNER JOIN wholesale_customers wc ON nt.customer_id = wc.id
LEFT JOIN net_terms_invoices nti ON nt.id = nti.net_terms_id
GROUP BY nt.id, nt.shop_id, wc.email, nt.credit_limit, nt.current_balance,
         nt.available_credit, nt.net_days, nt.status;

-- View for pending approvals
CREATE OR REPLACE VIEW pending_approvals AS
SELECT
    ar.id,
    ar.shop_id,
    wc.email as customer_email,
    wc.shopify_customer_id,
    ar.request_type,
    ar.requested_by,
    ar.created_at,
    EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ar.created_at)) as days_pending
FROM approval_requests ar
INNER JOIN wholesale_customers wc ON ar.customer_id = wc.id
WHERE ar.status = 'pending'
ORDER BY ar.created_at ASC;

-- ============================================================================
-- RETAILER PORTAL - LOGIN TOKENS
-- ============================================================================

-- Login tokens for retailer portal access (magic link / passwordless auth)
CREATE TABLE IF NOT EXISTS retailer_login_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES wholesale_customers(id) ON DELETE CASCADE,
    shop_domain VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_retailer_tokens_customer ON retailer_login_tokens(customer_id);
CREATE INDEX IF NOT EXISTS idx_retailer_tokens_token ON retailer_login_tokens(token);
CREATE INDEX IF NOT EXISTS idx_retailer_tokens_expires ON retailer_login_tokens(expires_at);

-- Cleanup expired tokens (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_retailer_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM retailer_login_tokens
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
