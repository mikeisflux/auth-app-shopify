import express from 'express';
import shopify from '../config/shopify.js';
import { CategoryModel } from '../models/category.server.js';
import { ItemModel } from '../models/item.server.js';
import { ShopModel } from '../models/shop.server.js';
import { BillingService } from '../services/billing.server.js';

const router = express.Router();

// Middleware to verify Shopify session
async function verifySession(req, res, next) {
  try {
    const sessionId = await shopify.session.getCurrentId({
      isOnline: false,
      rawRequest: req,
      rawResponse: res,
    });

    if (!sessionId) {
      return res.redirect(`/auth?shop=${req.query.shop}`);
    }

    const session = await shopify.config.sessionStorage.loadSession(sessionId);

    if (!session) {
      return res.redirect(`/auth?shop=${req.query.shop}`);
    }

    req.session = session;
    req.shopDomain = session.shop;
    next();
  } catch (error) {
    console.error('Session verification error:', error);
    res.redirect(`/auth?shop=${req.query.shop}`);
  }
}

// Helper to render with layout
function renderPage(res, view, data) {
  res.render('layout', {
    apiKey: process.env.SHOPIFY_API_KEY,
    host: data.host || '',
    body: res.render(view, data, (err, html) => {
      if (err) throw err;
      return html;
    })
  });
}

// Dashboard
router.get('/', verifySession, async (req, res) => {
  try {
    const shopDomain = req.shopDomain;

    // Get subscription status
    const subscription = await ShopModel.getSubscription(shopDomain);

    // Get plan details server-side
    const planDetails = subscription?.subscription_plan
      ? BillingService.getPlanDetails(subscription.subscription_plan)
      : null;

    // Get statistics
    const categories = await CategoryModel.findAll(shopDomain);
    const itemStats = await ItemModel.findAll(shopDomain, { limit: 1 });

    const stats = {
      totalCategories: categories.length,
      totalItems: itemStats.total,
      activeCategories: categories.filter(c => c.is_active).length
    };

    res.render('dashboard', {
      title: 'Collectible Tracker Dashboard',
      stats,
      subscription,
      planDetails,
      categories: categories.slice(0, 5),
      hasActiveSubscription: subscription?.subscription_status === 'active',
      host: req.query.host || '',
      apiKey: process.env.SHOPIFY_API_KEY
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Error loading dashboard');
  }
});

// App routes
router.get('/app', verifySession, (req, res) => {
  res.redirect('/');
});

// Categories list
router.get('/app/categories', verifySession, async (req, res) => {
  try {
    const categories = await CategoryModel.findAll(req.shopDomain);

    res.render('categories', {
      title: 'Categories',
      categories,
      host: req.query.host || '',
      apiKey: process.env.SHOPIFY_API_KEY
    });
  } catch (error) {
    console.error('Categories list error:', error);
    res.status(500).send('Error loading categories');
  }
});

// Create category page
router.get('/app/categories/new', verifySession, async (req, res) => {
  try {
    res.render('category-form', {
      title: 'Create Category',
      category: null,
      isEdit: false,
      host: req.query.host || '',
      apiKey: process.env.SHOPIFY_API_KEY
    });
  } catch (error) {
    console.error('Category create page error:', error);
    res.status(500).send('Error loading category form');
  }
});

// Create category API
router.post('/app/categories', verifySession, async (req, res) => {
  try {
    const { name, description, displayOrder } = req.body;

    const category = await CategoryModel.create(req.shopDomain, {
      name,
      description,
      displayOrder: displayOrder ? parseInt(displayOrder) : 0
    });

    res.json({ success: true, category });
  } catch (error) {
    console.error('Category create error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// View category items
router.get('/app/categories/:categoryId/items', verifySession, async (req, res) => {
  try {
    const { categoryId } = req.params;
    const category = await CategoryModel.findById(categoryId, req.shopDomain);

    if (!category) {
      return res.status(404).send('Category not found');
    }

    const result = await ItemModel.findAll(req.shopDomain, { categoryId });

    res.render('items', {
      title: `${category.name} - Items`,
      category,
      items: result.items,
      host: req.query.host || '',
      apiKey: process.env.SHOPIFY_API_KEY
    });
  } catch (error) {
    console.error('Items list error:', error);
    res.status(500).send('Error loading items');
  }
});

// Billing page
router.get('/app/billing', verifySession, async (req, res) => {
  try {
    const subscription = await ShopModel.getSubscription(req.shopDomain);
    const plans = BillingService.getAvailablePlans();

    res.render('billing', {
      title: 'Billing & Subscription',
      subscription,
      plans,
      hasActiveSubscription: subscription?.subscription_status === 'active',
      host: req.query.host || '',
      apiKey: process.env.SHOPIFY_API_KEY
    });
  } catch (error) {
    console.error('Billing page error:', error);
    res.status(500).send('Error loading billing');
  }
});

export default router;
