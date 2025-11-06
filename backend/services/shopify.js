// Shopify Service - FIXED: Added phone to draft order + marketing consent
// Location: /backend/services/shopify.js

const { Backer, Mapping } = require('../models');
const logger = require('./logger');
require('dotenv').config();

// Since we're using a Custom App, we have a permanent access token
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL.replace(/^https?:\/\//, '');

/**
 * Create a Shopify REST client for Custom App
 */
function createShopifyClient() {
  const fetch = require('node-fetch');
  
  return {
    post: async (endpoint, data) => {
      const url = `https://${SHOPIFY_STORE_URL}/admin/api/2024-10/${endpoint}.json`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Shopify API error: ${response.status} - ${error}`);
      }
      
      return await response.json();
    },
    
    put: async (endpoint, data) => {
      const url = `https://${SHOPIFY_STORE_URL}/admin/api/2024-10/${endpoint}.json`;
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Shopify API error: ${response.status} - ${error}`);
      }
      
      return await response.json();
    },
    
    get: async (endpoint, params = {}) => {
      let queryString = '';
      if (params && Object.keys(params).length > 0) {
        const parts = [];
        for (const [key, value] of Object.entries(params)) {
          if (value !== null && value !== undefined) {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
          }
        }
        queryString = parts.join('&');
      }
      
      // FIXED: Ensure .json comes BEFORE query string
      const url = `https://${SHOPIFY_STORE_URL}/admin/api/2024-10/${endpoint}.json${queryString ? '?' + queryString : ''}`;
      
      console.log(`Shopify GET: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Shopify API error: ${response.status} - ${error}`);
      }
      
      return await response.json();
    },
    
    delete: async (endpoint) => {
      const url = `https://${SHOPIFY_STORE_URL}/admin/api/2024-10/${endpoint}.json`;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Shopify API error: ${response.status} - ${error}`);
      }
      
      return response.status === 200 ? await response.json() : { success: true };
    }
  };
}

/**
 * Find or create a customer in Shopify by email - WITH PHONE NUMBER SYNC & MARKETING CONSENT
 */
async function findOrCreateCustomer(client, backer) {
  try {
    console.log(`[findOrCreateCustomer] Searching for customer: ${backer.email}`);
    
    const backerPhone = backer.shippingPhone || '';
    
    // First, search for existing customer by email
    const searchResult = await client.get('customers/search', {
      query: `email:${backer.email}`
    });
    
    console.log(`[findOrCreateCustomer] Search result:`, JSON.stringify(searchResult, null, 2));
    
    if (searchResult.customers && searchResult.customers.length > 0) {
      const existingCustomer = searchResult.customers[0];
      logger.info(`✓ Found existing customer for ${backer.email}: ${existingCustomer.id}`);
      console.log(`✓ Found existing customer ID: ${existingCustomer.id}`);
      
      // Check if we need to update the phone number or marketing consent
      const existingPhone = existingCustomer.phone || '';
      const needsUpdate = (backerPhone && backerPhone !== existingPhone);
      
      if (needsUpdate) {
        console.log(`[findOrCreateCustomer] Updating phone: "${existingPhone}" -> "${backerPhone}"`);
        
        try {
          // Update the customer with the new phone number and marketing consent
          const updateData = {
            customer: {
              id: existingCustomer.id,
              phone: backerPhone,
              email_marketing_consent: {
                state: 'subscribed',
                opt_in_level: 'confirmed_opt_in',
                consent_updated_at: new Date().toISOString()
              },
              sms_marketing_consent: {
                state: 'subscribed',
                opt_in_level: 'single_opt_in',
                consent_updated_at: new Date().toISOString(),
                consent_collected_from: 'OTHER'
              }
            }
          };
          
          await client.put(`customers/${existingCustomer.id}`, updateData);
          logger.info(`✓ Updated phone and marketing consent for customer ${existingCustomer.id}`);
          console.log(`✓ Phone number and marketing consent updated successfully`);
        } catch (updateError) {
          logger.warn(`Warning: Could not update customer ${existingCustomer.id}: ${updateError.message}`);
          console.warn(`[findOrCreateCustomer] Update failed (non-fatal): ${updateError.message}`);
        }
      } else if (backerPhone) {
        console.log(`[findOrCreateCustomer] Phone already matches: "${backerPhone}"`);
      } else {
        console.log(`[findOrCreateCustomer] No phone number to update`);
      }
      
      return existingCustomer.id;
    }
    
    console.log(`[findOrCreateCustomer] No existing customer found, creating new one...`);
    
    // Customer doesn't exist, create new one with phone number and marketing consent
    const customerData = {
      customer: {
        email: backer.email,
        first_name: backer.name ? backer.name.split(' ')[0] : '',
        last_name: backer.name ? backer.name.split(' ').slice(1).join(' ') : '',
        phone: backerPhone,  // Add phone to customer level
        addresses: [{
          address1: backer.shippingAddress1 || backer.shippingAddress || '',
          address2: backer.shippingAddress2 || '',
          city: backer.shippingCity || '',
          province: backer.shippingState || '',
          zip: backer.shippingPostalCode || backer.shippingPostal || backer.shippingZip || '',
          country: backer.shippingCountry || 'US',
          phone: backerPhone  // Also add to address
        }],
        accepts_marketing: true,  // General marketing flag
        email_marketing_consent: {
          state: 'subscribed',
          opt_in_level: 'confirmed_opt_in',
          consent_updated_at: new Date().toISOString()
        },
        sms_marketing_consent: {
          state: 'subscribed',
          opt_in_level: 'single_opt_in',
          consent_updated_at: new Date().toISOString(),
          consent_collected_from: 'OTHER'
        },
        tags: 'Kickstarter, Import'
      }
    };
    
    console.log(`[findOrCreateCustomer] Creating customer with data:`, JSON.stringify(customerData, null, 2));
    
    const createResult = await client.post('customers', customerData);
    
    console.log(`[findOrCreateCustomer] Create result:`, JSON.stringify(createResult, null, 2));
    
    logger.info(`✓ Created new customer for ${backer.email}: ${createResult.customer.id}`);
    console.log(`✓ Created new customer ID: ${createResult.customer.id}`);
    return createResult.customer.id;
    
  } catch (error) {
    logger.error(`❌ Error finding/creating customer for ${backer.email}: ${error.message}`);
    console.error(`[findOrCreateCustomer] Full error:`, error);
    return null;
  }
}

/**
 * Import orders from backers to Shopify - FIXED VERSION WITH CUSTOMER CREATION
 */
async function importOrders(session, projectId, selectedBackerIds) {
  const client = createShopifyClient();
  
  // Fetch backers and mappings from database
  const backers = await Backer.findAll({ 
    where: { 
      id: selectedBackerIds, 
      projectId,
      imported: false
    } 
  });
  
  const mappings = await Mapping.findAll({ where: { projectId } });
  
  const results = { 
    success: [], 
    failed: [] 
  };
  
  logger.info(`Starting import for ${backers.length} backers`);
  
  for (const backer of backers) {
    try {
      // CRITICAL: Check if email exists
      if (!backer.email || backer.email.trim() === '') {
        logger.warn(`⚠️ Backer ${backer.backerNumber} has NO EMAIL - skipping`);
        results.failed.push({
          id: backer.id,
          backerNumber: backer.backerNumber,
          name: backer.name,
          reason: 'No email address in database'
        });
        
        await backer.update({
          importAttemptedAt: new Date(),
          importError: 'No email address found'
        });
        
        continue;
      }
      
      // THE FIX: Create or find customer FIRST (with phone sync)
      const customerId = await findOrCreateCustomer(client, backer);
      
      if (!customerId) {
        throw new Error('Failed to create or find customer');
      }
      
      // Build line items from products
      const lineItems = [];
      
      if (backer.products && Object.keys(backer.products).length > 0) {
        for (const [sku, product] of Object.entries(backer.products)) {
          const mapping = mappings.find(m => 
            m.kickstarterName === sku || 
            (m.skus && m.skus.includes(sku))
          );
          
          if (mapping && mapping.shopifyProductId) {
            lineItems.push({
              variant_id: mapping.shopifyProductId,
              quantity: product.quantity
            });
          } else {
            lineItems.push({
              sku: sku,
              quantity: product.quantity,
              price: 0,
              title: product.name || sku
            });
          }
        }
      }
      
      if (lineItems.length === 0 && backer.addOns && backer.addOns.length > 0) {
        for (const addon of backer.addOns) {
          const mapping = mappings.find(m => 
            m.kickstarterName === addon.sku || 
            (m.skus && m.skus.includes(addon.sku))
          );
          
          if (mapping && mapping.shopifyProductId) {
            lineItems.push({
              variant_id: mapping.shopifyProductId,
              quantity: addon.quantity
            });
          } else {
            lineItems.push({
              sku: addon.sku,
              quantity: addon.quantity,
              price: 0,
              title: addon.name || addon.sku
            });
          }
        }
      }
      
      if (lineItems.length === 0) {
        logger.warn(`No line items for backer ${backer.backerNumber} - skipping`);
        results.failed.push({
          id: backer.id,
          backerNumber: backer.backerNumber,
          reason: 'No products to import'
        });
        continue;
      }
      
      // Create DRAFT ORDER with customer ID AND phone at order level
      const draftOrderData = {
        draft_order: {
          line_items: lineItems,
          customer: {
            id: customerId  // Use the customer ID, not inline customer data
          },
          email: backer.email.trim(),  // Email at draft order level
          phone: backer.shippingPhone || '',  // CRITICAL: Phone at draft order level for Contact Information
          tags: 'Kickstarter, Import',
          note: `Kickstarter Backer #${backer.backerNumber}\n${backer.notes || ''}\nOriginal Pledge: ${backer.pledgeAmount}`,
          billing_address: {
            first_name: backer.name ? backer.name.split(' ')[0] : '',
            last_name: backer.name ? backer.name.split(' ').slice(1).join(' ') : '',
            address1: backer.shippingAddress1 || backer.shippingAddress || '',
            address2: backer.shippingAddress2 || '',
            city: backer.shippingCity || '',
            province: backer.shippingState || '',
            zip: backer.shippingPostalCode || backer.shippingPostal || backer.shippingZip || '',
            country: backer.shippingCountry || 'US'
          },
          shipping_address: {
            first_name: backer.name ? backer.name.split(' ')[0] : '',
            last_name: backer.name ? backer.name.split(' ').slice(1).join(' ') : '',
            address1: backer.shippingAddress1 || backer.shippingAddress || '',
            address2: backer.shippingAddress2 || '',
            city: backer.shippingCity || '',
            province: backer.shippingState || '',
            zip: backer.shippingPostalCode || backer.shippingPostal || backer.shippingZip || '',
            country: backer.shippingCountry || 'US',
            phone: backer.shippingPhone || ''
          },
          use_customer_default_address: false,
          status: 'open'
        }
      };
      
      logger.info(`Creating draft order for backer ${backer.backerNumber} with customer ID: ${customerId}`);
      const response = await client.post('draft_orders', draftOrderData);
      
      // Update backer as imported
      await backer.update({ 
        imported: true,
        importedAt: new Date(),
        shopifyOrderId: response.draft_order.id.toString(),
        shopifyOrderNumber: response.draft_order.name || `#D${response.draft_order.id}`,
        shopifyCustomerId: customerId.toString()
      });
      
      results.success.push({
        backerId: backer.id,
        backerNumber: backer.backerNumber,
        orderId: response.draft_order.id,
        orderNumber: response.draft_order.name,
        customerId: customerId,
        email: backer.email,
        invoiceUrl: response.draft_order.invoice_url
      });
      
      logger.info(`✓ Successfully created draft order ${response.draft_order.name} for ${backer.email}`);
      
    } catch (error) {
      logger.error(`Import failed for backer ${backer.backerNumber}: ${error.message}`);
      
      await backer.update({
        importAttemptedAt: new Date(),
        importError: error.message
      });
      
      results.failed.push({
        backerId: backer.id,
        backerNumber: backer.backerNumber,
        name: backer.name,
        email: backer.email || 'NO EMAIL',
        reason: error.message || 'Unknown error'
      });
    }
  }
  
  logger.info(`Import completed: ${results.success.length} successful, ${results.failed.length} failed`);
  
  return results;
}

