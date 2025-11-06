// Import routes with fixed validateSession for Custom App
// Location: /backend/routes/import.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Project, Backer, Mapping } = require('../models');
const { parseAndStore, exportToCSV } = require('../services/csvParser');
require('dotenv').config();

const upload = multer({ storage: multer.memoryStorage() });

// Middleware to validate session - FOR CUSTOM APP
const validateSession = async (req, res, next) => {
  // For custom apps, always use the permanent access token from .env
  req.shopifySession = {
    shop: process.env.SHOPIFY_STORE_URL,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN
  };
  next();
};

// Upload CSV file
router.post('/project/:id/upload', validateSession, upload.single('csv'), async (req, res) => {
  const { id: projectId } = req.params;
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Clear existing backers to avoid duplicates on re-upload
    await Backer.destroy({ where: { projectId } });
    console.log('Cleared existing backers for project', projectId);

    // Parse and store CSV (this will save backers to DB)
    const result = await parseAndStore(req.file.buffer, req.file.originalname, projectId);
    
    // Update project with CSV file reference
    await project.update({ 
      csvFile: result.fileName,
      csvFilePath: result.filePath 
    });
    
    // DON'T create backers again - parseAndStore already saved them
    // Just fetch what was saved
    const backerRecords = await Backer.findAll({
      where: { projectId },
      order: [['backerNumber', 'ASC']]
    });
    
    res.json({
      success: true,
      fileName: result.fileName,
      backersCount: backerRecords.length,
      backers: backerRecords
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: `Upload failed: ${error.message}` });
  }
});

// Get backers for preview
router.get('/project/:id/backers', validateSession, async (req, res) => {
  try {
    const backers = await Backer.findAll({ 
      where: { projectId: req.params.id },
      order: [['backerNumber', 'ASC']]
    });
    res.json(backers);
  } catch (error) {
    console.error('Get backers error:', error);
    res.status(500).json({ error: `Failed to get backers: ${error.message}` });
  }
});

