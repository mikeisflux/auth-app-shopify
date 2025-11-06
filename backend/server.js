// Server.js - Updated with Fulfillment Routes - PRESERVES ALL EXISTING FUNCTIONALITY
// Location: /backend/server.js

// CRITICAL: Node.js adapter MUST be at the very top for Shopify API
require('@shopify/shopify-api/adapters/node');

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { shopify } = require('./config/shopify');
const { syncDatabase } = require('./models');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax'
    }
  })
);

// Serve static files (React build)
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// EXISTING ROUTES - ALL PRESERVED
app.use('/api', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/import', require('./routes/import'));
app.use('/api/project', require('./routes/projects'));

// NEW FULFILLMENT ROUTES - ADDED ONLY
app.use('/api/fulfillment', require('./routes/fulfillment'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/employee', require('./routes/employee'));

// DRAFT ORDERS ROUTES - Mark as Paid functionality
app.use('/api/draft-orders', require('./routes/draftOrders'));

// Handle all other routes - serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

const PORT = process.env.PORT || 3000;

// Initialize database and start server
syncDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Using Custom Shopify App (not OAuth)`);
      console.log(`Shop: ${process.env.SHOPIFY_STORE_URL || 'Not configured'}`);
      console.log(`Access Token: ${process.env.SHOPIFY_ACCESS_TOKEN ? 'Configured' : 'Missing'}`);
      console.log(`📦 Fulfillment System: ACTIVE`);
    });
  })
  .catch(err => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });