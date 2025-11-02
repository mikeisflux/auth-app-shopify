// API endpoint for individual variant wholesale pricing
import { json } from "@remix-run/node";
import { cors } from "remix-utils/cors";
import { query } from "../db/connection.server";

/**
 * PUBLIC API ENDPOINT for getting individual variant pricing
 *
 * Usage from storefront (Liquid theme):
 * fetch('/api/wholesale/variant-price?shop={{ shop.domain }}&variantId={{ variant.id }}&retailPrice={{ variant.price }}&customerTags=wholesale,tier1')
 *
 * Returns: { originalPrice, finalPrice, discount, discountPercentage, hasDiscount, pricingSource }
 */
export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get('shop');
  const variantId = url.searchParams.get('variantId');
  const retailPrice = parseFloat(url.searchParams.get('retailPrice') || '0');
  const customerTags = url.searchParams.get('customerTags') || '';

  if (!shopDomain || !variantId) {
    const response = json(
      { error: 'Missing required parameters: shop, variantId' },
      { status: 400 }
    );
    return cors(request, response);
  }

  try {
    // Check for individual variant pricing
    const result = await query(
      `SELECT ivp.*
       FROM individual_variant_pricing ivp
       INNER JOIN shops s ON ivp.shop_id = s.id
       WHERE s.shop_domain = $1
         AND ivp.variant_id = $2
         AND (
           ivp.customer_tags IS NULL
           OR ivp.customer_tags = ''
           OR $3 LIKE '%' || ivp.customer_tags || '%'
         )
       LIMIT 1`,
      [shopDomain, variantId, customerTags]
    );

    if (result.rows.length === 0) {
      // No individual variant pricing found
      const response = json({
        success: true,
        hasDiscount: false,
        originalPrice: retailPrice,
        finalPrice: retailPrice,
        discount: 0,
        discountPercentage: 0,
        pricingSource: 'retail'
      });
      return cors(request, response);
    }

    const pricing = result.rows[0];
    let wholesalePrice = retailPrice;

    // Calculate wholesale price based on discount type
    switch (pricing.discount_type) {
      case 'percentage':
        wholesalePrice = retailPrice * (1 - (pricing.discount_value / 100));
        break;
      case 'fixed_amount':
        wholesalePrice = Math.max(0, retailPrice - pricing.discount_value);
        break;
      case 'fixed_price':
        wholesalePrice = pricing.discount_value;
        break;
    }

    const discount = retailPrice - wholesalePrice;
    const discountPercentage = retailPrice > 0 ? (discount / retailPrice * 100) : 0;

    const response = json({
      success: true,
      hasDiscount: discount > 0,
      originalPrice: parseFloat(retailPrice.toFixed(2)),
      finalPrice: parseFloat(wholesalePrice.toFixed(2)),
      discount: parseFloat(discount.toFixed(2)),
      discountPercentage: parseFloat(discountPercentage.toFixed(2)),
      pricingSource: 'individual_variant',
      discountType: pricing.discount_type,
      discountValue: pricing.discount_value,
      sku: pricing.sku
    });

    return cors(request, response);
  } catch (error) {
    console.error('Variant pricing error:', error);
    const response = json(
      { error: 'Failed to get variant pricing', message: error.message },
      { status: 500 }
    );
    return cors(request, response);
  }
};
