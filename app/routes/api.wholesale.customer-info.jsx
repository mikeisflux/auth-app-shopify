// Storefront API - Get Customer Wholesale Info
import { json } from "@remix-run/node";
import { cors } from "remix-utils/cors";
import { WholesaleModel } from "../models/wholesale.server";

/**
 * PUBLIC API ENDPOINT for customer wholesale information
 *
 * Usage from storefront:
 * GET /api/wholesale/customer-info?shop=store.myshopify.com&customerId=123
 *
 * Returns: { isWholesale, approved, tags, hasAccess }
 */
export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get('shop');
  const customerId = url.searchParams.get('customerId');
  const email = url.searchParams.get('email');

  if (!shopDomain || (!customerId && !email)) {
    const response = json(
      { error: 'Missing required parameters: shop and (customerId or email)' },
      { status: 400 }
    );
    return cors(request, response);
  }

  try {
    let customer;

    if (customerId) {
      customer = await WholesaleModel.getWholesaleCustomerByShopifyId(
        parseInt(customerId),
        shopDomain
      );
    } else if (email) {
      const result = await query(
        `SELECT wc.*
         FROM wholesale_customers wc
         INNER JOIN shops s ON wc.shop_id = s.id
         WHERE s.shop_domain = $1 AND wc.email = $2`,
        [shopDomain, email]
      );
      customer = result.rows[0];
    }

    if (!customer) {
      const response = json({
        success: true,
        customer: null,
        isWholesale: false,
        approved: false,
        hasAccess: false,
        tags: [],
        message: 'Customer not in wholesale system'
      });
      return cors(request, response);
    }

    const tags = JSON.parse(customer.customer_tags || '[]');

    const response = json({
      success: true,
      customer: {
        email: customer.email,
        isWholesale: true,
        approved: customer.wholesale_approved,
        hasAccess: customer.wholesale_approved,
        tags: tags,
        orderCount: customer.order_count,
        totalSpent: parseFloat(customer.total_spent)
      }
    });

    return cors(request, response);
  } catch (error) {
    console.error('Customer info error:', error);
    const response = json(
      { error: 'Failed to fetch customer info', message: error.message },
      { status: 500 }
    );
    return cors(request, response);
  }
};