// Import orders to Shopify
router.post('/project/:id/import', validateSession, async (req, res) => {
  const { selectedBackerIds, backerIds } = req.body;
  const ids = selectedBackerIds || backerIds || [];
  const projectId = req.params.id;
  
  console.log('Import request received:', { 
    projectId: projectId, 
    backerCount: ids.length,
    receivedIds: ids
  });
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ 
      error: 'No backers selected for import' 
    });
  }
  
  try {
    // Check if we have Shopify service available
    let shopifyService = null;
    try {
      shopifyService = require('../services/shopify');
      console.log('Shopify service loaded successfully');
    } catch (e) {
      console.log('Shopify service not available, using mock import:', e.message);
    }
    
    // Check if we should use importOrders (batch) or process individually
    if (shopifyService && shopifyService.importOrders) {
      // Use the importOrders function for batch processing
      console.log('Using importOrders for batch processing');
      
      const results = await shopifyService.importOrders(
        req.shopifySession,
        projectId,
        ids
      );
      
      res.json({
        success: true,
        message: `Imported ${results.success.length} of ${ids.length} backers`,
        results: {
          successful: results.success.length,
          failed: results.failed.length,
          errors: results.failed,
          orders: results.success
        }
      });
      
    } else {
      // Fallback to individual processing (your original logic)
      console.log('Using individual order processing');
      
      // Get the selected backers
      const backers = await Backer.findAll({
        where: { 
          id: ids,
          projectId: projectId 
        }
      });
      
      if (backers.length === 0) {
        return res.status(404).json({ 
          error: 'No backers found with provided IDs' 
        });
      }
      
      console.log(`Found ${backers.length} backers to import`);
      
      // Get mappings for this project
      const mappings = await Mapping.findAll({
        where: { projectId: projectId }
      });
      
      console.log(`Found ${mappings.length} product mappings`);
      
      // Import results tracking
      const results = {
        successful: 0,
        failed: 0,
        errors: [],
        orders: []
      };
      
      // Process each backer
      for (const backer of backers) {
        try {
          // Check if createOrder function exists
          if (shopifyService && shopifyService.createOrder) {
            // Real Shopify import using createOrder
            const orderData = {
              email: backer.email,
              name: backer.name,
              firstName: backer.name ? backer.name.split(' ')[0] : '',
              lastName: backer.name ? backer.name.split(' ').slice(1).join(' ') : '',
              backerNumber: backer.backerNumber,
              items: [],
              shippingAddress: backer.shippingAddress,
              shippingAddress1: backer.shippingAddress1,
              shippingAddress2: backer.shippingAddress2,
              shippingCity: backer.shippingCity,
              shippingState: backer.shippingState,
              shippingPostalCode: backer.shippingPostalCode,
              shippingCountry: backer.shippingCountry,
              shippingPhone: backer.shippingPhone,
              notes: backer.notes || `Kickstarter Backer #${backer.backerNumber}`,
              pledgeAmount: backer.pledgeAmount
            };
            
            // Add products from "Count" columns if they exist
            if (backer.products && Object.keys(backer.products).length > 0) {
              for (const [sku, product] of Object.entries(backer.products)) {
                const mapping = mappings.find(m => 
                  m.kickstarterName === sku || 
                  (m.skus && m.skus.includes(sku))
                );
                
                if (mapping && mapping.shopifyProductId) {
                  orderData.items.push({
                    variant_id: mapping.shopifyProductId,
                    quantity: product.quantity || 1,
                    price: 0
                  });
                } else {
                  // Use SKU directly if no mapping
                  orderData.items.push({
                    sku: sku,
                    quantity: product.quantity || 1,
                    price: 0,
                    title: product.name || sku
                  });
                }
              }
            }
            
            // If no products, check reward
            if (orderData.items.length === 0 && backer.reward && backer.reward.name) {
              const mapping = mappings.find(m => 
                m.kickstarterName === backer.reward.name || 
                m.kickstarterName === backer.reward.sku
              );
              
              if (mapping && mapping.skus && mapping.skus[0]) {
                orderData.items.push({
                  sku: mapping.skus[0],
                  quantity: backer.reward.quantity || 1,
                  price: backer.pledgeAmount,
                  title: backer.reward.name
                });
              }
            }
            
            // Add add-ons as line items
            if (backer.addOns && Array.isArray(backer.addOns)) {
              for (const addon of backer.addOns) {
                const mapping = mappings.find(m => 
                  m.kickstarterName === addon.name || 
                  m.kickstarterName === addon.sku
                );
                
                if (mapping && mapping.skus && mapping.skus[0]) {
                  orderData.items.push({
                    sku: mapping.skus[0],
                    quantity: addon.quantity || 1,
                    price: 0,
                    title: addon.name || addon.sku
                  });
                } else if (addon.sku) {
                  // Use SKU directly if no mapping
                  orderData.items.push({
                    sku: addon.sku,
                    quantity: addon.quantity || 1,
                    price: 0,
                    title: addon.name || addon.sku
                  });
                }
              }
            }
            
            const orderResult = await shopifyService.createOrder(orderData);
            
            if (orderResult.success) {
              await backer.update({ 
                imported: true,
                importedAt: new Date(),
                shopifyOrderId: orderResult.orderId,
                shopifyOrderNumber: orderResult.orderNumber
              });
              results.successful++;
              results.orders.push({
                backerNumber: backer.backerNumber,
                shopifyOrderNumber: orderResult.orderNumber
              });
            } else {
              throw new Error(orderResult.error || 'Failed to create order');
            }
          } else {
            // Mock import - just mark as imported
            await backer.update({ 
              imported: true,
              importedAt: new Date(),
              shopifyOrderId: `MOCK-${Date.now()}`,
              shopifyOrderNumber: `#MOCK${backer.backerNumber}`
            });
            results.successful++;
            results.orders.push({
              backerNumber: backer.backerNumber,
              shopifyOrderNumber: `#MOCK${backer.backerNumber}`
            });
          }
        } catch (error) {
          console.error(`Failed to import backer ${backer.backerNumber}:`, error);
          results.failed++;
          results.errors.push({
            backerNumber: backer.backerNumber,
            name: backer.name,
            error: error.message
          });
          
          // Update backer with error
          await backer.update({
            importAttemptedAt: new Date(),
            importError: error.message
          });
        }
      }
      
      res.json({
        success: true,
        message: `Imported ${results.successful} of ${backers.length} backers`,
        results
      });
    }
    
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      error: `Import failed: ${error.message}` 
    });
  }
});

// Export imported data
router.get('/project/:id/export', validateSession, async (req, res) => {
  const format = req.query.format || 'csv';
  
  try {
    const backers = await Backer.findAll({
      where: { 
        projectId: req.params.id,
        imported: true
      }
    });
    
    if (format === 'csv') {
      const csv = exportToCSV(backers);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=imported-backers.csv');
      res.send(csv);
    } else {
      res.json(backers);
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: `Export failed: ${error.message}` });
  }
});

// ADD THESE CONSOLIDATION ENDPOINTS TO THE END OF YOUR EXISTING /backend/routes/import.js FILE
// Location: /backend/routes/import.js (ADD TO END)

// NEW ORDER CONSOLIDATION ENDPOINTS - ADD THESE TO YOUR EXISTING FILE

