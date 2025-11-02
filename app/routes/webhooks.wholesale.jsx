// Wholesale Webhook Handlers
import { authenticate } from "../shopify.server";
import { WholesaleModel } from "../models/wholesale.server";
import { query } from "../db/connection.server";

/**
 * Handle customer creation - add to wholesale tracking
 */
export const action = async ({ request }) => {
  const { topic, shop, session, admin } = await authenticate.webhook(request);

  const webhookData = await request.json();

  try {
    // Log webhook
    await logWebhook(shop, topic, webhookData);

    switch (topic) {
      case "CUSTOMERS_CREATE":
        await handleCustomerCreate(shop, webhookData);
        break;

      case "CUSTOMERS_UPDATE":
        await handleCustomerUpdate(shop, webhookData);
        break;

      case "ORDERS_CREATE":
        await handleOrderCreate(shop, webhookData);
        break;

      case "ORDERS_PAID":
        await handleOrderPaid(shop, webhookData);
        break;

      case "CUSTOMERS_DATA_REQUEST":
        // GDPR: Customer requests their data
        await handleDataRequest(shop, webhookData);
        break;

      case "CUSTOMERS_REDACT":
        // GDPR: Customer requests data deletion
        await handleCustomerRedact(shop, webhookData);
        break;

      case "SHOP_REDACT":
        // GDPR: Shop uninstalls app
        await handleShopRedact(shop);
        break;

      default:
        console.log(`Unhandled webhook topic: ${topic}`);
    }

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error(`Webhook error for ${topic}:`, error);
    await logWebhookError(shop, topic, webhookData, error.message);
    return new Response(error.message, { status: 500 });
  }
};

/**
 * Log webhook for debugging and compliance
 */
async function logWebhook(shopDomain, topic, payload) {
  try {
    await query(
      `INSERT INTO wholesale_webhook_logs
       (shop_id, webhook_topic, payload, received_at)
       SELECT s.id, $2, $3, CURRENT_TIMESTAMP
       FROM shops s
       WHERE s.shop_domain = $1`,
      [shopDomain, topic, JSON.stringify(payload)]
    );
  } catch (error) {
    console.error('Error logging webhook:', error);
  }
}

/**
 * Log webhook processing error
 */
async function logWebhookError(shopDomain, topic, payload, errorMessage) {
  try {
    await query(
      `INSERT INTO wholesale_webhook_logs
       (shop_id, webhook_topic, payload, processed, processing_error, received_at)
       SELECT s.id, $2, $3, false, $4, CURRENT_TIMESTAMP
       FROM shops s
       WHERE s.shop_domain = $1`,
      [shopDomain, topic, JSON.stringify(payload), errorMessage]
    );
  } catch (error) {
    console.error('Error logging webhook error:', error);
  }
}

/**
 * Handle customer creation
 */
async function handleCustomerCreate(shopDomain, data) {
  const { id, email, tags } = data;

  // Check if customer has wholesale tags
  const customerTags = tags ? tags.split(', ') : [];
  const wholesaleTags = ['wholesale', 'b2b', 'reseller', 'kickstarter'];
  const hasWholesaleTag = customerTags.some(tag =>
    wholesaleTags.some(wTag => tag.toLowerCase().includes(wTag.toLowerCase()))
  );

  if (hasWholesaleTag) {
    // Auto-add to wholesale customers
    try {
      await WholesaleModel.createWholesaleCustomer(shopDomain, {
        shopifyCustomerId: id,
        email: email,
        wholesaleApproved: false, // Requires manual approval
        customerTags: customerTags,
        notes: 'Auto-added from customer creation webhook'
      });
      console.log(`Added wholesale customer: ${email}`);
    } catch (error) {
      // Customer might already exist
      console.log(`Customer ${email} already in wholesale system`);
    }
  }

  // Mark webhook as processed
  await markWebhookProcessed(shopDomain, 'CUSTOMERS_CREATE', data.id);
}

/**
 * Handle customer update
 */
async function handleCustomerUpdate(shopDomain, data) {
  const { id, email, tags, orders_count, total_spent } = data;

  // Check if customer exists in wholesale system
  const customer = await WholesaleModel.getWholesaleCustomerByShopifyId(id, shopDomain);

  if (customer) {
    // Update customer data
    const customerTags = tags ? tags.split(', ') : [];

    await WholesaleModel.updateWholesaleCustomer(customer.id, shopDomain, {
      customerTags: customerTags,
      orderCount: orders_count || 0,
      totalSpent: parseFloat(total_spent || 0)
    });

    console.log(`Updated wholesale customer: ${email}`);
  }

  await markWebhookProcessed(shopDomain, 'CUSTOMERS_UPDATE', data.id);
}

