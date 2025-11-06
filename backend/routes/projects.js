// Projects Route - Fixed to use shopify.js findOrCreateCustomer function
// Location: /backend/routes/projects.js

const express = require('express');
const router = express.Router();
const { Project, Backer, Mapping, sequelize } = require('../models');
const { 
  fetchAllShopifyOrders, 
  identifyDuplicateCustomers, 
  mergeCustomerOrders,
  getCustomerMergePreview,
  findOrCreateCustomer,
  createShopifyClient
} = require('../services/shopify');

// ═══════════════════════════════════════════════════════════════
// RATE LIMITING HELPERS - Prevents Shopify 429 errors
// ═══════════════════════════════════════════════════════════════

// Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Rate limit tracking
let lastApiCall = 0;
const MIN_DELAY_MS = 1500; // 1500ms = 0.67 calls/sec (VERY SAFE - accounts for internal multi-call functions)

// Wrap API calls with rate limiting
async function rateLimitedApiCall(apiFunction) {
  const now = Date.now();
  const timeSince = now - lastApiCall;
  
  if (timeSince < MIN_DELAY_MS) {
    const delay = MIN_DELAY_MS - timeSince;
    console.log(`[RATE LIMIT] Waiting ${delay}ms...`);
    await sleep(delay);
  }
  
  lastApiCall = Date.now();
  return await apiFunction();
}

// ═══════════════════════════════════════════════════════════════

// Middleware for session validation (bypass in development)
// Using CUSTOM APP - no OAuth needed
const validateSession = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    // Mock session for development - but we're using custom app
    req.session = {
      shopify: {
        shop: process.env.SHOPIFY_SHOP_DOMAIN || 'test-shop.myshopify.com',
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN || 'test-token'
      }
    };
    return next();
  }
  
  // For custom app, we don't need session validation
  // Access token is in environment variables
  return next();
};

// GET all projects
router.get('/', validateSession, async (req, res) => {
  try {
    console.log('GET /api/projects - Fetching all projects');
    
    const projects = await Project.findAll({
      order: [['updatedAt', 'DESC']]
    });
    
    console.log(`Found ${projects.length} projects`);
    res.json(projects);
    
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ 
      error: 'Failed to fetch projects',
      message: error.message 
    });
  }
});

