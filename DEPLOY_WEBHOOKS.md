# Deploy GDPR Webhooks via Shopify CLI

## Quick Start - Run This On Your Laptop

### Step 1: Install Shopify CLI

**Option A: Using npm (Recommended)**
```bash
npm install -g @shopify/cli @shopify/app
```

**Option B: Using Homebrew (Mac)**
```bash
brew tap shopify/shopify
brew install shopify-cli
```

**Option C: Using Ruby gem**
```bash
gem install shopify-cli
```

### Step 2: Navigate to Your Project

```bash
cd /path/to/auth-app-shopify
```

### Step 3: Pull Latest Changes (if not already done)

```bash
git checkout claude/resolve-react-errors-011CUV9T3ER6nCA2JbCaRoCP
git pull origin claude/resolve-react-errors-011CUV9T3ER6nCA2JbCaRoCP
```

### Step 4: Login to Shopify

```bash
shopify auth login
```

This will open a browser window to authenticate with your Shopify Partner account.

### Step 5: Deploy the Configuration

```bash
shopify app deploy
```

This command will:
- Read your `shopify.app.toml` file
- Register all webhooks including the GDPR compliance webhooks
- Deploy your app configuration to Shopify

**That's it!** The three GDPR webhooks will be automatically registered:
- ✅ `customers/data_request`
- ✅ `customers/redact`
- ✅ `shop/redact`

### Step 6: Verify Webhooks Are Registered

After deployment, you can verify on your production server:

```bash
# SSH into your server
ssh user@verifymycollectible.com

# Check registered webhooks
cd /home/user/auth-app-shopify
./check-registered-webhooks.sh
```

You should see all 4 webhooks listed:
- `app/uninstalled`
- `customers/data_request`
- `customers/redact`
- `shop/redact`

## Troubleshooting

### "shopify: command not found"

If you installed via npm, you may need to add npm global bin to your PATH:

```bash
# Add to ~/.bashrc or ~/.zshrc
export PATH="$PATH:$(npm config get prefix)/bin"

# Then reload
source ~/.bashrc  # or source ~/.zshrc
```

### "Cannot find app configuration"

Make sure you're in the project root directory where `shopify.app.toml` exists:

```bash
ls shopify.app.toml  # Should show the file
```

### Deploy asks for app selection

If you have multiple apps, the CLI will ask which app to deploy to. Select **verify-my-collectible** (Client ID: `34f3e8c2e51cd7a4c0c7cc27818a1968`).

### Authentication fails

Make sure you're using the same Shopify Partner account that owns the app. You can check your apps at https://partners.shopify.com/

## Alternative: Partner Dashboard Method

If CLI deployment still doesn't work on your laptop, you can manually register via Partner Dashboard (see `WEBHOOK_REGISTRATION_GUIDE.md`).

## What Gets Deployed

The `shopify app deploy` command reads `shopify.app.toml` and registers:

```toml
[webhooks]
api_version = "2024-10"

[[webhooks.subscriptions]]
topics = ["app/uninstalled"]
uri = "/webhooks"

[[webhooks.subscriptions]]
compliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]
uri = "/webhooks"
```

All webhooks point to: `https://verifymycollectible.com/webhooks`

Your webhook handlers are already implemented in `server.js` with proper HMAC verification, so once deployed, everything will work automatically.
