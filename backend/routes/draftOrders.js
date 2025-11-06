// Draft Orders Routes - Mark as Paid functionality
// Location: /backend/routes/draftOrders.js

const express = require('express');
const router = express.Router();
const { fetchOpenDraftOrders, markDraftOrdersAsPaid } = require('../services/shopify');
const logger = require('../services/logger');

/**
 * GET /api/draft-orders/open
 * Fetch all open draft orders from Shopify
 */
router.get('/open', async (req, res) => {
  try {
    logger.info('Fetching open draft orders from Shopify...');

    const draftOrders = await fetchOpenDraftOrders();

    // Transform the draft orders to include all necessary information
    const transformedOrders = draftOrders.map(order => {
      // Calculate total items
      const totalItems = order.line_items.reduce((sum, item) => sum + item.quantity, 0);

      // Get customer name
      const customerName = order.customer
        ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
        : order.billing_address
          ? `${order.billing_address.first_name || ''} ${order.billing_address.last_name || ''}`.trim()
          : 'Unknown';

      return {
        id: order.id,
        name: order.name,
        orderNumber: order.order_number || order.name,
        email: order.email,
        customerName: customerName,
        customerId: order.customer?.id,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        totalPrice: order.total_price,
        subtotalPrice: order.subtotal_price,
        totalTax: order.total_tax,
        currency: order.currency,
        status: order.status,
        lineItems: order.line_items.map(item => ({
          id: item.id,
          variantId: item.variant_id,
          productId: item.product_id,
          title: item.title,
          variantTitle: item.variant_title,
          sku: item.sku,
          quantity: item.quantity,
          price: item.price,
          vendor: item.vendor,
          requiresShipping: item.requires_shipping,
          taxable: item.taxable,
          name: item.name
        })),
        totalItems: totalItems,
        shippingAddress: order.shipping_address,
        billingAddress: order.billing_address,
        note: order.note,
        tags: order.tags,
        taxExempt: order.tax_exempt,
        invoiceUrl: order.invoice_url,
        invoiceSentAt: order.invoice_sent_at,
        completedAt: order.completed_at
      };
    });

    logger.info(`Successfully fetched ${transformedOrders.length} open draft orders`);

    res.json({
      success: true,
      count: transformedOrders.length,
      draftOrders: transformedOrders
    });

  } catch (error) {
    logger.error(`Error fetching open draft orders: ${error.message}`);
    console.error('Full error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/draft-orders/mark-as-paid
 * Mark selected draft orders as paid (complete them)
 * Body: { draftOrderIds: [id1, id2, ...] }
 */
router.post('/mark-as-paid', async (req, res) => {
  try {
    const { draftOrderIds } = req.body;

    if (!draftOrderIds || !Array.isArray(draftOrderIds) || draftOrderIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'draftOrderIds array is required'
      });
    }

    logger.info(`Marking ${draftOrderIds.length} draft orders as paid...`);

    const results = await markDraftOrdersAsPaid(draftOrderIds);

    res.json({
      success: true,
      results: results,
      summary: {
        total: draftOrderIds.length,
        successful: results.success.length,
        failed: results.failed.length
      }
    });

  } catch (error) {
    logger.error(`Error marking draft orders as paid: ${error.message}`);
    console.error('Full error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