/**
 * Create a single order in Shopify - ORIGINAL WORKING VERSION PRESERVED
 */
async function createOrder(orderData) {
  const client = createShopifyClient();
  
  try {
    const lineItems = [];
    
    if (orderData.items && orderData.items.length > 0) {
      for (const item of orderData.items) {
        lineItems.push({
          sku: item.sku,
          quantity: item.quantity || 1,
          price: item.price || 0,
          title: item.title || item.sku
        });
      }
    }
    
    const draftOrderData = {
      draft_order: {
        email: orderData.email,
        tags: 'Kickstarter, Import',
        note: orderData.notes || `Kickstarter Backer #${orderData.backerNumber}`,
        line_items: lineItems,
        customer: {
          email: orderData.email,
          first_name: orderData.firstName || '',
          last_name: orderData.lastName || '',
          accepts_marketing: false
        },
        shipping_address: {
          first_name: orderData.firstName || orderData.name?.split(' ')[0] || '',
          last_name: orderData.lastName || orderData.name?.split(' ').slice(1).join(' ') || '',
          address1: orderData.shippingAddress || orderData.shippingAddress1 || '',
          address2: orderData.shippingAddress2 || '',
          city: orderData.shippingCity || '',
          province: orderData.shippingState || '',
          zip: orderData.shippingPostalCode || '',
          country: orderData.shippingCountry || 'US',
          phone: orderData.shippingPhone || ''
        },
        billing_address: {
          first_name: orderData.firstName || orderData.name?.split(' ')[0] || '',
          last_name: orderData.lastName || orderData.name?.split(' ').slice(1).join(' ') || '',
          address1: orderData.shippingAddress || orderData.shippingAddress1 || '',
          address2: orderData.shippingAddress2 || '',
          city: orderData.shippingCity || '',
          province: orderData.shippingState || '',
          zip: orderData.shippingPostalCode || '',
          country: orderData.shippingCountry || 'US'
        },
        use_customer_default_address: false,
        status: 'open'
      }
    };
    
    logger.info(`Creating draft order for backer ${orderData.backerNumber}`);
    const response = await client.post('draft_orders', draftOrderData);
    
    return {
      success: true,
      orderId: response.draft_order.id.toString(),
      orderNumber: response.draft_order.name || `#D${response.draft_order.id}`
    };
    
  } catch (error) {
    logger.error(`Failed to create order: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Validate SKUs exist in Shopify - ORIGINAL WORKING VERSION PRESERVED
 */
async function validateSkus(session, skus) {
  const client = createShopifyClient();
  const results = {
    valid: [],
    invalid: []
  };
  
  try {
    for (const sku of skus) {
      try {
        const response = await client.get('products', { 
          fields: 'id,title,variants',
          limit: 250 
        });
        
        let found = false;
        for (const product of response.products) {
          for (const variant of product.variants) {
            if (variant.sku === sku) {
              results.valid.push({
                sku: sku,
                variantId: variant.id,
                productTitle: product.title
              });
              found = true;
              break;
            }
          }
          if (found) break;
        }
        
        if (!found) {
          results.invalid.push(sku);
        }
      } catch (error) {
        logger.error(`Error validating SKU ${sku}: ${error.message}`);
        results.invalid.push(sku);
      }
    }
  } catch (error) {
    logger.error(`SKU validation failed: ${error.message}`);
    throw error;
  }
  
  return results;
}

/**
 * Fetch orders from Shopify store with pagination
 */
async function fetchAllShopifyOrders(fulfillmentStatus = 'unfulfilled') {
  const fetch = require('node-fetch');
  const shopUrl = SHOPIFY_STORE_URL;
  
  let allOrders = [];
  let nextPageUrl = `https://${shopUrl}/admin/api/2024-10/orders.json?status=any&limit=250&fulfillment_status=${fulfillmentStatus}`;
  let pageCount = 0;
  
  while (nextPageUrl && pageCount < 50) {
    pageCount++;
    console.log(`Fetching orders page ${pageCount}...`);
    
    const response = await fetch(nextPageUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status}`);
    }
    
    const data = await response.json();
    allOrders = allOrders.concat(data.orders);
    
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
  
  console.log(`Fetched ${allOrders.length} orders from ${pageCount} pages`);
  return allOrders;
}

/**
 * Identify duplicate customers based on email
 */
function identifyDuplicateCustomers(orders) {
  const customerMap = new Map();
  
  orders.forEach(order => {
    if (order.email) {
      const email = order.email.toLowerCase().trim();
      
      if (!customerMap.has(email)) {
        customerMap.set(email, {
          email: email,
          orderIds: [],
          orderCount: 0,
          totalSpent: 0,
          name: order.customer?.first_name && order.customer?.last_name 
            ? `${order.customer.first_name} ${order.customer.last_name}` 
            : order.billing_address?.name || 'Unknown'
        });
      }
      
      const customer = customerMap.get(email);
      customer.orderIds.push(order.id);
      customer.orderCount++;
      customer.totalSpent += parseFloat(order.total_price || 0);
    }
  });
  
  const duplicateCustomers = Array.from(customerMap.values())
    .filter(customer => customer.orderCount > 1)
    .sort((a, b) => b.orderCount - a.orderCount);
  
  return {
    totalCustomers: customerMap.size,
    duplicateCustomers: duplicateCustomers
  };
}

/**
 * Get preview of what would happen if we merged customer orders
 */
async function getCustomerMergePreview(email, orderIds) {
  const client = createShopifyClient();
  
  const orderDetails = [];
  for (const orderId of orderIds) {
    try {
      const response = await client.get(`orders/${orderId}`);
      orderDetails.push(response.order);
    } catch (error) {
      console.error(`Error fetching order ${orderId}:`, error.message);
    }
  }
  
  return {
    email: email,
    orderCount: orderDetails.length,
    orders: orderDetails.map(order => ({
      id: order.id,
      name: order.name,
      created_at: order.created_at,
      total_price: order.total_price,
      line_items: order.line_items.length
    }))
  };
}

/**
 * Merge multiple orders for the same customer
 */
async function mergeCustomerOrders(email, orderIds) {
  const client = createShopifyClient();

  // This is a placeholder - actual implementation would depend on requirements
  // You might want to:
  // 1. Cancel duplicate orders
  // 2. Combine line items into one order
  // 3. Update customer records

  console.log(`Merging ${orderIds.length} orders for ${email}`);

  return {
    email: email,
    totalOrders: orderIds.length,
    message: 'Merge preview - actual merge not implemented yet'
  };
}

/**
 * Fetch all open draft orders from Shopify
 */
async function fetchOpenDraftOrders() {
  const fetch = require('node-fetch');
  const shopUrl = SHOPIFY_STORE_URL;

  let allDraftOrders = [];
  let nextPageUrl = `https://${shopUrl}/admin/api/2024-10/draft_orders.json?status=open&limit=250`;
  let pageCount = 0;

  try {
    while (nextPageUrl && pageCount < 50) {
      pageCount++;
      console.log(`Fetching draft orders page ${pageCount}...`);

      const response = await fetch(nextPageUrl, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Shopify API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      allDraftOrders = allDraftOrders.concat(data.draft_orders || []);

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

    console.log(`Fetched ${allDraftOrders.length} open draft orders from ${pageCount} pages`);
    logger.info(`Fetched ${allDraftOrders.length} open draft orders`);

    return allDraftOrders;
  } catch (error) {
    logger.error(`Error fetching open draft orders: ${error.message}`);
    throw error;
  }
}

/**
 * Mark draft orders as paid by completing them
 * This will convert the draft order to a regular order with status=paid
 */
async function markDraftOrdersAsPaid(draftOrderIds) {
  const client = createShopifyClient();
  const results = {
    success: [],
    failed: []
  };

  logger.info(`Starting to mark ${draftOrderIds.length} draft orders as paid`);

  for (const draftOrderId of draftOrderIds) {
    try {
      // First, fetch the draft order to get its details
      const draftOrderResponse = await client.get(`draft_orders/${draftOrderId}`);
      const draftOrder = draftOrderResponse.draft_order;

      // Complete the draft order - this converts it to a regular order
      // We mark it as paid by setting payment_pending to false
      const completeResponse = await client.put(`draft_orders/${draftOrderId}/complete`, {
        payment_pending: false
      });

      const completedOrder = completeResponse.draft_order;

      results.success.push({
        draftOrderId: draftOrderId,
        draftOrderName: draftOrder.name,
        orderId: completedOrder.order_id,
        orderName: completedOrder.name,
        customerEmail: draftOrder.email,
        totalPrice: draftOrder.total_price
      });

      logger.info(`✓ Successfully marked draft order ${draftOrder.name} as paid, created order #${completedOrder.order_id}`);

    } catch (error) {
      logger.error(`Failed to mark draft order ${draftOrderId} as paid: ${error.message}`);

      results.failed.push({
        draftOrderId: draftOrderId,
        error: error.message
      });
    }
  }

  logger.info(`Mark as paid completed: ${results.success.length} successful, ${results.failed.length} failed`);

  return results;
}

module.exports = {
  importOrders,
  validateSkus,
  createOrder,
  createShopifyClient,
  findOrCreateCustomer,
  fetchAllShopifyOrders,
  identifyDuplicateCustomers,
  getCustomerMergePreview,
  mergeCustomerOrders,
  fetchOpenDraftOrders,
  markDraftOrdersAsPaid
};