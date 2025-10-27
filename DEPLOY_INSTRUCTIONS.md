# Deploy Webhook Fix to Production

## Issue Diagnosis

Your production server has:
1. **Syntax error on line 174** - Old broken code
2. **"No body was received"** - Webhook handler can't read request body

The fix has been committed to branch `claude/resolve-react-errors-011CUV9T3ER6nCA2JbCaRoCP` but NOT deployed to production yet.

## Manual Deployment Steps

SSH to your production server and run these commands:

```bash
# 1. Navigate to app directory
cd /home/ec2-user/verify-my-collectible

# 2. Check current status
git status
git branch

# 3. Fetch latest changes
git fetch origin

# 4. Checkout the fix branch
git checkout claude/resolve-react-errors-011CUV9T3ER6nCA2JbCaRoCP

# 5. Pull the latest code
git pull origin claude/resolve-react-errors-011CUV9T3ER6nCA2JbCaRoCP

# 6. Verify syntax is correct
node --check server.js

# 7. Restart the app
pm2 restart verify-my-collectible

# 8. Check if it's running without errors
pm2 status
pm2 logs verify-my-collectible --lines 30
```

## What the Fix Does

The updated `server.js` includes:

1. **Fixed webhook body parsing** (line 72):
   ```javascript
   app.post(
     shopify.config.webhooks.path,
     express.text({ type: '*/*' }),  // Parses body as STRING for HMAC
     shopify.processWebhooks({ webhookHandlers: {
   ```

2. **Proper webhook handlers** with try-catch error handling
3. **No syntax errors** - validated with `node --check`

## After Deployment - Test Webhooks

Once deployed successfully:

1. Go to Shopify Partner Dashboard: https://partners.shopify.com
2. Select "Verify My Collectible" app
3. Click **Configuration** → **Webhooks**
4. Scroll to **GDPR mandatory webhooks**
5. Click **Send test webhook** for each:
   - customers/data_request
   - customers/redact
   - shop/redact

All should return **200 OK** status.

## Check Webhook Logs

After testing, verify webhooks are received:

```bash
pm2 logs verify-my-collectible | grep -A 2 "webhook received"
```

You should see:
```
CUSTOMERS_DATA_REQUEST webhook received for shop: yourstore.myshopify.com
GDPR Compliance: This app does not store customer-identifiable data.
```

## Troubleshooting

If you still get errors:

```bash
# Check error logs
pm2 logs verify-my-collectible --err --lines 50

# Check nginx is proxying correctly
sudo tail -f /var/log/nginx/access.log | grep webhooks

# Restart nginx if needed
sudo systemctl restart nginx
```
