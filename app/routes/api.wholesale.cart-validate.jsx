// Storefront API - Validate Cart Against Order Limits
import { json } from "@remix-run/node";
import { cors } from "remix-utils/cors";
import { PricingEngine } from "../services/pricing-engine.server";

/**
 * PUBLIC API ENDPOINT for cart validation
 *
 * Usage from storefront:
 * POST /api/wholesale/cart-validate
 * Body: {
 *   shop: "store.myshopify.com",
 *   customerId: 123,
 *   customerTags: ["wholesale"],
 *   cartTotal: 150.00,
 *   cartItems: 10,
 *   cartWeight: 5.5,
 *   isFirstOrder: false
 * }
 *
 * Returns: { valid, violations, shouldBlock, messages }
 */
export const action = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      shop,
      customerId,
      customerTags = [],
      cartTotal,
      cartItems,
      cartWeight,
      isFirstOrder = false
    } = body;

    if (!shop || cartTotal === undefined || cartItems === undefined) {
      const response = json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
      return cors(request, response);
    }

    const validation = await PricingEngine.validateOrderLimits({
      shopDomain: shop,
      customerTags,
      cartTotal: parseFloat(cartTotal),
      cartItems: parseInt(cartItems),
      cartWeight: parseFloat(cartWeight || 0),
      isFirstOrder
    });

    const response = json({
      success: true,
      validation: {
        valid: validation.valid,
        shouldBlock: validation.shouldBlock,
        canProceed: !validation.shouldBlock,
        violations: validation.violations.map(v => ({
          message: v.message,
          action: v.action,
          limitName: v.limitName
        })),
        messages: validation.violations.map(v => v.message)
      }
    });

    return cors(request, response);
  } catch (error) {
    console.error('Cart validation error:', error);
    const response = json(
      { error: 'Failed to validate cart', message: error.message },
      { status: 500 }
    );
    return cors(request, response);
  }
};
