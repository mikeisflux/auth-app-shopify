import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion, DeliveryMethod } from '@shopify/shopify-api';
import { PostgreSQLSessionStorage } from '@shopify/shopify-app-session-storage-postgresql';

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || '',
  scopes: process.env.SCOPES?.split(',') || [],
  hostName: process.env.HOST?.replace(/https?:\/\//, '') || '',
  hostScheme: 'https',
  apiVersion: ApiVersion.October24,
  isEmbeddedApp: true,
  sessionStorage: new PostgreSQLSessionStorage(
    process.env.DATABASE_URL,
    {
      connectionOptions: {
        ssl: { rejectUnauthorized: false }
      }
    }
  ),
});

// Configure webhooks
shopify.webhooks.addHandlers({
  APP_UNINSTALLED: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: '/webhooks',
    callback: async (topic, shop, body, webhookId) => {
      console.log('App uninstalled:', shop);
      // Handle app uninstallation
      const { ShopModel } = await import('../models/shop.server.js');
      await ShopModel.markUninstalled(shop);
    }
  },
  CUSTOMERS_DATA_REQUEST: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: '/webhooks',
    callback: async (topic, shop, body) => {
      console.log('Customer data request:', shop);
      // Handle GDPR data request
    }
  },
  CUSTOMERS_REDACT: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: '/webhooks',
    callback: async (topic, shop, body) => {
      console.log('Customer data redact:', shop);
      // Handle GDPR customer redaction
    }
  },
  SHOP_REDACT: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: '/webhooks',
    callback: async (topic, shop, body) => {
      console.log('Shop data redact:', shop);
      // Handle GDPR shop redaction
    }
  }
});

export default shopify;
