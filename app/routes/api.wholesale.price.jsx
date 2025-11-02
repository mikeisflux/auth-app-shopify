// Storefront API - Get Wholesale Price for Product
import { json } from "@remix-run/node";
import { cors } from "remix-utils/cors";
import { PricingEngine } from "../services/pricing-engine.server";

/**
 * PUBLIC API ENDPOINT for storefront price display
 *
 * Usage from storefront:
 * GET /api/wholesale/price?shop=store.myshopify.com&productId=123&variantId=456&customerId=789&quantity=1
 *
 * Returns: { originalPrice, finalPrice, discount, discountPercentage, rulesApplied }
 */
export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get('shop');
  const productId = url.searchParams.get('productId');
  const variantId = url.searchParams.get('variantId');
  const retailPrice = parseFloat(url.searchParams.get('price'));
  const customerId = url.searchParams.get('customerId');
  const quantity = parseInt(url.searchParams.get('quantity') || '1');
  const customerTags = url.searchParams.get('tags')?.split(',') || [];
  const collectionIds = url.searchParams.get('collections')?.split(',') || [];

  // Validate required params
  if (!shopDomain || !productId || !variantId || isNaN(retailPrice)) {
    const response = json(
      { error: 'Missing required parameters: shop, productId, variantId, price' },
      { status: 400 }
    );
    return cors(request, response);
  }

  try {
    const pricing = await PricingEngine.calculatePrice({
      shopDomain,
      retailPrice,
      productId: parseInt(productId),
      variantId: parseInt(variantId),
      customerTags,
      quantity,
      collectionIds
    });

    const response = json({
      success: true,
      pricing: {
        originalPrice: pricing.originalPrice,
        finalPrice: pricing.finalPrice,
        discount: pricing.discount,
        discountPercentage: pricing.discountPercentage,
        savings: pricing.discount,
        hasDiscount: pricing.discount > 0,
        rulesApplied: pricing.rulesApplied.map(r => ({
          id: r.id,
          name: r.name,
          type: r.rule_type,
          discount: `${r.discount_value}${r.discount_type === 'percentage' ? '%' : ''}`
        }))
      }
    });

    return cors(request, response);
  } catch (error) {
    console.error('Price calculation error:', error);
    const response = json(
      { error: 'Failed to calculate price', message: error.message },
      { status: 500 }
    );
    return cors(request, response);
  }
};
