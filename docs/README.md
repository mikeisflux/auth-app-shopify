# Collectible Tracker - Shopify App

A complete Shopify application for tracking collectible items with serial numbers, image verification, and customer authentication.

## Features

- ✅ **Category Management** - Organize collectibles into categories
- ✅ **Item Tracking** - Track items with unique serial numbers
- ✅ **Image Storage** - Store images directly in Shopify Files
- ✅ **Customer Verification** - Public storefront widget for serial number lookup
- ✅ **Analytics** - Track verification counts and activity
- ✅ **Subscription Billing** - Three-tier pricing model
- ✅ **GDPR Compliant** - Full privacy and data protection compliance
- ✅ **Search & Filter** - Advanced search, sort, and filter capabilities

## Pricing Plans

- **Basic:** $9.99/month - Up to 2 categories
- **Pro:** $29.99/month - 3-5 categories  
- **Premium:** $49.99/month - 6+ categories (unlimited)

## Tech Stack

- **Frontend:** React, Remix, Shopify Polaris Web Components
- **Backend:** Node.js, Express
- **Database:** AWS RDS PostgreSQL
- **File Storage:** Shopify Files API
- **Authentication:** Shopify OAuth
- **Billing:** Shopify Recurring Application Charges

## Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- npm or yarn package manager
- Shopify Partner account
- Shopify development store
- AWS account (for RDS PostgreSQL)
- ngrok or similar tunneling service (for local development)

## Setup Instructions

### 1. Clone and Install

```bash
# Clone the repository
git clone [your-repo-url]
cd collectible-tracker

# Install dependencies
npm install
```

### 2. AWS RDS Setup

1. **Create PostgreSQL Database:**
   - Go to AWS RDS Console
   - Create a new PostgreSQL database (version 14+)
   - Choose appropriate instance size (db.t3.micro for dev)
   - Enable public accessibility for development
   - Configure security group to allow connections from your IP

2. **Run Database Migration:**
   ```bash
   # Set your AWS credentials in .env first
   npm run db:migrate
   ```

   Or manually run the schema:
   ```bash
   psql -h your-rds-endpoint.rds.amazonaws.com -U your-username -d collectibles_db -f database/schema.sql
   ```

### 3. Shopify Partner Setup

1. **Create a new app in Shopify Partners:**
   - Go to https://partners.shopify.com/
   - Navigate to Apps
   - Click "Create app"
   - Choose "Public app"
   - Fill in app details

2. **Configure App Settings:**
   - App URL: `https://your-ngrok-url.ngrok.io`
   - Allowed redirection URLs:
     ```
     https://your-ngrok-url.ngrok.io/auth/callback
     https://your-ngrok-url.ngrok.io/auth/shopify/callback
     https://your-ngrok-url.ngrok.io/api/auth/callback
     ```

3. **Note your credentials:**
   - Client ID
   - Client Secret

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.template .env
```

Edit `.env` with your values:

```env
# Shopify API Credentials
SHOPIFY_API_KEY=your_client_id_here
SHOPIFY_API_SECRET=your_client_secret_here
SCOPES=write_products,read_products,write_files,read_files

# Database (AWS RDS)
AWS_DB_HOST=your-rds-endpoint.rds.amazonaws.com
AWS_DB_PORT=5432
AWS_DB_NAME=collectibles_db
AWS_DB_USER=your_db_username
AWS_DB_PASSWORD=your_db_password

# AWS Credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# App Configuration
HOST=https://your-ngrok-url.ngrok.io
SHOPIFY_APP_URL=https://your-ngrok-url.ngrok.io

# Session Secret (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
SESSION_SECRET=your_random_secret_here
```

### 5. Configure App Proxy

In your Shopify Partner Dashboard:

1. Go to your app → Configuration → App proxy
2. Set up the proxy:
   - **Subpath prefix:** `apps`
   - **Subpath:** `collectibles`
   - **Proxy URL:** `https://your-ngrok-url.ngrok.io`

This allows storefront access at: `your-store.myshopify.com/apps/collectibles/verify`

### 6. Start Development Server

```bash
# Start ngrok (in a separate terminal)
ngrok http 3000

# Start the app
npm run dev
```

The app will:
- Start the Remix development server
- Open your browser to the app installation page
- Create a tunnel for Shopify to reach your local server

### 7. Install on Development Store

1. Click the installation link provided by Shopify CLI
2. Choose your development store
3. Accept the permissions
4. Complete the installation

### 8. Add Storefront Widget

After installation, merchants can add the verification widget:

1. Go to your Shopify store admin
2. Navigate to: **Online Store → Themes → Customize**
3. Add a new section to any page
4. Search for "Collectibles Lookup"
5. Configure the widget settings
6. Save and publish

## Project Structure

