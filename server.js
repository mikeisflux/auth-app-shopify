import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import shopify from './app/config/shopify.js';
import { ShopModel } from './app/models/shop.server.js';
import { CategoryModel } from './app/models/category.server.js';
import { ItemModel } from './app/models/item.server.js';
import { BillingService } from './app/services/billing.server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/public', express.static(join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

// Setup Shopify authentication
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  async (req, res) => {
    try {
      const session = res.locals.shopify.session;

      await ShopModel.upsert({
        shopDomain: session.shop,
        accessToken: session.accessToken,
        scope: session.scope
      });

      // Register webhooks
      await shopify.api.webhooks.register({ session });

      // Redirect to app
      const redirectUrl = `/?shop=${session.shop}&host=${req.query.host || ''}`;
      return res.redirect(redirectUrl);
    } catch (error) {
      console.error('Auth callback error:', error);
      return res.status(500).send('Authentication failed: ' + error.message);
    }
  }
);

// Webhooks
app.post(shopify.config.webhooks.path, shopify.processWebhooks({ webhookHandlers: {
  APP_UNINSTALLED: {
    deliveryMethod: 'http',
    callbackUrl: '/webhooks',
    callback: async (topic, shop, body) => {
      console.log('App uninstalled:', shop);
      await ShopModel.markUninstalled(shop);
    }
  }
}}));

// Middleware for browser-based routes
const ensureInstalled = shopify.ensureInstalledOnShop();

// Dashboard
app.get('/', ensureInstalled, async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const shopDomain = session.shop;

    const subscription = await ShopModel.getSubscription(shopDomain);
    const planDetails = subscription?.subscription_plan
      ? BillingService.getPlanDetails(subscription.subscription_plan)
      : null;

    const categories = await CategoryModel.findAll(shopDomain);
    const itemResult = await ItemModel.findAll(shopDomain, { limit: 1 });

    const stats = {
      totalCategories: categories.length,
      totalItems: itemResult.total || 0,
      activeCategories: categories.filter(c => c.is_active).length
    };

    res.render('dashboard', {
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
    res.status(500).send('Error: ' + error.message);
  }
});

app.get('/app', ensureInstalled, (req, res) => {
  res.redirect(`/?shop=${req.query.shop}&host=${req.query.host || ''}`);
});

// Categories
app.get('/app/categories', ensureInstalled, async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const categories = await CategoryModel.findAll(session.shop);

    res.render('categories', {
      categories,
      host: req.query.host || '',
      apiKey: process.env.SHOPIFY_API_KEY
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error: ' + error.message);
  }
});

app.get('/app/categories/new', ensureInstalled, (req, res) => {
  res.render('category-form', {
    category: null,
    isEdit: false,
    host: req.query.host || '',
    apiKey: process.env.SHOPIFY_API_KEY
  });
});

app.post('/app/categories', ensureInstalled, async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const { name, description, displayOrder } = req.body;

    const category = await CategoryModel.create(session.shop, {
      name,
      description,
      displayOrder: displayOrder ? parseInt(displayOrder) : 0
    });

    res.json({ success: true, category });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/app/categories/:categoryId/items', ensureInstalled, async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const { categoryId } = req.params;
    const category = await CategoryModel.findById(categoryId, session.shop);

    if (!category) {
      return res.status(404).send('Category not found');
    }

    const result = await ItemModel.findAll(session.shop, { categoryId });

    res.render('items', {
      category,
      items: result.items || [],
      host: req.query.host || '',
      apiKey: process.env.SHOPIFY_API_KEY
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error: ' + error.message);
  }
});

// Billing
app.get('/app/billing', ensureInstalled, async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const subscription = await ShopModel.getSubscription(session.shop);
    const plans = BillingService.getAvailablePlans();

    res.render('billing', {
      subscription,
      plans,
      hasActiveSubscription: subscription?.subscription_status === 'active',
      host: req.query.host || '',
      apiKey: process.env.SHOPIFY_API_KEY
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error: ' + error.message);
  }
});

app.post('/api/billing/select-plan', ensureInstalled, async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const { plan } = req.body;
    const billingService = new BillingService(session);

    const result = await billingService.createCharge(plan);

    res.json({
      success: true,
      confirmationUrl: result.confirmationUrl
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/billing/cancel', ensureInstalled, async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const billingService = new BillingService(session);
    await billingService.cancelSubscription();

    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/billing/callback', ensureInstalled, (req, res) => {
  res.redirect(`/app/billing?shop=${req.query.shop}&host=${req.query.host || ''}`);
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).send('Error: ' + err.message);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`App URL: ${process.env.SHOPIFY_APP_URL || `http://localhost:${PORT}`}`);
});
