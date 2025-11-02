# Retailer Portal Setup Guide

## Overview

The Retailer Portal allows your wholesale customers (comic shops and online retailers) to:
- Log in to their own dedicated portal
- View their wholesale pricing
- Place orders with automatic wholesale discounts
- Manage their account and view order history
- See their payment terms and credit availability (if using Net Terms)

## Architecture

### Two-Portal System

1. **Admin Portal** (`/app/wholesale`)
   - For store owners/managers
   - Manage retailers, pricing rules, approvals
   - View analytics and reports
   - Configure net terms and credit limits

2. **Retailer Portal** (`/retailer`)
   - For wholesale customers (retailers)
   - Place orders with wholesale pricing
   - View account information
   - Check available credit
   - Browse catalog with their pricing

## Setup Instructions

### 1. Database Setup

Run the extension schema to add retailer portal tables:

```bash
# Connect to your PostgreSQL database
psql -h your-db-host -U your-db-user -d your-db-name

# Run the extension schema
\i database/wholesale-extensions-schema.sql
```

This creates:
- `retailer_login_tokens` - For magic link authentication
- Additional helper functions for retailer authentication

### 2. Environment Variables

Add to your `.env` file:

```env
# Session secret for retailer authentication (generate a secure random string)
SESSION_SECRET=your-secure-secret-key-here
```

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Retailer Login Flow

#### How Retailers Log In

1. **Retailer visits**: `https://your-app-url/retailer/login`
2. **Enters**: Email address + Store domain
3. **Receives**: Magic link via email (or shown in dev mode)
4. **Clicks link**: Automatically logged into their portal
5. **Access portal**: Can now place orders, view account

#### Setting Up Email Delivery (Production)

In production, you'll want to send login links via email. Update `/app/routes/retailer.login.jsx`:

```javascript
// Replace the development mode response with:
import { sendEmail } from "../services/email.server"; // Your email service

const loginLink = `https://${shop}/apps/retailer/login?token=${token}&shop=${shop}`;

await sendEmail({
  to: customer.email,
  subject: 'Your Wholesale Portal Login Link',
  html: `
    <p>Click the link below to access your wholesale portal:</p>
    <p><a href="${loginLink}">Login to Wholesale Portal</a></p>
    <p>This link expires in 24 hours.</p>
  `
});

return json({
  success: true,
  message: 'Login link sent to your email!'
  // Remove loginLink from response in production
});
```

### 4. Storefront Integration

To show wholesale pricing on your Shopify storefront:

#### Step 1: Add JavaScript to Theme

Add this to your theme's `theme.liquid` (before `</body>`):

```liquid
{% if customer %}
<script>
  // Check if customer is a wholesale retailer
  fetch('/api/retailer/check-session?shop={{ shop.domain }}&customerId={{ customer.id }}')
    .then(res => res.json())
    .then(data => {
      if (data.isWholesale && data.approved) {
        // Customer is an approved wholesale retailer
        window.wholesaleCustomer = {
          tags: data.customerTags,
          hasNetTerms: data.hasNetTerms,
          creditAvailable: data.creditAvailable,
          portalUrl: data.portalUrl
        };

        // Show wholesale pricing on product pages
        updatePricingDisplay();
      }
    });

  function updatePricingDisplay() {
    // Get all product prices on the page
    const productData = {
      shop: '{{ shop.domain }}',
      productId: '{{ product.id }}', // If on product page
      variantId: getCurrentVariantId(),
      price: getCurrentPrice(),
      customerId: '{{ customer.id }}',
      tags: window.wholesaleCustomer.tags.join(',')
    };

    // Fetch wholesale price
    const params = new URLSearchParams(productData);
    fetch(`/api/wholesale/price?${params}`)
      .then(res => res.json())
      .then(pricing => {
        if (pricing.success && pricing.pricing.hasDiscount) {
          displayWholesalePrice(pricing.pricing);
        }
      });
  }

  function displayWholesalePrice(pricing) {
    // Replace or modify price display
    const priceElement = document.querySelector('.product-price');
    if (priceElement) {
      priceElement.innerHTML = `
        <span class="wholesale-price">$${pricing.finalPrice.toFixed(2)}</span>
        <span class="retail-price" style="text-decoration: line-through;">
          $${pricing.originalPrice.toFixed(2)}
        </span>
        <span class="savings">Save ${pricing.discountPercentage}%</span>
      `;
    }
  }
</script>
{% endif %}
```

#### Step 2: Add Retailer Portal Link

Add a link to the retailer portal in your theme (e.g., in `header.liquid`):

```liquid
{% if customer %}
  <div id="retailer-portal-link"></div>
  <script>
    if (window.wholesaleCustomer) {
      document.getElementById('retailer-portal-link').innerHTML =
        '<a href="' + window.wholesaleCustomer.portalUrl + '" class="wholesale-portal-link">' +
        'Wholesale Portal' +
        '</a>';
    }
  </script>
{% endif %}
```

#### Step 3: Cart Validation

Add cart validation to prevent orders below minimum requirements:

```liquid
<script>
  function validateWholesaleCart() {
    if (!window.wholesaleCustomer) return;

    fetch('/api/wholesale/cart-validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop: '{{ shop.domain }}',
        customerId: '{{ customer.id }}',
        customerTags: window.wholesaleCustomer.tags,
        cartTotal: {{ cart.total_price | money_without_currency }},
        cartItems: {{ cart.item_count }},
        cartWeight: {{ cart.total_weight }},
        isFirstOrder: {{ customer.orders_count == 0 }}
      })
    })
    .then(res => res.json())
    .then(validation => {
      if (!validation.validation.canProceed) {
        alert(validation.validation.messages.join('\n'));
        return false;
      }
      return true;
    });
  }

  // Hook into checkout button
  document.querySelector('[name="checkout"]').addEventListener('click', (e) => {
    if (!validateWholesaleCart()) {
      e.preventDefault();
    }
  });
