import { query } from './db/connection.server.js';

async function checkImages() {
  try {
    const result = await query(
      'SELECT id, name, serial_number, image_url, shopify_file_id FROM items ORDER BY created_at DESC LIMIT 5'
    );
    console.log('Recent items:');
    console.log(JSON.stringify(result.rows, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkImages();
