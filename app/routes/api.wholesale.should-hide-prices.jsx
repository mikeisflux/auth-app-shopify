// API endpoint to check if prices should be hidden
import { json } from "@remix-run/node";
import { cors } from "remix-utils/cors";
import { query } from "../db/connection.server";

/**
 * PUBLIC API ENDPOINT for checking if prices should be hidden
 *
 * Usage from storefront (Liquid theme):
 * fetch('/api/wholesale/should-hide-prices?shop={{ shop.domain }}&logged_in={% if customer %}true{% else %}false{% endif %}')
 *
 * Returns: { shouldHide, message, buttonText }
 */
export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get('shop');
  const loggedIn = url.searchParams.get('logged_in') === 'true';

  if (!shopDomain) {
    const response = json(
      { error: 'Missing required parameter: shop' },
      { status: 400 }
    );
    return cors(request, response);
  }

  try {
    // Get hide prices settings
    const result = await query(
      `SELECT hps.*
       FROM hide_prices_settings hps
       INNER JOIN shops s ON hps.shop_id = s.id
       WHERE s.shop_domain = $1`,
      [shopDomain]
    );

    if (result.rows.length === 0) {
      const response = json({
        success: true,
        shouldHide: false,
        enabled: false,
        message: 'Feature not configured'
      });
      return cors(request, response);
    }

    const settings = result.rows[0];

    // If feature is disabled, don't hide
    if (!settings.enabled) {
      const response = json({
        success: true,
        shouldHide: false,
        enabled: false
      });
      return cors(request, response);
    }

    // If user is logged in, don't hide
    if (loggedIn) {
      const response = json({
        success: true,
        shouldHide: false,
        enabled: true,
        userLoggedIn: true
      });
      return cors(request, response);
    }

    // Hide prices for non-logged-in users
    const response = json({
      success: true,
      shouldHide: true,
      enabled: true,
      hideAddToCart: settings.hide_add_to_cart,
      message: settings.custom_message,
      buttonText: settings.button_text,
      loginUrl: '/account/login'
    });

    return cors(request, response);
  } catch (error) {
    console.error('Hide prices check error:', error);
    const response = json(
      { error: 'Failed to check hide prices settings', message: error.message },
      { status: 500 }
    );
    return cors(request, response);
  }
};