// GET single project
router.get('/:id', validateSession, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST create new project
router.post('/', validateSession, async (req, res) => {
  try {
    const { name, shop } = req.body;
    // Using custom app - shop domain from environment
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || shop || 'test-shop.myshopify.com';
    
    const project = await Project.create({
      name: name || `New Project ${Date.now()}`,
      shop: shopDomain
    });
    
    console.log('Project created:', project.id);
    res.status(201).json(project);
    
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT update project name
router.put('/:id', validateSession, async (req, res) => {
  try {
    const { name } = req.body;
    const project = await Project.findByPk(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    await project.update({ name });
    res.json(project);
    
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// PUT archive project
router.put('/:id/archive', validateSession, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    await project.update({ isArchived: true });
    res.json({ success: true, message: 'Project archived' });
    
  } catch (error) {
    console.error('Error archiving project:', error);
    res.status(500).json({ error: 'Failed to archive project' });
  }
});

// DELETE project
router.delete('/:id', validateSession, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Delete related data
    await Backer.destroy({ where: { projectId: req.params.id } });
    await Mapping.destroy({ where: { projectId: req.params.id } });
    await project.destroy();
    
    res.json({ success: true, message: 'Project deleted' });
    
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// POST reset project
router.post('/:id/reset', validateSession, async (req, res) => {
  try {
    // Delete all backers and mappings for the project
    await Backer.destroy({ where: { projectId: req.params.id } });
    await Mapping.destroy({ where: { projectId: req.params.id } });
    
    res.json({ success: true, message: 'Project reset successfully' });
    
  } catch (error) {
    console.error('Error resetting project:', error);
    res.status(500).json({ error: 'Failed to reset project' });
  }
});

// Delete all backers for a project (for reset functionality)
router.delete('/:id/backers', validateSession, async (req, res) => {
  const { id } = req.params;
  
  try {
    console.log(`Deleting all backers for project ${id}`);
    
    const result = await Backer.destroy({
      where: { projectId: id }
    });
    
    console.log(`Deleted ${result} backers from project ${id}`);
    
    res.json({ 
      success: true, 
      deletedCount: result,
      message: `Successfully deleted ${result} backers` 
    });
    
  } catch (error) {
    console.error('Error deleting backers:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to delete backers: ${error.message}` 
    });
  }
});

// GET project stats (for dashboard display) - if not already present
router.get('/:id/stats', validateSession, async (req, res) => {
  const { id } = req.params;
  
  try {
    const { Op } = require('sequelize');
    
    const total = await Backer.count({ where: { projectId: id } });
    const imported = await Backer.count({ where: { projectId: id, imported: true } });
    const failed = await Backer.count({ 
      where: { 
        projectId: id, 
        imported: false,
        importError: { [Op.ne]: null }
      } 
    });
    const pending = total - imported - failed;
    
    res.json({
      total,
      imported,
      pending,
      failed
    });
    
  } catch (error) {
    console.error('Error fetching project stats:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to fetch stats: ${error.message}` 
    });
  }
});

// =====================
// CUSTOMER MERGING ENDPOINTS
// =====================

// GET all Shopify orders for customer analysis
router.get('/:id/shopify-orders', validateSession, async (req, res) => {
  try {
    console.log(`GET /api/projects/${req.params.id}/shopify-orders - Fetching all Shopify orders`);
    
    const orders = await fetchAllShopifyOrders();
    
    res.json({
      success: true,
      orders: orders,
      total: orders.length
    });
    
  } catch (error) {
    console.error('Error fetching Shopify orders:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Shopify orders',
      message: error.message 
    });
  }
});

// GET duplicate customers analysis
router.get('/:id/duplicate-customers', validateSession, async (req, res) => {
  try {
    console.log(`GET /api/projects/${req.params.id}/duplicate-customers - Analyzing duplicate customers`);
    
    // Fetch all orders
    const orders = await fetchAllShopifyOrders();
    
    // Identify duplicates
    const analysis = identifyDuplicateCustomers(orders);
    
    res.json({
      success: true,
      analysis: analysis,
      summary: {
        totalOrders: orders.length,
        totalCustomers: analysis.totalCustomers,
        duplicateCustomers: analysis.duplicateCustomers.length,
        potentialSavings: analysis.duplicateCustomers.reduce((sum, customer) => {
          return sum + (customer.orderCount - 1); // One less order per duplicate customer
        }, 0)
      }
    });
    
  } catch (error) {
    console.error('Error analyzing duplicate customers:', error);
    res.status(500).json({ 
      error: 'Failed to analyze duplicate customers',
      message: error.message 
    });
  }
});

// POST get merge preview for a customer
router.post('/:id/customer-merge-preview', validateSession, async (req, res) => {
  try {
    const { email, orderIds } = req.body;
    
    if (!email || !orderIds || !Array.isArray(orderIds)) {
      return res.status(400).json({ 
        error: 'Email and orderIds array required' 
      });
    }
    
    console.log(`POST /api/projects/${req.params.id}/customer-merge-preview - Getting preview for ${email}`);
    
    const preview = await getCustomerMergePreview(email, orderIds);
    
    res.json({
      success: true,
      preview: preview
    });
    
  } catch (error) {
    console.error('Error generating merge preview:', error);
    res.status(500).json({ 
      error: 'Failed to generate merge preview',
      message: error.message 
    });
  }
});

// POST merge customer orders
router.post('/:id/merge-customer', validateSession, async (req, res) => {
  try {
    const { email, orderIds } = req.body;
    
    if (!email || !orderIds || !Array.isArray(orderIds)) {
      return res.status(400).json({ 
        error: 'Email and orderIds array required' 
      });
    }
    
    console.log(`POST /api/projects/${req.params.id}/merge-customer - Merging orders for ${email}`);
    
    const mergeResult = await mergeCustomerOrders(email, orderIds);
    
    res.json({
      success: true,
      message: `Successfully merged ${mergeResult.totalOrders} orders for ${email}`,
      mergeResult: mergeResult
    });
    
  } catch (error) {
    console.error('Error merging customer orders:', error);
    res.status(500).json({ 
      error: 'Failed to merge customer orders',
      message: error.message 
    });
  }
});

// =====================
// EXISTING ENDPOINTS (unchanged from working version)
// =====================

// GET product mappings for a project - FIXED to only return SKU products
router.get('/:id/mappings', validateSession, async (req, res) => {
  try {
    console.log(`GET /api/project/${req.params.id}/mappings`);
    
    const backers = await Backer.findAll({ 
      where: { projectId: req.params.id } 
    });
    
    console.log(`Found ${backers.length} backers for project ${req.params.id}`);
    
    // Extract unique products ONLY from skuColumns
    const products = new Map();
    
     backers.forEach(backer => {
      // ONLY process skuColumns - ignore reward and addOns completely
      if (backer.skuColumns && typeof backer.skuColumns === 'object') {
        Object.keys(backer.skuColumns).forEach(sku => {
          // Include ALL SKUs - no filtering by prefix
          if (sku && !products.has(sku)) {
            products.set(sku, {
              name: sku,
              sku: sku,
              type: 'sku',
              kickstarterName: sku
            });
          }
        });
      }
    });
    
    const productArray = Array.from(products.values());
    console.log(`Returning ${productArray.length} unique SKU products`);
    console.log('SKU products:', productArray.map(p => p.name));
    
    res.json(productArray);
    
  } catch (error) {
    console.error('Mappings error:', error);
    res.status(500).json({ 
      error: `Failed to get mappings: ${error.message}` 
    });
  }
});

// POST save mappings
router.post('/:id/mappings', validateSession, async (req, res) => {
  try {
    console.log(`POST /api/project/${req.params.id}/mappings`);
    console.log('Received mappings:', JSON.stringify(req.body, null, 2));
    
    const { mappings } = req.body;
    
    if (!mappings || !Array.isArray(mappings)) {
      return res.status(400).json({ 
        error: 'Invalid mappings format - must be an array' 
      });
    }
    
    // FORCE DELETE all existing mappings first using raw SQL to ensure it works
    const projectId = parseInt(req.params.id);
    
    // Use raw SQL to force delete (more reliable than Sequelize destroy)
    const deleteResult = await sequelize.query(
      'DELETE FROM "Mappings" WHERE "projectId" = :projectId',
      { 
        replacements: { projectId },
        type: sequelize.QueryTypes.DELETE 
      }
    );
    
    console.log(`FORCE DELETED all existing mappings for project ${projectId}`);
    
    // Create new mappings with validation
    const mappingRecords = [];
    
    for (const mapping of mappings) {
      if (!mapping.kickstarterName && !mapping.name) {
        console.warn('Skipping mapping with no kickstarterName:', mapping);
        continue;
      }
      
      if (!mapping.skus || !Array.isArray(mapping.skus) || mapping.skus.length === 0) {
        console.warn('Skipping mapping with no valid SKUs:', mapping);
        continue;
      }
      
      // Clean the SKUs array
      const cleanSkus = mapping.skus
        .filter(sku => sku && typeof sku === 'string')
        .map(sku => sku.trim())
        .filter(sku => sku.length > 0);
      
      if (cleanSkus.length === 0) {
        console.warn('Skipping mapping with no valid SKUs after cleaning:', mapping);
        continue;
      }
      
      const record = await Mapping.create({
        projectId: projectId,
        kickstarterName: mapping.kickstarterName || mapping.name,
        skus: cleanSkus
      });
      
      mappingRecords.push(record);
      console.log(`Created mapping: ${record.kickstarterName} -> [${record.skus.join(', ')}]`);
    }
    
    console.log(`CREATED ${mappingRecords.length} new mappings`);
    
    // Verify the mappings were saved correctly
    const savedMappings = await Mapping.findAll({
      where: { projectId: projectId }
    });
    
    console.log(`VERIFICATION: Found ${savedMappings.length} total mappings in database`);
    
    // Log the actual saved mappings for debugging
    savedMappings.forEach(mapping => {
      console.log(`Saved: ${mapping.kickstarterName} -> [${mapping.skus.join(', ')}]`);
    });
    
    res.json({
      success: true,
      message: `Successfully replaced all mappings: created ${mappingRecords.length}`,
      mappings: mappingRecords,
      verification: {
        totalInDatabase: savedMappings.length,
        created: mappingRecords.length
      }
    });
    
  } catch (error) {
    console.error('Save mappings error:', error);
    res.status(500).json({ 
      error: `Failed to save mappings: ${error.message}`,
      stack: error.stack
    });
  }
});

// DELETE clear all mappings for a project
router.delete('/:id/mappings', validateSession, async (req, res) => {
  try {
    console.log(`DELETE /api/project/${req.params.id}/mappings - Clearing all mappings`);
    
    const projectId = parseInt(req.params.id);
    
    // Use raw SQL to force delete (more reliable than Sequelize destroy)
    const deleteResult = await sequelize.query(
      'DELETE FROM "Mappings" WHERE "projectId" = :projectId',
      { 
        replacements: { projectId },
        type: sequelize.QueryTypes.DELETE 
      }
    );
    
    console.log(`Successfully cleared all mappings for project ${projectId}`);
    
    res.json({
      success: true,
      message: 'Successfully cleared all mappings'
    });
    
  } catch (error) {
    console.error('Clear mappings error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to clear mappings: ${error.message}`
    });
  }
});

// POST validate SKUs - BACK TO YOUR WORKING VERSION
router.post('/:id/validate-skus', validateSession, async (req, res) => {
  try {
    const { skus } = req.body;
    
    if (!skus || !Array.isArray(skus)) {
      return res.status(400).json({ 
        error: 'SKUs array required' 
      });
    }
    
    console.log(`Validating ${skus.length} SKUs for project ${req.params.id}:`, skus);
    
    // Import node-fetch
    const fetch = require('node-fetch');
    
    // Construct proper Shopify Admin API URL
    const shopUrl = process.env.SHOPIFY_STORE_URL.replace(/^https?:\/\//, '');
    
    // Collect all SKUs from all pages
    const shopifySkus = new Set();
    let nextPageUrl = `https://${shopUrl}/admin/api/2024-10/products.json?limit=250&fields=id,title,variants`;
    let pageCount = 0;
    
    while (nextPageUrl && pageCount < 20) { // Safety limit of 20 pages
      pageCount++;
      console.log(`Fetching page ${pageCount} from Shopify API...`);
      
      const response = await fetch(nextPageUrl, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Shopify API response error:', errorText);
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`Page ${pageCount}: Found ${data.products?.length || 0} products`);
      
      // Extract SKUs from variants
      if (data.products) {
        data.products.forEach(product => {
          if (product.variants) {
            product.variants.forEach(variant => {
              if (variant.sku && variant.sku.trim()) {
                shopifySkus.add(variant.sku.trim());
              }
            });
          }
        });
      }
      
      // Check for next page using Link header
      const linkHeader = response.headers.get('link');
      nextPageUrl = null;
      if (linkHeader) {
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (nextMatch) {
          nextPageUrl = nextMatch[1];
        }
      }
    }
    
    console.log(`Total SKUs collected from Shopify: ${shopifySkus.size} (from ${pageCount} pages)`);
    
    // Validate each requested SKU
    const results = {};
    const validSkus = [];
    const invalidSkus = [];
    
    skus.forEach(sku => {
      const trimmedSku = sku.trim();
      const isValid = shopifySkus.has(trimmedSku);
      
      results[sku] = {
        valid: isValid,
        message: isValid ? 'SKU found in Shopify inventory' : 'SKU not found in Shopify inventory'
      };
      
      if (isValid) {
        validSkus.push(sku);
        console.log(`SKU ${sku}: VALID`);
      } else {
        invalidSkus.push(sku);
        console.log(`SKU ${sku}: INVALID`);
      }
    });
    
    // Return enhanced response
    res.json({
      results,
      summary: {
        total: skus.length,
        valid: validSkus.length,
        invalid: invalidSkus.length,
        validSkus,
        invalidSkus
      },
      shopifyData: {
        totalSkusInShopify: shopifySkus.size,
        pagesChecked: pageCount
      }
    });
    
  } catch (error) {
    console.error('SKU validation error:', error);
    res.status(500).json({ 
      error: `Failed to validate SKUs: ${error.message}`,
      details: error.stack
    });
  }
});

// GET backers for a project
router.get('/:id/backers', validateSession, async (req, res) => {
  try {
    const backers = await Backer.findAll({
      where: { projectId: req.params.id },
      order: [['backerNumber', 'ASC']]
    });
    
    res.json(backers);
    
  } catch (error) {
    console.error('Error fetching backers:', error);
    res.status(500).json({ 
      error: 'Failed to fetch backers' 
    });
  }
});

// Projects Route - FIXED to include phone in draft order contact information
// Location: /backend/routes/projects.js

// ... (keep all the existing code until the import section)

// POST import backers to Shopify - FIXED TO USE findOrCreateCustomer AND ADD PHONE TO DRAFT ORDER
router.post('/:id/import', validateSession, async (req, res) => {
  console.log('=== IMPORT REQUEST RECEIVED ===');
  console.log('Project ID:', req.params.id);
  console.log('Body:', JSON.stringify(req.body));
  console.log('==============================');
  
  // Handle various possible formats
  let ids = [];
  if (Array.isArray(req.body)) {
    ids = req.body;
  } else if (req.body) {
    ids = req.body.selectedBackerIds || 
          req.body.backerIds || 
          req.body.ids || 
          [];
  }
  
  console.log('Extracted IDs:', ids);
  
  if (!ids || ids.length === 0) {
    return res.status(400).json({ 
      error: 'No backers selected for import',
      receivedBody: req.body
    });
  }
  
  try {
    // Get the selected backers
    const backers = await Backer.findAll({
      where: { 
        id: ids,
        projectId: req.params.id 
      }
    });
    
    if (backers.length === 0) {
      return res.status(404).json({ 
        error: 'No backers found with provided IDs' 
      });
    }
    
    // Check for already imported backers
    const alreadyImported = backers.filter(b => b.imported);
    if (alreadyImported.length > 0) {
      console.log(`Warning: ${alreadyImported.length} backers already imported, skipping`);
    }
    
    // Filter to only non-imported backers
    const backersToImport = backers.filter(b => !b.imported);
    
    if (backersToImport.length === 0) {
      return res.json({
        success: true,
        message: 'All selected backers were already imported',
        results: {
          successful: 0,
          failed: 0,
          skipped: alreadyImported.length,
          errors: []
        }
      });
    }
    
    // Get mappings for this project
    const mappings = await Mapping.findAll({
      where: { projectId: req.params.id }
    });
    
    console.log(`Found ${mappings.length} product mappings`);
    
    // Import to Shopify
    const results = {
      successful: 0,
      failed: 0,
      skipped: alreadyImported.length,
      errors: [],
      orders: []
    };
    
    // Create Shopify client and import findOrCreateCustomer
    const { createShopifyClient, findOrCreateCustomer } = require('../services/shopify');
    const client = createShopifyClient();
    const fetch = require('node-fetch');
    const shopUrl = process.env.SHOPIFY_STORE_URL.replace(/^https?:\/\//, '');
    
    // Get ALL Shopify products using Link header pagination
    const shopifyVariants = new Map();
    let nextPageUrl = `https://${shopUrl}/admin/api/2024-10/products.json?limit=250&fields=id,title,variants`;
    let pageCount = 0;
    let totalProducts = 0;
    
    while (nextPageUrl) {
      pageCount++;
      console.log(`Fetching product page ${pageCount}...`);
      
      const response = await rateLimitedApiCall(() => fetch(nextPageUrl, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }));
      
      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status}`);
      }
      
      const data = await response.json();
      totalProducts += data.products.length;
      
      // Add all variants to map
      data.products.forEach(product => {
        product.variants.forEach(variant => {
          if (variant.sku) {
            shopifyVariants.set(variant.sku, {
              variantId: variant.id,
              productId: product.id,
              productTitle: product.title,
              price: variant.price
            });
          }
        });
      });
      
      // Check for next page using Link header
      const linkHeader = response.headers.get('link');
      nextPageUrl = null;
      if (linkHeader) {
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (nextMatch) {
          nextPageUrl = nextMatch[1];
        }
      }
    }
    
    console.log(`Loaded ${totalProducts} products (${shopifyVariants.size} variants) from ${pageCount} pages`);
    
    // Process each backer
    for (const backer of backersToImport) {
      try {
        // CRITICAL: Check if email exists
        if (!backer.email || backer.email.trim() === '') {
          console.log(`⚠️ Backer ${backer.backerNumber} has NO EMAIL - skipping`);
          results.failed++;
          results.errors.push({
            backerNumber: backer.backerNumber,
            name: backer.name,
            error: 'No email address in database'
          });
          
          await backer.update({
            importAttemptedAt: new Date(),
            importError: 'No email address found'
          });
          
          continue;
        }
        
        console.log(`\n=== Processing Backer ${backer.backerNumber} ===`);
        console.log(`Email: ${backer.email}`);
        console.log(`Name: ${backer.name}`);
        
        const customerId = await rateLimitedApiCall(() => findOrCreateCustomer(client, backer));
        
        if (!customerId) {
          throw new Error('Failed to create or find customer');
        }
        
        console.log(`✓ Customer ID obtained: ${customerId}`);
        
        // Build line items ONLY from skuColumns (ignore reward and addOns)
        const lineItems = [];
        let hasValidItems = false;
        
        // Process ONLY skuColumns
        if (backer.skuColumns) {
          for (const [kickstarterName, item] of Object.entries(backer.skuColumns)) {
            // Find mapping for this Kickstarter product name
            const mapping = mappings.find(m => m.kickstarterName === kickstarterName);
            
            if (!mapping || !mapping.skus || mapping.skus.length === 0) {
              console.warn(`No mapping found for "${kickstarterName}" for backer ${backer.backerNumber}`);
              continue;
            }
            
            // Get the Shopify variant using the mapped SKU
            const shopifySku = mapping.skus[0];
            const variantInfo = shopifyVariants.get(shopifySku);
            
            if (!variantInfo) {
              console.warn(`SKU "${shopifySku}" (mapped from "${kickstarterName}") not found in Shopify for backer ${backer.backerNumber}`);
              continue;
            }
            
            const quantity = item.quantity || item;
            if (quantity > 0) {
              lineItems.push({
                variant_id: variantInfo.variantId,
                quantity: quantity
              });
              hasValidItems = true;
              console.log(`Added: ${kickstarterName} -> ${shopifySku} (variant ${variantInfo.variantId}) x${quantity}`);
            }
          }
        }
        
        if (!hasValidItems) {
          throw new Error('No valid products found for this backer');
        }
        
        // Build the note with CSV notes included
        let noteText = `Kickstarter Backer #${backer.backerNumber}`;
        
        // Add CSV notes if they exist (from "Shipping Delivery Notes" column)
        if (backer.notes && backer.notes.trim() !== '') {
          noteText += `\n\nDelivery Notes from CSV:\n${backer.notes.trim()}`;
        }
        
        // Add pledge amount
        noteText += `\n\nPledge Amount: $${backer.pledgeAmount}`;
        
        // Add missing shipping warning if applicable
        if (backer.missingShippingAddress) {
          noteText = `⚠️ WARNING: This person did not provide shipping address - please confirm with customer!\n\n` + noteText;
        }

        // CRITICAL FIX: Add phone at draft order level for Contact Information
        const backerPhone = backer.shippingPhone || '';
        
        // Create draft order data with customer ID AND phone at order level
        const draftOrderData = {
  draft_order: {
    line_items: lineItems,
    customer: {
      id: customerId
    },
    email: backer.email.trim(),
    billing_address: {
      first_name: backer.name ? backer.name.split(' ')[0] : '',
      last_name: backer.name ? backer.name.split(' ').slice(1).join(' ') : '',
      address1: backer.shippingAddress || '',
      city: backer.shippingCity || '',
      province: backer.shippingState || '',
      country: backer.shippingCountry || 'US',
      zip: backer.shippingPostalCode || '',
      phone: backerPhone  // Add phone to billing address
    },
    shipping_address: {
      first_name: backer.name ? backer.name.split(' ')[0] : '',
      last_name: backer.name ? backer.name.split(' ').slice(1).join(' ') : '',
      address1: backer.shippingAddress || '',
      address2: backer.shippingAddress2 || '',
      city: backer.shippingCity || '',
      province: backer.shippingState || '',
      country: backer.shippingCountry || 'US',
      zip: backer.shippingPostalCode || '',
      phone: backerPhone
    },
    note: noteText,
    tags: 'kickstarter-import',
    tax_exempt: true,
    send_receipt: false,
    send_fulfillment_receipt: false,
    use_customer_default_address: false
  }
};
        
        console.log(`Creating draft order for backer ${backer.backerNumber} with customer ID: ${customerId}`);
        console.log(`Draft order phone: "${backerPhone}"`);
        
        // ADD THESE 3 LINES HERE ⬇️
        console.log('=== DRAFT ORDER DATA BEING SENT ===');
        console.log(JSON.stringify(draftOrderData, null, 2));
        console.log('===================================');
        
        const response = await rateLimitedApiCall(() => client.post('draft_orders', draftOrderData));
        
        // ADD THESE 3 LINES HERE ⬇️
        console.log('=== SHOPIFY RESPONSE ===');
        console.log(JSON.stringify(response, null, 2));
        console.log('========================');
        
        if (response.draft_order) {
          // Update backer as imported
          await backer.update({ 
            imported: true,
            importedAt: new Date(),
            shopifyOrderId: response.draft_order.id,
            shopifyOrderNumber: response.draft_order.name,
            shopifyCustomerId: customerId.toString(),
            importError: null
          });
          
          results.successful++;
          results.orders.push({
            backerNumber: backer.backerNumber,
            shopifyOrderNumber: response.draft_order.name,
            customerId: customerId,
            email: backer.email
          });
          
          console.log(`✓ Created draft order ${response.draft_order.name} for ${backer.email}`);
        }
      } catch (error) {
        console.error(`Failed to import backer ${backer.backerNumber}:`, error);
        
        // Save error to backer record
        await backer.update({
          importError: error.message,
          importAttemptedAt: new Date()
        });
        
        results.failed++;
        results.errors.push({
          backerNumber: backer.backerNumber,
          name: backer.name,
          email: backer.email || 'NO EMAIL',
          error: error.message
        });
      }
      
      // Extra safety: Small delay after each backer (even if rateLimitedApiCall already delayed)
      await sleep(200);
    }
    
    res.json({
      success: true,
      message: `Imported ${results.successful} of ${backersToImport.length} backers (${results.skipped} already imported)`,
      results
    });
    
    } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      error: `Import failed: ${error.message}` 
    });
  }
});

