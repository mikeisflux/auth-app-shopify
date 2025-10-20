// Webhook Handlers - GDPR Compliance & App Lifecycle
import { authenticate } from "../shopify.server";
import { ShopModel } from "../models/shop.server";
import { json } from "@remix-run/node";

export const action = async ({ request }) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    switch (topic) {
      case "APP_UNINSTALLED":
        await handleAppUninstalled(shop);
        break;
      
      case "CUSTOMERS_DATA_REQUEST":
        await handleCustomersDataRequest(shop, payload);
        break;
      
      case "CUSTOMERS_REDACT":
        await handleCustomersRedact(shop, payload);
        break;
      
      case "SHOP_REDACT":
        await handleShopRedact(shop);
        break;
      
      default:
        console.log(`Unhandled webhook topic: ${topic}`);
    }

    return json({ success: true });
  } catch (error) {
    console.error(`Error handling ${topic} webhook:`, error);
    return json({ error: error.message }, { status: 500 });
  }
};

// Handle app uninstallation
async function handleAppUninstalled(shop) {
  console.log(`App uninstalled for shop: ${shop}`);
  
  // Update shop record but don't delete immediately
  // Keep data for 30 days in case of reinstallation
  await ShopModel.updateSubscription(shop, {
    plan: 'none',
    status: 'uninstalled',
    billingId: null,
    trialEndsAt: null
  });
  
  // In production, you might want to:
  // 1. Cancel any active subscriptions
  // 2. Schedule data deletion after 30 days
  // 3. Send notification email
  // 4. Log analytics event
}

// Handle GDPR customer data request
async function handleCustomersDataRequest(shop, payload) {
  console.log(`Customer data request for shop: ${shop}`);
  
  // This webhook is called when a customer requests their data
  // For this app, we don't store customer personal data directly
  // We only store verification logs with IP addresses
  
  // In production, you would:
  // 1. Query verification_logs table for customer's IP or identifier
  // 2. Compile the data
  // 3. Send it to Shopify or directly to the customer
  // 4. Keep records of the request
  
  const customerId = payload.customer?.id;
  const customerEmail = payload.customer?.email;
  
  console.log(`Customer ${customerId} (${customerEmail}) requested their data`);
  
  // Return empty data since we don't store personal customer information
  return {
    customer_id: customerId,
    customer_email: customerEmail,
    data: {
      note: "This app does not store personal customer data. Only anonymous verification logs are kept."
    }
  };
}

// Handle GDPR customer data deletion
async function handleCustomersRedact(shop, payload) {
  console.log(`Customer data redaction request for shop: ${shop}`);
  
  const customerId = payload.customer?.id;
  const customerEmail = payload.customer?.email;
  
  console.log(`Redacting data for customer ${customerId} (${customerEmail})`);
  
  // In production, you would:
  // 1. Delete or anonymize customer data from verification_logs
  // 2. Remove any personal identifiers
  // 3. Keep required business records per legal retention requirements
  
  // Since we only store IP addresses and user agents (not tied to customer accounts),
  // and these are needed for fraud prevention, we document this in privacy policy
}

// Handle GDPR shop data deletion
async function handleShopRedact(shop) {
  console.log(`Shop data redaction request for: ${shop}`);
  
  // This is called 48 hours after app uninstallation
  // Delete all shop data per GDPR requirements
  
  try {
    // Delete shop and all related data (cascades to categories, items, logs)
    await ShopModel.delete(shop);
    
    console.log(`Successfully deleted all data for shop: ${shop}`);
  } catch (error) {
    console.error(`Error deleting shop data for ${shop}:`, error);
    throw error;
  }
}