# Converting to a Public Shopify App - Setup Guide

## ✅ Completed
- [x] Updated API credentials in `.env`
- [x] Set SHOPIFY_API_KEY (configured in .env file)
- [x] Set SHOPIFY_API_SECRET (configured in .env file)

## 🔧 Required Configurations

### 1. Shopify Partner Dashboard
Go to: https://partners.shopify.com/organizations

**App Settings to Configure:**
- **App URL**: `https://verifymycollectible.com/`
- **Allowed redirection URLs**:
  ```
  https://verifymycollectible.com/auth/callback
  https://verifymycollectible.com/api/billing/callback
  https://verifymycollectible.com/exitiframe
  ```
- **App proxy** (if needed): Configure later if you need storefront integration
- **GDPR webhooks**: Configure these URLs:
  - Customer data request: `https://verifymycollectible.com/webhooks/customers/data_request`
  - Customer redact: `https://verifymycollectible.com/webhooks/customers/redact`
  - Shop redact: `https://verifymycollectible.com/webhooks/shop/redact`

### 2. Update .env File
Edit `/home/user/auth-app-shopify/.env` and update:

```bash
# Replace with your actual PostgreSQL connection string
DATABASE_URL=postgresql://username:password@host:5432/database

# Generate a secure random string (use: openssl rand -hex 32)
SESSION_SECRET=your-random-session-secret-here
```

### 3. SSL Certificate
Ensure your domain has a valid SSL certificate:
- Verify at: https://www.ssllabs.com/ssltest/analyze.html?d=verifymycollectible.com
- Shopify requires HTTPS for all app URLs

### 4. Scopes (Permissions)
Current scopes configured: `write_products,read_customers,write_files`

**What each scope does:**
- `write_products` - Create/update products (needed for file uploads)
- `read_customers` - Read customer data (if you need customer verification)
- `write_files` - Upload files to Shopify CDN (for item images)

**Review if you need additional scopes:**
- `read_orders` - If you want to verify purchases
- `write_script_tags` - If you want to add scripts to storefront
- `read_analytics` - If you want to show analytics

### 5. Nginx Configuration
Ensure your nginx is configured to proxy to the Node.js app:

```nginx
server {
    listen 443 ssl http2;
    server_name verifymycollectible.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;

    # Allow large file uploads
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 6. GDPR Compliance Webhooks
Add these webhook handlers to your `server.js`:

```javascript
// GDPR Webhooks (required for public apps)
app.post('/webhooks/customers/data_request', async (req, res) => {
  // Handle customer data request
  // You must provide customer data within 30 days
  console.log('Customer data request:', req.body);
  res.status(200).send('OK');
});

app.post('/webhooks/customers/redact', async (req, res) => {
  // Handle customer data deletion
  // You must delete customer data within 30 days
  console.log('Customer redact:', req.body);
  res.status(200).send('OK');
});

app.post('/webhooks/shop/redact', async (req, res) => {
  // Handle shop data deletion (when app is uninstalled)
  // You must delete shop data within 48 hours
  console.log('Shop redact:', req.body);
  res.status(200).send('OK');
});
```

### 7. App Listing (Optional)
If you want to list your app in the Shopify App Store:
- Add app icon (512x512 PNG)
- Add screenshots
- Write app description
- Set pricing
- Submit for review

### 8. Testing
Before going live, test with a development store:
1. Create a development store in Partner Dashboard
2. Install your app on the dev store
3. Test all functionality:
   - ✅ OAuth flow
   - ✅ Category creation
   - ✅ Item creation with image upload
   - ✅ Billing flow
   - ✅ Navigation

### 9. Deployment Checklist
- [ ] Update `.env` with production DATABASE_URL
- [ ] Generate secure SESSION_SECRET
- [ ] Configure Shopify Partner Dashboard URLs
- [ ] Set up SSL certificate
- [ ] Configure nginx with proper proxy settings
- [ ] Add GDPR webhook handlers
- [ ] Test OAuth flow on development store
- [ ] Test file uploads
- [ ] Test billing flow
- [ ] Monitor PM2 logs for errors: `pm2 logs`

## 🚀 Starting the App

```bash
# Install dependencies
npm install

# Start with PM2
pm2 start server.js --name verify-my-collectible

# Or restart if already running
pm2 restart verify-my-collectible

# Check logs
pm2 logs verify-my-collectible

# Check status
pm2 status
```

## 📊 Monitoring

```bash
# View logs
pm2 logs verify-my-collectible

# View detailed info
pm2 info verify-my-collectible

# Monitor resources
pm2 monit
```

## ⚠️ Important Notes

1. **Public apps cannot access shop data without OAuth** - Users must install your app
2. **GDPR compliance is mandatory** - You must handle data requests/deletions
3. **Shopify reviews public apps** - If listing in App Store, expect review process
4. **Rate limits apply** - Shopify API has rate limits (40 requests/second)
5. **Session storage** - Using PostgreSQL for sessions (already configured)

## 🔐 Security Best Practices

- ✅ Never commit `.env` to git (already in .gitignore)
- ✅ Use strong SESSION_SECRET
- ✅ Keep SHOPIFY_API_SECRET secure
- ✅ Use HTTPS only
- ✅ Validate webhook signatures
- ✅ Sanitize user inputs
- ✅ Use parameterized SQL queries (already using)

## 📞 Support
If you encounter issues:
1. Check PM2 logs: `pm2 logs`
2. Check nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify Shopify Partner Dashboard settings
4. Test with ngrok if testing locally