// GET import report
router.get('/:id/report', validateSession, async (req, res) => {
  try {
    const backers = await Backer.findAll({
      where: { projectId: req.params.id },
      order: [['backerNumber', 'ASC']]
    });
    
    const report = {
      total: backers.length,
      imported: backers.filter(b => b.imported).length,
      pending: backers.filter(b => !b.imported && !b.importError).length,
      failed: backers.filter(b => b.importError).length,
      details: backers.map(b => ({
        backerNumber: b.backerNumber,
        name: b.name,
        email: b.email,
        imported: b.imported,
        shopifyOrderId: b.shopifyOrderId || null,
        shopifyOrderNumber: b.shopifyOrderNumber || null,
        error: b.importError || null,
        importedAt: b.importedAt,
        attemptedAt: b.importAttemptedAt
      }))
    };
    
    res.json(report);
    
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ 
      error: 'Failed to generate report' 
    });
  }
});

// POST retry failed imports
router.post('/:id/retry-failed', validateSession, async (req, res) => {
  try {
    // Find all failed imports for this project
    const failedBackers = await Backer.findAll({
      where: { 
        projectId: req.params.id,
        imported: false,
        importError: { [require('sequelize').Op.ne]: null }
      }
    });
    
    if (failedBackers.length === 0) {
      return res.json({
        success: true,
        message: 'No failed imports to retry',
        results: { retried: 0 }
      });
    }
    
    // Clear their error status and try importing again
    const backerIds = failedBackers.map(b => b.id);
    await Backer.update(
      { importError: null, importAttemptedAt: null },
      { where: { id: backerIds } }
    );
    
    // Trigger import for these backers
    req.body = { backerIds };
    return router.handle(req, res);
    
  } catch (error) {
    console.error('Retry error:', error);
    res.status(500).json({ 
      error: `Retry failed: ${error.message}` 
    });
  }
});

