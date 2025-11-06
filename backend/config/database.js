// Database configuration with proper URL encoding handling
// Location: /backend/config/

const { Sequelize } = require('sequelize');
require('dotenv').config();

// Parse DATABASE_URL or use individual components
let sequelize;

if (process.env.DATABASE_URL) {
  // Use DATABASE_URL if provided (handles URL-encoded characters like %23 for #)
  try {
    console.log('Connecting to database using DATABASE_URL...');
    
    sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: false
      }
    });
  } catch (error) {
    console.error('Failed to parse DATABASE_URL, falling back to individual parameters');
    console.error('Error:', error.message);
  }
}

// Fallback to individual parameters if DATABASE_URL fails or is not set
if (!sequelize) {
  console.log('Connecting to database using individual parameters...');
  
  const dbConfig = {
    database: process.env.DB_NAME || 'kickstarter_app',
    username: process.env.DB_USER || 'app-user',
    password: process.env.DB_PASSWORD || 'TAWldraGLKE#HUKEjajUPoxutaxIgowisWostetRUwRoNAZ0ceFldr+sweDuMoki',
    host: process.env.DB_HOST || 'kickstarter-db',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false
  };
  
  sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
      host: dbConfig.host,
      port: dbConfig.port,
      dialect: dbConfig.dialect,
      logging: dbConfig.logging
    }
  );
}

// Test the connection
sequelize.authenticate()
  .then(() => {
    console.log('✅ Database connection established successfully.');
  })
  .catch(err => {
    console.error('❌ Unable to connect to the database:', err);
  });

module.exports = sequelize;