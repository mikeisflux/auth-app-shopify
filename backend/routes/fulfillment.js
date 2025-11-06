// fulfillment.js - Standalone Fulfillment Routes (Separate from Kickstarter Import)
// Location: /backend/routes/fulfillment.js

const express = require('express');
const router = express.Router();
const { VerificationLog } = require('../models');
require('dotenv').config();

// Middleware to validate session - FOR CUSTOM APP
const validateSession = async (req, res, next) => {
  req.shopifySession = {
    shop: process.env.SHOPIFY_STORE_URL,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN
  };
  next();
};

// Get all unfulfilled paid orders from Shopify
router.get('/orders/ready-to-ship', validateSession, async (req, res) => {
  try {
    const { fetchReadyToShipOrders } = require('../services/shopifyFulfillment');
    
    const orders = await fetchReadyToShipOrders();
    
    console.log(`Found ${orders.length} orders ready to ship`);
    
    res.json({
      success: true,
      orders: orders,
      count: orders.length
    });
    
  } catch (error) {
    console.error('Failed to fetch ready-to-ship orders:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to fetch orders: ${error.message}` 
    });
  }
});

// Get single order details for fulfillment
router.get('/orders/:orderId', validateSession, async (req, res) => {
  try {
    const { getOrderForFulfillment } = require('../services/shopifyFulfillment');
    
    const order = await getOrderForFulfillment(req.params.orderId);
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found' 
      });
    }
    
    // Get verification status for this order
    const verifiedItems = await VerificationLog.findAll({
      where: { orderId: req.params.orderId }
    });
    
    res.json({
      success: true,
      order: order,
      verifiedItems: verifiedItems.map(v => ({
        lineItemId: v.lineItemId,
        sku: v.sku,
        scannedAt: v.scannedAt,
        scannedBarcode: v.scannedBarcode
      }))
    });
    
  } catch (error) {
    console.error(`Failed to fetch order ${req.params.orderId}:`, error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to fetch order: ${error.message}` 
    });
  }
});

// Verify scanned barcode against order line item
router.post('/verify-scan', validateSession, async (req, res) => {
  const { orderId, scannedBarcode } = req.body;
  
  if (!orderId || !scannedBarcode) {
    return res.status(400).json({ 
      success: false, 
      error: 'orderId and scannedBarcode are required' 
    });
  }
  
  try {
    const { verifyBarcode } = require('../services/shopifyFulfillment');
    
    const result = await verifyBarcode(orderId, scannedBarcode);
    
    if (result.success) {
      // Save verification to database
      await VerificationLog.create({
        orderId: orderId,
        lineItemId: result.lineItem.id.toString(),
        sku: result.lineItem.sku,
        scannedBarcode: scannedBarcode,
        scannedAt: new Date(),
        verifiedBy: null,
        scannerId: req.headers['user-agent'] || 'unknown'
      });
      
      console.log(`✓ Verified: ${result.lineItem.title} (SKU: ${result.lineItem.sku}) for order ${orderId}`);
      
      res.json({
        success: true,
        lineItem: result.lineItem,
        message: `✓ Verified: ${result.lineItem.title}`,
        remainingItems: result.remainingItems
      });
    } else {
      console.log(`✗ Barcode not found in order ${orderId}: ${scannedBarcode}`);
      
      res.json({
        success: false,
        message: result.message || '✗ Item not found in this order',
        suggestions: result.suggestions || []
      });
    }
    
  } catch (error) {
    console.error('Barcode verification error:', error);
    res.status(500).json({ 
      success: false, 
      error: `Verification failed: ${error.message}` 
    });
  }
});

// Clear all verifications for an order (restart scanning)
router.post('/orders/:orderId/clear-verifications', validateSession, async (req, res) => {
  try {
    await VerificationLog.destroy({
      where: { orderId: req.params.orderId }
    });
    
    console.log(`Cleared all verifications for order ${req.params.orderId}`);
    
    res.json({
      success: true,
      message: 'All verifications cleared for this order'
    });
    
  } catch (error) {
    console.error('Failed to clear verifications:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to clear verifications: ${error.message}` 
    });
  }
});

// Mark order as ready for label printing (all items verified)
router.post('/orders/:orderId/ready-for-label', validateSession, async (req, res) => {
  try {
    const { getOrderForFulfillment } = require('../services/shopifyFulfillment');
    
    // Verify all items are scanned
    const order = await getOrderForFulfillment(req.params.orderId);
    const verifiedItems = await VerificationLog.findAll({
      where: { orderId: req.params.orderId }
    });
    
    const totalItemsToVerify = order.line_items.reduce((sum, item) => sum + item.quantity, 0);
    const verifiedCount = verifiedItems.length;
    
    if (verifiedCount < totalItemsToVerify) {
      return res.status(400).json({
        success: false,
        error: `Only ${verifiedCount} of ${totalItemsToVerify} items verified`,
        verified: verifiedCount,
        required: totalItemsToVerify
      });
    }
    
    console.log(`Order ${req.params.orderId} is ready for label printing - all ${totalItemsToVerify} items verified`);
    
    res.json({
      success: true,
      message: 'Order ready for label printing',
      orderId: req.params.orderId,
      itemsVerified: verifiedCount
    });
    
  } catch (error) {
    console.error('Failed to mark order as ready:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to mark order as ready: ${error.message}` 
    });
  }
});

// Get fulfillment stats
router.get('/stats', validateSession, async (req, res) => {
  try {
    const { fetchReadyToShipOrders } = require('../services/shopifyFulfillment');
    
    const readyOrders = await fetchReadyToShipOrders();
    
    // Count orders with some verifications
    const ordersInProgress = await VerificationLog.findAll({
      attributes: ['orderId'],
      group: ['orderId']
    });
    
    res.json({
      success: true,
      stats: {
        readyToShip: readyOrders.length,
        inProgress: ordersInProgress.length,
        totalItems: readyOrders.reduce((sum, order) => {
          return sum + order.line_items.reduce((itemSum, item) => itemSum + item.quantity, 0);
        }, 0)
      }
    });
    
  } catch (error) {
    console.error('Failed to fetch fulfillment stats:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to fetch stats: ${error.message}` 
    });
  }
});

module.exports = router;