// Fetch customers with multiple orders
router.get('/consolidation/customers-multiple-orders', validateSession, async (req, res) => {
  try {
    const { fulfillment_status = 'unfulfilled' } = req.query;
    
    console.log(`Fetching customers with multiple ${fulfillment_status} orders from Shopify...`);
    
    // Load the new consolidation functions from shopify service
    const { fetchShopifyOrders, identifyCustomersWithMultipleOrders } = require('../services/shopify');
    
    const orders = await fetchShopifyOrders(fulfillment_status);
    const analysis = identifyCustomersWithMultipleOrders(orders);
    
    console.log(`Found ${analysis.customersWithMultipleOrders.length} customers with multiple ${fulfillment_status} orders`);
    
    res.json({
      success: true,
      totalCustomers: analysis.totalCustomers,
      customersWithMultipleOrders: analysis.customersWithMultipleOrders,
      summary: {
        totalOrders: orders.length,
        customersWithMultipleOrders: analysis.customersWithMultipleOrders.length,
        totalOrdersFromMultipleOrderCustomers: analysis.customersWithMultipleOrders.reduce(
          (sum, customer) => sum + customer.orderCount, 0
        ),
        potentialConsolidationValue: analysis.customersWithMultipleOrders.reduce(
          (sum, customer) => sum + customer.totalValue, 0
        )
      }
    });
    
  } catch (error) {
    console.error(`Failed to fetch customers with multiple orders: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: `Failed to analyze customer orders: ${error.message}` 
    });
  }
});

// Get consolidation preview
router.post('/consolidation/preview', validateSession, async (req, res) => {
  const { email, orderIds } = req.body;
  
  if (!email || !orderIds || !Array.isArray(orderIds)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email and orderIds array are required' 
    });
  }
  
  try {
    console.log(`Generating consolidation preview for ${email} with orders: ${orderIds.join(', ')}`);
    
    const { getOrderConsolidationPreview } = require('../services/shopify');
    const preview = await getOrderConsolidationPreview(email, orderIds);
    
    res.json({
      success: true,
      preview: preview
    });
    
  } catch (error) {
    console.error(`Failed to generate consolidation preview for ${email}: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: `Failed to generate preview: ${error.message}` 
    });
  }
});

// Execute order consolidation
router.post('/consolidation/execute', validateSession, async (req, res) => {
  const { email, orderIds } = req.body;
  
  if (!email || !orderIds || !Array.isArray(orderIds)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email and orderIds array are required' 
    });
  }
  
  if (orderIds.length < 2) {
    return res.status(400).json({ 
      success: false, 
      error: 'At least 2 orders are required for consolidation' 
    });
  }
  
  try {
    console.log(`Starting order consolidation for ${email} with ${orderIds.length} orders`);
    
    const { consolidateOrders } = require('../services/shopify');
    const result = await consolidateOrders(email, orderIds);
    
    console.log(`Successfully consolidated orders for ${email}. New order: ${result.consolidatedOrder.name}`);
    
    res.json({
      success: true,
      result: result,
      message: `Successfully consolidated ${result.originalOrders.count} orders into new paid order ${result.consolidatedOrder.name} (${result.consolidatedOrder.currency} ${result.consolidatedOrder.total_price})`
    });
    
  } catch (error) {
    console.error(`Order consolidation failed for ${email}: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: `Consolidation failed: ${error.message}` 
    });
  }
});

// Bulk consolidation for a customer (consolidate ALL their unfulfilled orders)
router.post('/consolidation/bulk-customer', validateSession, async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email is required' 
    });
  }
  
  try {
    console.log(`Starting bulk order consolidation for customer: ${email}`);
    
    const { fetchShopifyOrders, consolidateOrders } = require('../services/shopify');
    
    const orders = await fetchShopifyOrders('unfulfilled');
    const customerOrders = orders.filter(order => 
      order.email && order.email.toLowerCase().trim() === email.toLowerCase().trim()
    );
    
    if (customerOrders.length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: `Customer ${email} has only ${customerOrders.length} unfulfilled order(s). At least 2 orders are required for consolidation.` 
      });
    }
    
    const orderIds = customerOrders.map(order => order.id.toString());
    console.log(`Found ${orderIds.length} unfulfilled orders for ${email}: ${orderIds.join(', ')}`);
    
    const result = await consolidateOrders(email, orderIds);
    
    console.log(`Successfully bulk consolidated all orders for ${email}. New order: ${result.consolidatedOrder.name}`);
    
    res.json({
      success: true,
      result: result,
      message: `Successfully consolidated all ${result.originalOrders.count} unfulfilled orders for ${email} into new paid order ${result.consolidatedOrder.name} (${result.consolidatedOrder.currency} ${result.consolidatedOrder.total_price})`
    });
    
  } catch (error) {
    console.error(`Bulk order consolidation failed for ${email}: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: `Bulk consolidation failed: ${error.message}` 
    });
  }
});

// ADD THIS TO YOUR EXISTING MODULE.EXPORTS AT THE END OF YOUR IMPORT.JS FILE

module.exports = router;