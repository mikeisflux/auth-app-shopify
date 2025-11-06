// Customer Merge Routes - Fixed to only process unfulfilled orders
// Location: /backend/routes/customerMerge.js

const express = require('express');
const router = express.Router();
const { 
  fetchAllShopifyOrders, 
  identifyDuplicateCustomers, 
  mergeCustomerOrders,
  getCustomerMergePreview 
} = require('../services/shopify');

// Middleware for session validation - FOR CUSTOM APP
const validateSession = async (req, res, next) => {
  // For custom apps, always use the permanent access token from .env
  req.shopifySession = {
    shop: process.env.SHOPIFY_STORE_URL,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN
  };
  next();
};

// GET unfulfilled Shopify orders for customer analysis
router.get('/shopify-orders', validateSession, async (req, res) => {
  try {
    console.log('GET /api/customer-merge/shopify-orders - Fetching unfulfilled Shopify orders');
    
    // Only fetch unfulfilled orders
    const orders = await fetchAllShopifyOrders('unfulfilled');
    
    console.log(`Found ${orders.length} unfulfilled orders`);
    
    res.json({
      success: true,
      orders: orders,
      total: orders.length,
      note: 'Only unfulfilled orders are included for merging'
    });
    
  } catch (error) {
    console.error('Error fetching Shopify orders:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Shopify orders',
      message: error.message 
    });
  }
});

// GET duplicate customers analysis (unfulfilled orders only)
router.get('/duplicate-customers', validateSession, async (req, res) => {
  try {
    console.log('GET /api/customer-merge/duplicate-customers - Analyzing duplicate customers (unfulfilled orders only)');
    
    // Fetch only unfulfilled orders
    const orders = await fetchAllShopifyOrders('unfulfilled');
    console.log(`Analyzing ${orders.length} unfulfilled orders for duplicates`);
    
    // Identify duplicates among unfulfilled orders
    const analysis = identifyDuplicateCustomers(orders);
    
    // Only include customers with multiple unfulfilled orders
    const duplicatesWithMultipleUnfulfilled = analysis.duplicateCustomers.filter(customer => 
      customer.orderCount > 1
    );
    
    console.log(`Found ${duplicatesWithMultipleUnfulfilled.length} customers with multiple unfulfilled orders`);
    
    res.json({
      success: true,
      analysis: {
        ...analysis,
        duplicateCustomers: duplicatesWithMultipleUnfulfilled
      },
      summary: {
        totalUnfulfilledOrders: orders.length,
        totalCustomersWithUnfulfilled: analysis.totalCustomers,
        customersWithMultipleUnfulfilled: duplicatesWithMultipleUnfulfilled.length,
        potentialConsolidations: duplicatesWithMultipleUnfulfilled.reduce((sum, customer) => {
          return sum + (customer.orderCount - 1); // One less order per duplicate customer
        }, 0)
      },
      note: 'Analysis includes only unfulfilled orders eligible for merging'
    });
    
  } catch (error) {
    console.error('Error analyzing duplicate customers:', error);
    res.status(500).json({ 
      error: 'Failed to analyze duplicate customers',
      message: error.message 
    });
  }
});

// POST get merge preview for a customer (unfulfilled orders only)
router.post('/merge-preview', validateSession, async (req, res) => {
  try {
    const { email, orderIds } = req.body;
    
    if (!email || !orderIds || !Array.isArray(orderIds)) {
      return res.status(400).json({ 
        error: 'Email and orderIds array required' 
      });
    }
    
    console.log(`POST /api/customer-merge/merge-preview - Getting preview for ${email} (unfulfilled orders)`);
    
    // Validate that all provided orders are unfulfilled
    const orders = await fetchAllShopifyOrders('unfulfilled');
    const unfulfilledOrderIds = new Set(orders.map(order => order.id));
    
    const invalidOrderIds = orderIds.filter(id => !unfulfilledOrderIds.has(id));
    
    if (invalidOrderIds.length > 0) {
      return res.status(400).json({
        error: 'Some orders are not unfulfilled and cannot be merged',
        invalidOrderIds: invalidOrderIds
      });
    }
    
    const preview = await getCustomerMergePreview(email, orderIds);
    
    res.json({
      success: true,
      preview: {
        ...preview,
        fulfillmentStatus: 'unfulfilled',
        note: 'Preview includes only unfulfilled orders'
      }
    });
    
  } catch (error) {
    console.error('Error generating merge preview:', error);
    res.status(500).json({ 
      error: 'Failed to generate merge preview',
      message: error.message 
    });
  }
});

// POST merge customer orders (unfulfilled orders only)
router.post('/merge-customer', validateSession, async (req, res) => {
  try {
    const { email, orderIds } = req.body;
    
    if (!email || !orderIds || !Array.isArray(orderIds)) {
      return res.status(400).json({ 
        error: 'Email and orderIds array required' 
      });
    }
    
    console.log(`POST /api/customer-merge/merge-customer - Merging unfulfilled orders for ${email}`);
    
    // Validate that all provided orders are unfulfilled
    const orders = await fetchAllShopifyOrders('unfulfilled');
    const unfulfilledOrderIds = new Set(orders.map(order => order.id));
    
    const invalidOrderIds = orderIds.filter(id => !unfulfilledOrderIds.has(id));
    
    if (invalidOrderIds.length > 0) {
      return res.status(400).json({
        error: 'Some orders are fulfilled and cannot be merged',
        invalidOrderIds: invalidOrderIds,
        note: 'Only unfulfilled orders can be merged'
      });
    }
    
    if (orderIds.length < 2) {
      return res.status(400).json({
        error: 'At least 2 unfulfilled orders are required for merging'
      });
    }
    
    const mergeResult = await mergeCustomerOrders(email, orderIds);
    
    res.json({
      success: true,
      message: `Successfully merged ${mergeResult.totalOrders} unfulfilled orders for ${email}`,
      mergeResult: {
        ...mergeResult,
        fulfillmentStatus: 'unfulfilled',
        note: 'Merged unfulfilled orders only'
      }
    });
    
  } catch (error) {
    console.error('Error merging customer orders:', error);
    res.status(500).json({ 
      error: 'Failed to merge customer orders',
      message: error.message 
    });
  }
});

module.exports = router;