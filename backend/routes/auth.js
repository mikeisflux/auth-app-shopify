// Simplified auth routes for Custom App (no OAuth needed)
// Location: /backend/routes/

const express = require('express');
const router = express.Router();
require('dotenv').config();

// Mock auth for custom app - just sets the session with permanent token
router.get('/auth', async (req, res) => {
  // For custom apps, we already have the permanent access token
  req.session.shopify = {
    shop: process.env.SHOPIFY_STORE_URL,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN
  };
  
  console.log('Auth session created for custom app');
  res.redirect('/dashboard');
});

// Mock callback for compatibility (not needed but kept for route consistency)
router.get('/auth/callback', async (req, res) => {
  req.session.shopify = {
    shop: process.env.SHOPIFY_STORE_URL,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN
  };
  res.redirect('/dashboard');
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true });
  });
});

// Check auth status (always authenticated for custom app)
router.get('/status', (req, res) => {
  res.json({ 
    authenticated: true,
    shop: process.env.SHOPIFY_STORE_URL,
    isCustomApp: true
  });
});

module.exports = router;