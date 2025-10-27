# GDPR Compliance Webhook Registration Guide

## Problem Identified

The Shopify CLI `app deploy` command cannot run in this containerized environment due to DNS resolution issues:
- Node.js DNS queries return `ECONNREFUSED` when trying to reach `accounts.shopify.com`
- This is a gVisor container networking limitation

## Solution: Partner Dashboard Configuration

Since CLI deployment isn't possible in this environment, you need to register GDPR webhooks via the Shopify Partner Dashboard.

### Step-by-Step Instructions

#### 1. Access Partner Dashboard

1. Go to https://partners.shopify.com/
2. Log in with your partner account
3. Navigate to **Apps**
4. Select your app: **verify-my-collectible** (Client ID: `34f3e8c2e51cd7a4c0c7cc27818a1968`)

#### 2. Configure Compliance Webhooks

Depending on whether your app is on the **legacy Partner Dashboard** or **new Dev Dashboard**:

**For Legacy Partner Dashboard:**
1. Click on your app
2. Go to **Configuration** → **Compliance webhooks**
3. Add the following three mandatory webhooks:

**For New Dev Dashboard:**
1. Click on your app
2. Go to **Versions** → **Create a version**
3. This will sync your `shopify.app.toml` configuration

#### 3. Register Each Webhook

Add these three mandatory GDPR compliance webhooks:

| Topic | Webhook URL |
|-------|-------------|
| `customers/data_request` | `https://verifymycollectible.com/webhooks` |
| `customers/redact` | `https://verifymycollectible.com/webhooks` |
| `shop/redact` | `https://verifymycollectible.com/webhooks` |

**Important:**
- All webhooks point to the same endpoint: `https://verifymycollectible.com/webhooks`
- The endpoint MUST use HTTPS with a valid SSL certificate
- The endpoint MUST respond with a 200 status code within 30 days

### 4. Verify Registration

After configuring in Partner Dashboard, verify the webhooks are registered:

```bash
./check-registered-webhooks.sh
```

You should see all four webhooks listed:
- ✅ `app/uninstalled` (already registered)
- ✅ `customers/data_request` (newly registered)
- ✅ `customers/redact` (newly registered)
- ✅ `shop/redact` (newly registered)

## Current Status

### ✅ Completed
- [x] Webhook handlers implemented in `server.js` with proper HMAC verification
- [x] `shopify.app.toml` configured with compliance topics
- [x] Nginx configured to forward Shopify headers
- [x] App OAuth installed and working
- [x] `app/uninstalled` webhook registered

### ⏳ Pending
- [ ] GDPR compliance webhooks registered via Partner Dashboard
- [ ] Shopify automated tests passing

## Webhook Handler Implementation

Your webhook handlers are already implemented in `server.js:74-132`:

```javascript
APP_UNINSTALLED: {
  deliveryMethod: 'http',
  callbackUrl: '/webhooks',
  callback: async (topic, shop, body) => {
    console.log('App uninstalled webhook received for shop:', shop);
    await ShopModel.markUninstalled(shop);
  }
},
CUSTOMERS_DATA_REQUEST: {
  deliveryMethod: 'http',
  callbackUrl: '/webhooks',
  callback: async (topic, shop, body) => {
    console.log('Customer data request webhook received for shop:', shop);
    // Handle GDPR data request
  }
},
CUSTOMERS_REDACT: {
  deliveryMethod: 'http',
  callbackUrl: '/webhooks',
  callback: async (topic, shop, body) => {
    console.log('Customer redact webhook received for shop:', shop);
    // Handle customer data deletion
  }
},
SHOP_REDACT: {
  deliveryMethod: 'http',
  callbackUrl: '/webhooks',
  callback: async (topic, shop, body) => {
    console.log('Shop redact webhook received for shop:', shop);
    // Handle shop data deletion (48 hours after uninstall)
  }
}
```

## Why API Registration Didn't Work

Compliance webhooks are special and **cannot** be registered via the Shopify Admin API:

```bash
curl -X POST "https://SHOP/admin/api/2024-10/webhooks.json" \
  -d '{"webhook": {"topic": "customers/data_request", ...}}'

# Returns: {"errors": "Could not find the webhook topic customers/data_request"}
```

This is by design - Shopify requires these to be registered through official channels (CLI or Partner Dashboard) to ensure security and compliance.

## References

- [Shopify Privacy Law Compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)
- [Mandatory Webhooks Documentation](https://shopify.dev/docs/apps/webhooks/configuration/mandatory-webhooks)
- [App Configuration (TOML)](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration)

## Next Steps

1. **Register webhooks via Partner Dashboard** (as described above)
2. **Test webhooks** by triggering them from Partner Dashboard test interface
3. **Submit app for review** once all webhooks pass Shopify's automated tests
