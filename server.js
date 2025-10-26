import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import shopify from './app/config/shopify.js';
import { ShopModel } from './app/models/shop.server.js';
import { CategoryModel } from './app/models/category.server.js';
import { ItemModel } from './app/models/item.server.js';
import { BillingService } from './app/services/billing.server.js';
import { FileUploadService } from './app/services/file-upload.server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for file uploads
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  storage: multer.memoryStorage()
});

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

// Custom middleware for embedded apps - just verify shop query param
const ensureInstalled = async (req, res, next) => {
  try {
    const shopDomain = req.query.shop;

    if (!shopDomain) {
      console.log('Missing shop parameter');
      return res.status(400).send('Missing shop parameter. Please access this app from your Shopify admin.');
    }

    // For embedded apps, the shop and host params are enough
    // Shopify admin handles the authentication
    console.log(`Request for ${req.path} from shop: ${shopDomain}`);
    next();
  } catch (error) {
    console.error('Middleware error:', error);
    return res.status(500).send('Server error: ' + error.message);
  }
};

// Public homepage
app.get('/', async (req, res) => {
  try {
    // If no shop parameter, show public homepage
    if (!req.query.shop) {
      return res.render('homepage');
    }

    // Otherwise, show embedded app dashboard
    const shopDomain = req.query.shop;

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
    const shopDomain = req.query.shop;
    if (!shopDomain) {
      return res.status(400).send('Missing shop parameter');
    }

    const categories = await CategoryModel.findAll(shopDomain);

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
    const shopDomain = req.query.shop;
    if (!shopDomain) {
      return res.status(400).json({ success: false, error: 'Missing shop parameter' });
    }

    const { name, description, displayOrder } = req.body;

    const category = await CategoryModel.create(shopDomain, {
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
    const shopDomain = req.query.shop;
    if (!shopDomain) {
      return res.status(400).send('Missing shop parameter');
    }

    const { categoryId } = req.params;
    const category = await CategoryModel.findById(categoryId, shopDomain);

    if (!category) {
      return res.status(404).send('Category not found');
    }

    const result = await ItemModel.findAll(shopDomain, { categoryId });

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

app.get('/app/categories/:categoryId/items/new', ensureInstalled, async (req, res) => {
  try {
    const shopDomain = req.query.shop;
    if (!shopDomain) {
      return res.status(400).send('Missing shop parameter');
    }

    const { categoryId } = req.params;
    const category = await CategoryModel.findById(categoryId, shopDomain);

    if (!category) {
      return res.status(404).send('Category not found');
    }

    res.render('item-form', {
      category,
      item: null,
      isEdit: false,
      host: req.query.host || '',
      apiKey: process.env.SHOPIFY_API_KEY
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error: ' + error.message);
  }
});

app.post('/app/categories/:categoryId/items', ensureInstalled, upload.single('image'), async (req, res) => {
  try {
    const shopDomain = req.query.shop;
    if (!shopDomain) {
      return res.status(400).json({ success: false, error: 'Missing shop parameter' });
    }

    const { categoryId } = req.params;
    const { name, serialNumber, description, isActive } = req.body;

    // Handle image upload to Shopify Files
    let imageUrl = null;
    let shopifyFileId = null;

    if (req.file) {
      try {
        console.log('Uploading file to Shopify:', req.file.originalname);

        // Load session from storage
        const sessionId = shopify.api.session.getOfflineId(shopDomain);
        const session = await shopify.config.sessionStorage.loadSession(sessionId);

        if (!session) {
          return res.status(401).json({ success: false, error: 'No session found. Please reinstall the app.' });
        }

        // Upload file to Shopify
        const fileUploadService = new FileUploadService(session);
        const uploadResult = await fileUploadService.uploadFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );

        imageUrl = uploadResult.url;
        shopifyFileId = uploadResult.id;

        console.log('File uploaded successfully:', { imageUrl, shopifyFileId });
      } catch (uploadError) {
        console.error('Error uploading file to Shopify:', uploadError);
        // Continue creating the item even if file upload fails
        // We'll just not have an image
      }
    }

    // Create the item with all data
    const item = await ItemModel.create(shopDomain, {
      categoryId,
      name,
      serialNumber,
      description,
      imageUrl,
      shopifyFileId,
      isActive: isActive === 'on' || isActive === 'true'
    });

    res.json({ success: true, item });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Billing
app.get('/app/billing', ensureInstalled, async (req, res) => {
  try {
    const shopDomain = req.query.shop;
    if (!shopDomain) {
      return res.status(400).send('Missing shop parameter');
    }

    const subscription = await ShopModel.getSubscription(shopDomain);
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
    const shopDomain = req.query.shop;
    if (!shopDomain) {
      return res.status(400).json({ success: false, error: 'Missing shop parameter' });
    }

    // Load session from storage
    const sessionId = shopify.api.session.getOfflineId(shopDomain);
    const session = await shopify.config.sessionStorage.loadSession(sessionId);

    if (!session) {
      return res.status(401).json({ success: false, error: 'No session found' });
    }

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
    const shopDomain = req.query.shop;
    if (!shopDomain) {
      return res.status(400).json({ success: false, error: 'Missing shop parameter' });
    }

    // Load session from storage
    const sessionId = shopify.api.session.getOfflineId(shopDomain);
    const session = await shopify.config.sessionStorage.loadSession(sessionId);

    if (!session) {
      return res.status(401).json({ success: false, error: 'No session found' });
    }

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