/**
 * Handle order creation
 */
async function handleOrderCreate(shopDomain, data) {
  const { id, customer, tags, total_price, line_items } = data;

  if (!customer) {
    await markWebhookProcessed(shopDomain, 'ORDERS_CREATE', data.id);
    return;
  }

  // Check if this is a wholesale order
  const orderTags = tags ? tags.split(', ') : [];
  const isWholesaleOrder = orderTags.some(tag =>
    tag.toLowerCase().includes('wholesale') ||
    tag.toLowerCase().includes('b2b')
  );

  if (isWholesaleOrder) {
    // Update wholesale customer stats
    const wholesaleCustomer = await WholesaleModel.getWholesaleCustomerByShopifyId(
      customer.id,
      shopDomain
    );

    if (wholesaleCustomer) {
      await WholesaleModel.updateWholesaleCustomer(
        wholesaleCustomer.id,
        shopDomain,
        {
          orderCount: wholesaleCustomer.order_count + 1,
          totalSpent: parseFloat(wholesaleCustomer.total_spent) + parseFloat(total_price)
        }
      );

      console.log(`Updated wholesale order stats for customer: ${customer.email}`);
    }
  }

  await markWebhookProcessed(shopDomain, 'ORDERS_CREATE', data.id);
}

/**
 * Handle order paid
 */
async function handleOrderPaid(shopDomain, data) {
  // Additional processing when order is paid
  // Could trigger fulfillment, send notifications, etc.
  await markWebhookProcessed(shopDomain, 'ORDERS_PAID', data.id);
}

/**
 * Handle GDPR data request
 */
async function handleDataRequest(shopDomain, data) {
  const { customer } = data;

  // Fetch all customer data from wholesale system
  const wholesaleCustomer = await WholesaleModel.getWholesaleCustomerByShopifyId(
    customer.id,
    shopDomain
  );

  if (wholesaleCustomer) {
    // Log the data request
    console.log(`GDPR data request for customer ${customer.email}`);

    // In production, you would:
    // 1. Generate a data export
    // 2. Send it to the customer
    // 3. Log the compliance activity
  }

  await markWebhookProcessed(shopDomain, 'CUSTOMERS_DATA_REQUEST', data.customer.id);
}

/**
 * Handle GDPR customer data deletion
 */
async function handleCustomerRedact(shopDomain, data) {
  const { customer } = data;

  // Delete customer from wholesale system
  const wholesaleCustomer = await WholesaleModel.getWholesaleCustomerByShopifyId(
    customer.id,
    shopDomain
  );

  if (wholesaleCustomer) {
    await WholesaleModel.deleteWholesaleCustomer(wholesaleCustomer.id, shopDomain);
    console.log(`Redacted wholesale customer data for ${customer.email}`);
  }

  // Also delete from eligibility checks
  await query(
    `DELETE FROM eligibility_checks
     WHERE shop_id IN (SELECT id FROM shops WHERE shop_domain = $1)
     AND email = $2`,
    [shopDomain, customer.email]
  );

  await markWebhookProcessed(shopDomain, 'CUSTOMERS_REDACT', data.customer.id);
}

/**
 * Handle GDPR shop deletion
 */
async function handleShopRedact(shopDomain) {
  // Delete all wholesale data for the shop
  // Foreign key cascades will handle related data
  await query(
    `DELETE FROM wholesale_settings
     WHERE shop_id IN (SELECT id FROM shops WHERE shop_domain = $1)`,
    [shopDomain]
  );

  console.log(`Redacted all wholesale data for shop: ${shopDomain}`);

  await markWebhookProcessed(shopDomain, 'SHOP_REDACT', shopDomain);
}

/**
 * Mark webhook as processed
 */
async function markWebhookProcessed(shopDomain, topic, referenceId) {
  try {
    await query(
      `UPDATE wholesale_webhook_logs
       SET processed = true, processed_at = CURRENT_TIMESTAMP
       WHERE shop_id IN (SELECT id FROM shops WHERE shop_domain = $1)
       AND webhook_topic = $2
       AND shopify_webhook_id = $3`,
      [shopDomain, topic, referenceId.toString()]
    );
  } catch (error) {
    console.error('Error marking webhook as processed:', error);
  }
}
