import { query } from './db/connection.server.js';
import 'dotenv/config';

async function debugToken() {
  try {
    // Get all shops
    const result = await query('SELECT shop_domain, access_token, scope, created_at FROM shops');

    console.log('\n========== SHOPS IN DATABASE ==========');
    result.rows.forEach(shop => {
      console.log('\nShop:', shop.shop_domain);
      console.log('Token exists:', !!shop.access_token);
      console.log('Token starts with:', shop.access_token ? shop.access_token.substring(0, 10) + '...' : 'null');
      console.log('Token length:', shop.access_token ? shop.access_token.length : 0);
      console.log('Scopes:', shop.scope);
      console.log('Created:', shop.created_at);
    });

    console.log('\n========== ENVIRONMENT VARIABLES ==========');
    console.log('SHOPIFY_API_KEY:', process.env.SHOPIFY_API_KEY);
    console.log('SHOPIFY_API_SECRET exists:', !!process.env.SHOPIFY_API_SECRET);
    console.log('SCOPES:', process.env.SCOPES);

    // Test the token
    if (result.rows.length > 0) {
      const shop = result.rows[0];
      console.log('\n========== TESTING TOKEN ==========');
      console.log('Testing shop:', shop.shop_domain);

      const testQuery = `
        query {
          shop {
            name
            email
          }
        }
      `;

      const response = await fetch(`https://${shop.shop_domain}/admin/api/2024-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shop.access_token
        },
        body: JSON.stringify({ query: testQuery })
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response:', JSON.stringify(data, null, 2));

      if (response.ok && data.data) {
        console.log('\n✅ TOKEN IS VALID!');
        console.log('Shop name:', data.data.shop.name);
      } else {
        console.log('\n❌ TOKEN IS INVALID!');
        if (data.errors) {
          console.log('Error:', data.errors);
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugToken();
