// Shopify Configuration for Custom App
// Location: /backend/config/

// CRITICAL: Load the Node.js adapter FIRST - DO NOT REMOVE THIS LINE
require('@shopify/shopify-api/adapters/node');
const { shopifyApi, ApiVersion } = require('@shopify/shopify-api');
require('dotenv').config();

// Extract hostname from the HOST environment variable (remove https://)
const HOST_URL = process.env.HOST || 'https://dvc-cloud.swordfish-walleye.ts.net';
const hostName = HOST_URL.replace(/https?:\/\//, '').split('/')[0];

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: (process.env.SCOPES || 'write_orders,read_products,read_inventory').split(','),
  hostName: hostName,  // Uses extracted hostname without https://
  apiVersion: process.env.SHOPIFY_API_VERSION || ApiVersion.October24,
  isCustomStoreApp: true,  // This is a custom app, not OAuth
  adminApiAccessToken: process.env.SHOPIFY_ACCESS_TOKEN,  // REQUIRED for custom apps
});

module.exports = { shopify };