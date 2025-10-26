import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import shopify from './app/config/shopify.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files
app.use('/public', express.static(join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

// Shopify auth routes
app.get('/auth', async (req, res) => {
  await shopify.auth.begin({
    shop: req.query.shop,
    callbackPath: '/auth/callback',
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });
});

app.get('/auth/callback', async (req, res) => {
  try {
    const callback = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callback;

    // Register webhooks
    await shopify.webhooks.register({ session });

    // Store shop data
    const { ShopModel } = await import('./app/models/shop.server.js');
    await ShopModel.upsert({
      shopDomain: session.shop,
      accessToken: session.accessToken,
      scope: session.scope
    });

    // Redirect to app
    const host = req.query.host;
    res.redirect(`/?shop=${session.shop}&host=${host}`);
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

// Import and use app routes
import appRoutes from './app/routes/index.js';
app.use('/', appRoutes);

// Webhook handling
app.post('/webhooks', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    await shopify.webhooks.process({
      rawBody: req.body,
      rawRequest: req,
      rawResponse: res,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Webhook processing failed');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`App URL: ${process.env.SHOPIFY_APP_URL || `http://localhost:${PORT}`}`);
});
