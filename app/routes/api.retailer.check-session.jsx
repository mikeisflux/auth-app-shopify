// Check if retailer is logged in and get their wholesale status
// This is called from the storefront to determine if wholesale pricing should be shown
import { json } from "@remix-run/node";
import { cors } from "remix-utils/cors";
import { query } from "../db/connection.server";

/**
 * PUBLIC API ENDPOINT for storefront session checking
 *
 * Usage from storefront (Liquid theme):
 * {% if customer %}
 *   fetch('/api/retailer/check-session?shop={{ shop.domain }}&customerId={{ customer.id }}')
 * {% endif %}
 *
 * Returns: { isWholesale, approved, customerTags, hasNetTerms, creditAvailable }
 */
export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get('shop');
  const customerId = url.searchParams.get('customerId');

  if (!shopDomain || !customerId) {
    const response = json(
      { error: 'Missing required parameters: shop, customerId' },
      { status: 400 }
    );
    return cors(request, response);
  }

  try {
    // Check if this customer is a wholesale customer
    const result = await query(
      `SELECT wc.*, nt.available_credit, nt.status as net_terms_status
       FROM wholesale_customers wc
       INNER JOIN shops s ON wc.shop_id = s.id
       LEFT JOIN net_terms nt ON nt.customer_id = wc.id
       WHERE wc.shopify_customer_id = $1
         AND s.shop_domain = $2`,
      [customerId, shopDomain]
    );

    if (result.rows.length === 0) {
      const response = json({
        success: true,
        isWholesale: false,
        approved: false,
        message: 'Not a wholesale customer'
      });
      return cors(request, response);
    }

    const customer = result.rows[0];

    const response = json({
      success: true,
      isWholesale: true,
      approved: customer.wholesale_approved,
      customerTags: JSON.parse(customer.customer_tags || '[]'),
      hasNetTerms: customer.available_credit !== null,
      creditAvailable: customer.available_credit ? parseFloat(customer.available_credit) : null,
      netTermsStatus: customer.net_terms_status || null,
      customerId: customer.id,
      portalUrl: `/retailer?shop=${shopDomain}` // Link to retailer portal
    });

    return cors(request, response);
  } catch (error) {
    console.error('Retailer session check error:', error);
    const response = json(
      { error: 'Failed to check retailer session', message: error.message },
      { status: 500 }
    );
    return cors(request, response);
  }
};