</script>
```

## Managing Retailers

### Adding a New Retailer

1. Go to **Admin Portal** → Wholesale → Customers
2. Click **Add Customer**
3. Enter:
   - Email address
   - Shopify Customer ID (from Shopify admin)
   - Customer tags (e.g., "wholesale", "tier1")
   - Check "Approve for wholesale access"
4. Click **Save**

### Setting Up Net Terms (Pay Later)

1. Go to **Wholesale** → **Net Terms**
2. Click **Add Net Terms**
3. Select the customer
4. Enter:
   - Credit Limit (e.g., $5000)
   - Payment Terms (e.g., Net 30 = 30 days)
5. Click **Save**

Now the retailer can place orders on credit up to their limit.

### Approval Workflow

1. Go to **Wholesale** → **Approvals**
2. Review pending requests
3. Click **Approve** or **Reject**
4. Add notes explaining your decision
5. Approved retailers get immediate access

## API Endpoints

### For Storefront Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/retailer/check-session` | GET | Check if customer is wholesale retailer |
| `/api/wholesale/price` | GET | Get wholesale price for product |
| `/api/wholesale/cart-validate` | POST | Validate cart against order limits |
| `/api/wholesale/cart-pricing` | POST | Calculate pricing for entire cart |

### Example API Usage

#### Check Retailer Status
```javascript
GET /api/retailer/check-session?shop=store.myshopify.com&customerId=123

Response:
{
  "success": true,
  "isWholesale": true,
  "approved": true,
  "customerTags": ["wholesale", "tier1"],
  "hasNetTerms": true,
  "creditAvailable": 4500.00,
  "portalUrl": "/retailer?shop=store.myshopify.com"
}
```

#### Get Product Wholesale Price
```javascript
GET /api/wholesale/price?shop=store.myshopify.com&productId=123&variantId=456&price=100&customerId=789&tags=wholesale,tier1&quantity=10

Response:
{
  "success": true,
  "pricing": {
    "originalPrice": 100.00,
    "finalPrice": 75.00,
    "discount": 25.00,
    "discountPercentage": 25,
    "hasDiscount": true,
    "rulesApplied": [
      {
        "id": "uuid",
        "name": "Tier 1 Wholesale",
        "type": "global",
        "discount": "25%"
      }
    ]
  }
}
```

## Security Considerations

### Authentication
- Retailer portal uses magic links (passwordless)
- Session cookies are HTTP-only and secure
- Tokens expire after 24 hours
- One-time use tokens

### Authorization
- All retailer routes check authentication
- Database queries filter by shop domain
- Retailers can only see their own data
- Admin routes require Shopify admin authentication

### Data Protection
- Customer tags determine pricing access
- Product visibility rules control catalog
- Net terms enforce credit limits
- CORS enabled for storefront APIs

## Customization

### Branding the Retailer Portal

Edit the retailer portal routes to add your branding:

1. Update `/app/routes/retailer.login.jsx` - Add logo, colors
2. Update `/app/routes/retailer._index.jsx` - Customize dashboard
3. Add CSS in your app's styles

### Email Templates

Create branded email templates for:
- Login links
- Order confirmations
- Payment reminders
- Credit limit warnings

### Custom Workflows

You can add:
- Automatic approval for certain email domains
- Minimum order requirements by customer tag
- Special pricing for VIP retailers
- Bulk order discounts

## Troubleshooting

### Retailers Can't Log In

1. Check database connection
2. Verify `retailer_login_tokens` table exists
3. Check SESSION_SECRET is set
4. Verify customer is approved in wholesale_customers

### Pricing Not Showing

1. Check pricing rules are published
2. Verify customer has correct tags
3. Check rule customer_selection_type
4. Test with `/api/wholesale/price` directly

### Orders Not Creating

1. Verify Shopify Admin API access
2. Check customer has wholesale_approved = true
3. Verify product/variant IDs are correct
4. Check net terms credit availability

## Production Checklist

- [ ] Database schema deployed (wholesale-schema.sql + extensions)
- [ ] SESSION_SECRET environment variable set
- [ ] Email service configured for login links
- [ ] Storefront JavaScript integration added
- [ ] Retailer portal tested with real customer account
- [ ] Pricing rules configured and published
- [ ] Net terms set up for credit customers
- [ ] Approval workflow tested
- [ ] CORS configured for your domain
- [ ] SSL certificate installed
- [ ] Backup strategy in place

## Support

For issues or questions:
1. Check logs in your hosting platform
2. Review database for data integrity
3. Test API endpoints directly
4. Contact support with error messages

## Next Steps

1. **Test the flow**: Create a test wholesale customer and walk through the entire process
2. **Configure pricing**: Set up your pricing rules for different retailer tiers
3. **Customize branding**: Update the retailer portal to match your brand
4. **Set up email**: Configure email delivery for login links
5. **Train your team**: Show your team how to manage retailers and approvals
6. **Go live**: Switch from test mode to live mode in settings

---

**Need help?** Refer to WHOLESALE_SETUP.md for admin portal documentation.
