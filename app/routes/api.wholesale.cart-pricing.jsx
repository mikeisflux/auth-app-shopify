// Storefront API - Calculate Pricing for Entire Cart
import { json } from "@remix-run/node";
import { cors } from "remix-utils/cors";
import { PricingEngine } from "../services/pricing-engine.server";

/**
 * PUBLIC API ENDPOINT for cart-level pricing
 *
 * Usage from storefront:
 * POST /api/wholesale/cart-pricing
 * Body: {
 *   shop: "store.myshopify.com",
 *   customerTags: ["wholesale", "vip"],
 *   items: [
 *     {
 *       product_id: 123,
 *       variant_id: 456,
 *       price: 100.00,
 *       quantity: 2,
 *       collection_ids: ["789"]
 *     }
 *   ]
 * }
 *
 * Returns: { items (with pricing), subtotal, totalDiscount, originalSubtotal }
 */
export const action = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      shop,
      customerTags = [],
      items = []
    } = body;

    if (!shop || !items || items.length === 0) {
      const response = json(
        { error: 'Missing required parameters: shop, items' },
        { status: 400 }
      );
      return cors(request, response);
    }

    const cartPricing = await PricingEngine.calculateCartPricing(
      shop,
      items,
      customerTags
    );

    const response = json({
      success: true,
      cart: {
        items: cartPricing.items.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          originalPrice: item.originalPrice,
          finalPrice: item.finalPrice,
          discount: item.discount,
          discountPercentage: item.discountPercentage,
          quantity: item.quantity,
          lineTotal: item.finalPrice * item.quantity,
          savings: item.discount * item.quantity
        })),
        subtotal: cartPricing.subtotal,
        originalSubtotal: cartPricing.originalSubtotal,
        totalDiscount: cartPricing.totalDiscount,
        totalSavings: cartPricing.totalDiscount,
        savingsPercentage: cartPricing.originalSubtotal > 0
          ? ((cartPricing.totalDiscount / cartPricing.originalSubtotal) * 100).toFixed(2)
          : '0'
      }
    });

    return cors(request, response);
  } catch (error) {
    console.error('Cart pricing error:', error);
    const response = json(
      { error: 'Failed to calculate cart pricing', message: error.message },
      { status: 500 }
    );
    return cors(request, response);
  }
};