// GET check if project has mappings
router.get('/:id/has-mappings', validateSession, async (req, res) => {
  try {
    const mappingCount = await Mapping.count({
      where: { projectId: req.params.id }
    });
    
    res.json({ 
      hasMappings: mappingCount > 0,
      count: mappingCount 
    });
  } catch (error) {
    console.error('Error checking mappings:', error);
    res.status(500).json({ 
      error: 'Failed to check mappings' 
    });
  }
});

// GET saved mappings for a project (for pre-filling)
router.get('/:id/saved-mappings', validateSession, async (req, res) => {
  try {
    const mappings = await Mapping.findAll({
      where: { projectId: req.params.id }
    });
    
    // Convert to format expected by frontend
    const mappingObject = {};
    mappings.forEach(m => {
      mappingObject[m.kickstarterName] = {
        skus: m.skus || [],
        errors: m.skus ? m.skus.map(() => null) : []
      };
    });
    
    res.json(mappingObject);
  } catch (error) {
    console.error('Error fetching saved mappings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch saved mappings' 
    });
  }
});

// POST clear mappings
router.post('/:id/clear-mappings', validateSession, async (req, res) => {
  try {
    console.log(`POST /api/project/${req.params.id}/clear-mappings`);
    
    const projectId = parseInt(req.params.id);
    
    await sequelize.query(
      'DELETE FROM "Mappings" WHERE "projectId" = :projectId',
      { 
        replacements: { projectId },
        type: sequelize.QueryTypes.DELETE 
      }
    );
    
    res.json({
      success: true,
      message: 'Successfully cleared all mappings'
    });
    
  } catch (error) {
    console.error('Clear mappings error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;