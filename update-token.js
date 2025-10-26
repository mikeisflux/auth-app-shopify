import { query } from './db/connection.server.js';

async function updateToken() {
  try {
    // Get token and shop from command line arguments
    const newToken = process.argv[2];
    const shopDomain = process.argv[3] || '730ff7.myshopify.com';

    if (!newToken) {
      console.error('Usage: node update-token.js <access_token> [shop_domain]');
      console.error('Example: node update-token.js shpss_xxxxx 730ff7.myshopify.com');
      process.exit(1);
    }

    console.log('Updating access token for:', shopDomain);

    const result = await query(
      `UPDATE shops
       SET access_token = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE shop_domain = $2
       RETURNING shop_domain, access_token, scope, updated_at`,
      [newToken, shopDomain]
    );

    if (result.rows.length > 0) {
      console.log('\n✅ Token updated successfully!');
      console.log('Shop:', result.rows[0].shop_domain);
      console.log('Token starts with:', result.rows[0].access_token.substring(0, 10) + '...');
      console.log('Updated at:', result.rows[0].updated_at);
    } else {
      console.log('\n❌ Shop not found in database');
    }

    // Test the new token
    console.log('\n========== TESTING NEW TOKEN ==========');
    const testQuery = `
      query {
        shop {
          name
          email
        }
      }
    `;

    const response = await fetch(`https://${shopDomain}/admin/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': newToken
      },
      body: JSON.stringify({ query: testQuery })
    });

    console.log('Response status:', response.status);
    const data = await response.json();

    if (response.ok && data.data) {
      console.log('\n✅ NEW TOKEN IS VALID!');
      console.log('Shop name:', data.data.shop.name);
      console.log('Shop email:', data.data.shop.email);
      console.log('\n🎉 You can now upload images!');
    } else {
      console.log('\n❌ NEW TOKEN IS STILL INVALID!');
      console.log('Response:', JSON.stringify(data, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateToken();