```
collectible-tracker/
├── app/
│   ├── routes/                 # Remix routes
│   │   ├── app._index.jsx     # Dashboard
│   │   ├── app.categories.*.jsx # Category management
│   │   ├── app.billing.jsx    # Subscription billing
│   │   └── webhooks.jsx       # GDPR webhooks
│   ├── models/                # Database models
│   │   ├── shop.server.js
│   │   ├── category.server.js
│   │   └── item.server.js
│   ├── services/              # Business logic
│   │   ├── billing.server.js
│   │   └── shopify-files.server.js
│   └── db/                    # Database connection
│       └── connection.server.js
├── extensions/
│   └── collectibles-lookup/   # Theme app extension
│       ├── blocks/
│       │   └── lookup.liquid
│       └── shopify.extension.toml
├── database/
│   └── schema.sql             # PostgreSQL schema
├── docs/
│   ├── PRIVACY_POLICY.md
│   └── TERMS_OF_SERVICE.md
├── shopify.app.toml           # App configuration
├── package.json
└── README.md
```

## Key Features Implementation

### Admin Dashboard
- Built with Shopify Polaris components
- Real-time search and filtering
- Sortable data tables
- Pagination for large datasets
- Responsive design

### Billing System
- Shopify Recurring Application Charges
- Three-tier pricing model
- Automatic subscription management
- Category limit enforcement

### Image Upload
- Direct upload to Shopify Files API
- Images stored in merchant's store
- Automatic CDN distribution
- 10MB file size limit

### Customer Verification
- Public-facing storefront widget
- Real-time serial number lookup
- Verification logging with analytics
- IP tracking for fraud prevention

### GDPR Compliance
- Mandatory webhook handlers implemented
- Data export capabilities
- Automatic data deletion
- Privacy policy and terms of service

## API Routes

### Admin Routes
- `GET /app` - Dashboard
- `GET /app/categories` - List categories
- `POST /app/categories` - Create category
- `GET /app/categories/:id/items` - List items
- `POST /app/categories/:id/items` - Create item
- `GET /app/billing` - Subscription management

### Public Routes (App Proxy)
- `POST /apps/collectibles/verify` - Verify serial number

### Webhook Routes
- `POST /webhooks` - Handle all webhooks
  - `app/uninstalled`
  - `customers/data_request`
  - `customers/redact`
  - `shop/redact`

## Database Schema

### Tables
- `shops` - Merchant stores and subscriptions
- `categories` - Collectible categories
- `items` - Individual collectible items
- `verification_logs` - Customer verification history

### Views
- `category_counts` - Category counts per shop
- `category_item_counts` - Item counts per category

### Functions
- `check_category_limit()` - Validate subscription limits
- `update_updated_at_column()` - Automatic timestamp updates

## Testing

### Test Subscription Flow
```bash
# Create test shop
# Install app
# Navigate to Billing
# Select a plan
# Complete Shopify's billing flow
# Verify subscription status
```

### Test Verification
```bash
# Create a category and item with serial number
# Add verification widget to storefront
# Visit storefront
# Enter serial number
# Verify item details display
```

### Test GDPR Webhooks
```bash
# Use Shopify CLI to trigger webhooks
shopify app webhook trigger --topic app/uninstalled
shopify app webhook trigger --topic customers/data_request
```

## Deployment

### Production Deployment

1. **Deploy to hosting provider** (Heroku, AWS, etc.)
2. **Update environment variables** with production values
3. **Configure production database**
4. **Update app URLs** in Shopify Partner Dashboard
5. **Submit app for review** in Shopify App Store

### Environment Variables for Production
- Use managed secrets service (AWS Secrets Manager, etc.)
- Enable SSL/TLS
- Configure proper CORS settings
- Set up monitoring and logging

## Security Best Practices

- ✅ All API routes authenticated with Shopify session tokens
- ✅ Input validation on all forms
- ✅ SQL injection protection (parameterized queries)
- ✅ CSRF protection via Shopify App Bridge
- ✅ Rate limiting on verification endpoint
- ✅ Encrypted data storage
- ✅ Regular security updates

## Troubleshooting

### Common Issues

**Database Connection Fails:**
- Check AWS security group allows your IP
- Verify database credentials
- Ensure PostgreSQL is running

**App Installation Fails:**
- Verify ngrok is running
- Check redirect URLs match exactly
- Ensure scopes are correct

**Images Won't Upload:**
- Check Shopify Files API permissions
- Verify file size under 10MB
- Ensure valid image format

**Verification Widget Not Working:**
- Confirm App Proxy is configured
- Check widget is added to storefront
- Verify serial number exists in database

## Support

For issues or questions:
- Email: [your-email@example.com]
- Documentation: [your-docs-url]
- Issues: [GitHub Issues URL]

## License

[Your License Type]

## Contributing

[Your contribution guidelines]

---

Built with ❤️ for the Shopify ecosystem