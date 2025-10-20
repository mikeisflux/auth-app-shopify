// Database Migration Script
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

async function runMigration() {
  console.log('🚀 Starting database migration...\n');

  // Create connection pool
  const pool = new Pool({
    host: process.env.AWS_DB_HOST,
    port: parseInt(process.env.AWS_DB_PORT || '5432'),
    database: process.env.AWS_DB_NAME,
    user: process.env.AWS_DB_USER,
    password: process.env.AWS_DB_PASSWORD,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Test connection
    console.log('📡 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');

    // Read schema file
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    console.log(`📄 Reading schema from: ${schemaPath}`);
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error('Schema file not found at: ' + schemaPath);
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('✅ Schema file loaded\n');

    // Execute schema
    console.log('🔨 Executing database schema...');
    await pool.query(schemaSql);
    console.log('✅ Schema executed successfully\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('📋 Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // Verify views were created
    const viewsResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    if (viewsResult.rows.length > 0) {
      console.log('\n📋 Created views:');
      viewsResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    }

    // Verify functions were created
    const functionsResult = await pool.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_type = 'FUNCTION'
      ORDER BY routine_name;
    `);

    if (functionsResult.rows.length > 0) {
      console.log('\n📋 Created functions:');
      functionsResult.rows.forEach(row => {
        console.log(`   - ${row.routine_name}`);
      });
    }

    console.log('\n✨ Migration completed successfully! ✨\n');
    console.log('Your database is ready to use.');
    console.log('You can now run: npm run dev\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
runMigration();