// shopifyFulfillment.js - Standalone Fulfillment Service
// Location: /backend/services/shopifyFulfillment.js

const fetch = require('node-fetch');
require('dotenv').config();

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = '2024-10';

/**
 * Fetch all paid, unfulfilled orders ready to ship
 */
async function fetchReadyToShipOrders() {
  try {
    console.log('Fetching paid, unfulfilled orders from Shopify...');
    
    const allOrders = [];
    let nextPageUrl = `https://${SHOPIFY_STORE_URL}/admin/api/${API_VERSION}/orders.json?status=any&financial_status=paid&fulfillment_status=unfulfilled&limit=250`;
    let pageCount = 0;
    
    while (nextPageUrl && pageCount < 20) {
      pageCount++;
      
      const response = await fetch(nextPageUrl, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.orders && data.orders.length > 0) {
        allOrders.push(...data.orders);
      }
      
      // Check for next page
      const linkHeader = response.headers.get('link');
      nextPageUrl = null;
      if (linkHeader) {
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (nextMatch) {
          nextPageUrl = nextMatch[1];
        }
      }
    }
    
    console.log(`Fetched ${allOrders.length} orders ready to ship`);
    return allOrders;
    
  } catch (error) {
    console.error('Failed to fetch ready-to-ship orders:', error);
    throw error;
  }
}

/**
 * Get single order details for fulfillment
 */
async function getOrderForFulfillment(orderId) {
  try {
    const response = await fetch(
      `https://${SHOPIFY_STORE_URL}/admin/api/${API_VERSION}/orders/${orderId}.json`,
      {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return data.order;
    
  } catch (error) {
    console.error(`Failed to fetch order ${orderId}:`, error);
    throw error;
  }
}

/**
 * Verify scanned barcode matches an item in the order
 */
async function verifyBarcode(orderId, scannedBarcode) {
  try {
    const order = await getOrderForFulfillment(orderId);
    
    if (!order) {
      return {
        success: false,
        message: 'Order not found'
      };
    }
    
    // Try to find matching line item by SKU or barcode
    const matchedItem = order.line_items.find(item => {
      // Check SKU
      if (item.sku && item.sku.toLowerCase() === scannedBarcode.toLowerCase()) {
        return true;
      }
      
      // Check barcode field (if available)
      if (item.barcode && item.barcode === scannedBarcode) {
        return true;
      }
      
      // Check variant barcode
      if (item.variant_id) {
        // In a real implementation, you'd fetch the variant details
        // For now, we'll rely on SKU matching
        return false;
      }
      
      return false;
    });
    
    if (matchedItem) {
      // Calculate remaining items to scan
      const { VerificationLog } = require('../models');
      const verifiedCount = await VerificationLog.count({
        where: { orderId: orderId }
      });
      
      const totalItems = order.line_items.reduce((sum, item) => sum + item.quantity, 0);
      
      return {
        success: true,
        lineItem: matchedItem,
        remainingItems: totalItems - (verifiedCount + 1)
      };
    } else {
      // No match found - provide suggestions
      const suggestions = order.line_items
        .filter(item => item.sku)
        .map(item => ({
          sku: item.sku,
          title: item.title,
          quantity: item.quantity
        }));
      
      return {
        success: false,
        message: `Barcode "${scannedBarcode}" not found in order ${order.name}`,
        suggestions: suggestions
      };
    }
    
  } catch (error) {
    console.error('Barcode verification error:', error);
    throw error;
  }
}

/**
 * Create fulfillment for an order in Shopify
 */
async function fulfillOrder(orderId, trackingInfo = {}) {
  try {
    const order = await getOrderForFulfillment(orderId);
    
    // Prepare line items for fulfillment
    const lineItems = order.line_items.map(item => ({
      id: item.id,
      quantity: item.quantity
    }));
    
    const fulfillmentData = {
      fulfillment: {
        location_id: order.location_id || null,
        tracking_number: trackingInfo.trackingNumber || '',
        tracking_company: trackingInfo.trackingCompany || '',
        tracking_url: trackingInfo.trackingUrl || '',
        notify_customer: trackingInfo.notifyCustomer !== false,
        line_items: lineItems
      }
    };
    
    const response = await fetch(
      `https://${SHOPIFY_STORE_URL}/admin/api/${API_VERSION}/orders/${orderId}/fulfillments.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fulfillmentData)
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      fulfillment: data.fulfillment
    };
    
  } catch (error) {
    console.error('Failed to fulfill order:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  fetchReadyToShipOrders,
  getOrderForFulfillment,
  verifyBarcode,
  fulfillOrder
};