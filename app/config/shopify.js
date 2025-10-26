import '@shopify/shopify-api/adapters/node';
import { shopifyApp } from '@shopify/shopify-app-express';
import { PostgreSQLSessionStorage } from '@shopify/shopify-app-session-storage-postgresql';
import { ShopModel } from '../models/shop.server.js';

const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET || '',
    scopes: process.env.SCOPES?.split(',') || ['write_products', 'read_customers', 'write_files'],
    hostName: process.env.HOST?.replace(/https?:\/\//, '') || '',
    hostScheme: 'https',
    apiVersion: '2024-10',
    isEmbeddedApp: true,
  },
  auth: {
    path: '/auth',
    callbackPath: '/auth/callback',
  },
  webhooks: {
    path: '/webhooks',
  },
  sessionStorage: new PostgreSQLSessionStorage(
    process.env.DATABASE_URL,
    {
      connectionOptions: {
        ssl: { rejectUnauthorized: false }
      }
    }
  ),
  useOnlineTokens: false,
});

// Configure webhook handlers
shopify.api.webhooks.addHandlers({
  APP_UNINSTALLED: {
    deliveryMethod: 'http',
    callbackUrl: '/webhooks',
    callback: async (topic, shop, body) => {
      console.log('App uninstalled:', shop);
      await ShopModel.markUninstalled(shop);
    }
  }
});

export default shopify;
export const authenticate = shopify.authenticate;
export const sessionStorage = shopify.sessionStorage;
