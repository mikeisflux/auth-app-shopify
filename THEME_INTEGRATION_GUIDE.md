# Wholesale Theme Integration Guide

This guide explains how to integrate all wholesale features into your Shopify theme's storefront.

## Overview

The wholesale system provides several storefront features:
1. **Wholesale Pricing Display** - Show discounted prices to wholesale customers
2. **Login to View Prices** - Hide prices from non-logged-in users
3. **Volume Pricing Tables** - Display quantity-based discount tiers
4. **Individual Variant Pricing** - Custom pricing for specific SKUs
5. **Sale Clock** - Countdown timer for time-sensitive offers
6. **Retailer Portal Link** - Link to retailer self-service portal
7. **Order Validation** - Enforce minimum order requirements

---

## Quick Setup

### Step 1: Add JavaScript to theme.liquid

Add this script before the closing `</body>` tag in your `theme.liquid` file:

```liquid
<!-- Wholesale Features Integration -->
<script>
window.wholesaleConfig = {
  shop: '{{ shop.domain }}',
  customer: {% if customer %}
    {
      id: '{{ customer.id }}',
      email: '{{ customer.email }}',
      tags: {{ customer.tags | json }},
      isLoggedIn: true
    }
  {% else %}
    { isLoggedIn: false }
  {% endif %}
};

// Load wholesale features
(function() {
  const script = document.createElement('script');
  script.src = '{{ 'wholesale-features.js' | asset_url }}';
  script.async = true;
  document.body.appendChild(script);
})();
</script>
```

### Step 2: Create wholesale-features.js

Create a file `assets/wholesale-features.js` in your theme:

```javascript
// Wholesale Features JavaScript
(function() {
  'use strict';

  const config = window.wholesaleConfig;
  if (!config) {
    console.warn('Wholesale config not found');
    return;
  }

  // Feature 1: Check if prices should be hidden
  function checkHidePrices() {
    fetch(`/api/wholesale/should-hide-prices?shop=${config.shop}&logged_in=${config.customer.isLoggedIn}`)
      .then(res => res.json())
      .then(data => {
        if (data.shouldHide) {
          hidePrices(data.message, data.buttonText);
        }
      })
      .catch(err => console.error('Hide prices check failed:', err));
  }

  function hidePrices(message, buttonText) {
    // Hide all price elements
    document.querySelectorAll('.price, .product-price, [data-price]').forEach(el => {
      el.style.display = 'none';
    });

    // Add login message
    document.querySelectorAll('.product, .product-card').forEach(el => {
      const loginMsg = document.createElement('div');
      loginMsg.className = 'wholesale-login-required';
      loginMsg.innerHTML = `
        <p class="wholesale-message">${message}</p>
        <a href="/account/login" class="button wholesale-login-btn">${buttonText}</a>
      `;
      el.querySelector('.price')?.parentElement.appendChild(loginMsg);
    });
  }

  // Feature 2: Check retailer session and show portal link
  function checkRetailerSession() {
    if (!config.customer.isLoggedIn) return;

    fetch(`/api/retailer/check-session?shop=${config.shop}&customerId=${config.customer.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.isWholesale && data.approved) {
          addRetailerPortalLink(data.portalUrl);
          loadWholesalePricing();
        }
      })
      .catch(err => console.error('Retailer session check failed:', err));
  }

  function addRetailerPortalLink(portalUrl) {
    const nav = document.querySelector('.header__nav, nav');
    if (!nav) return;

    const link = document.createElement('a');
    link.href = portalUrl;
    link.className = 'wholesale-portal-link';
    link.textContent = 'Wholesale Portal';
    link.style.cssText = 'font-weight: bold; color: #008060;';
    nav.appendChild(link);
  }

  // Feature 3: Load wholesale pricing for products
  function loadWholesalePricing() {
    const productCards = document.querySelectorAll('[data-product-id]');

    productCards.forEach(card => {
      const productId = card.dataset.productId;
      const variantId = card.dataset.variantId;
      const retailPrice = parseFloat(card.dataset.price);

      if (!variantId || !retailPrice) return;

      const customerTags = config.customer.tags.join(',');

      // Check individual variant pricing first
      fetch(`/api/wholesale/variant-price?shop=${config.shop}&variantId=${variantId}&retailPrice=${retailPrice}&customerTags=${customerTags}`)
        .then(res => res.json())
        .then(data => {
          if (data.hasDiscount) {
            displayWholesalePrice(card, data);
          } else {
            // Fall back to rule-based pricing
            checkRuleBasedPricing(card, productId, variantId, retailPrice, customerTags);
          }
        })
        .catch(err => console.error('Variant pricing failed:', err));
    });
  }

  function checkRuleBasedPricing(card, productId, variantId, retailPrice, customerTags) {
    const quantity = card.querySelector('[name="quantity"]')?.value || 1;

    fetch(`/api/wholesale/price?shop=${config.shop}&productId=${productId}&variantId=${variantId}&price=${retailPrice}&tags=${customerTags}&quantity=${quantity}`)
      .then(res => res.json())
      .then(data => {
        if (data.pricing && data.pricing.hasDiscount) {
          displayWholesalePrice(card, data.pricing);
        }
      })
      .catch(err => console.error('Rule-based pricing failed:', err));
  }

  function displayWholesalePrice(card, pricing) {
    const priceEl = card.querySelector('.price, .product-price');
    if (!priceEl) return;

    // Create wholesale price display
    const wholesalePrice = document.createElement('div');
    wholesalePrice.className = 'wholesale-price-display';
    wholesalePrice.innerHTML = `
      <span class="wholesale-price" style="color: #008060; font-weight: bold; font-size: 1.2em;">
        $${pricing.finalPrice.toFixed(2)}
      </span>
      <span class="retail-price" style="text-decoration: line-through; color: #999; margin-left: 8px;">
        $${pricing.originalPrice.toFixed(2)}
      </span>
      <span class="savings-badge" style="background: #008060; color: white; padding: 2px 8px; border-radius: 3px; font-size: 0.85em; margin-left: 8px;">
        Save ${pricing.discountPercentage.toFixed(0)}%
      </span>
    `;

    priceEl.innerHTML = '';
    priceEl.appendChild(wholesalePrice);
  }

  // Feature 4: Cart validation
  function validateCart() {
    if (!config.customer.isLoggedIn) return;

    const checkoutBtn = document.querySelector('[name="checkout"]');
    if (!checkoutBtn) return;

    checkoutBtn.addEventListener('click', function(e) {
      e.preventDefault();

      const cartData = getCartData();

      fetch('/api/wholesale/cart-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop: config.shop,
          customerId: config.customer.id,
          customerTags: config.customer.tags,
          ...cartData
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.validation.canProceed) {
          // Allow checkout
          window.location.href = '/checkout';
        } else {
          // Show validation errors
          alert(data.validation.messages.join('\n'));
        }
      })
      .catch(err => {
        console.error('Cart validation failed:', err);
        // Allow checkout on error to avoid blocking
        window.location.href = '/checkout';
      });
    });
  }

  function getCartData() {
    // Extract cart data from Shopify cart object
    // This varies by theme, adjust as needed
    return {
      cartTotal: parseFloat(document.querySelector('[data-cart-total]')?.textContent.replace(/[^0-9.]/g, '') || 0),
      cartItems: parseInt(document.querySelector('[data-cart-count]')?.textContent || 0),
      cartWeight: 0, // Calculate if needed
      isFirstOrder: false // Determine from customer data
    };
  }

  // Feature 5: Sale clock display
  function initSaleClocks() {
    document.querySelectorAll('[data-sale-end-date]').forEach(el => {
      const endDate = new Date(el.dataset.saleEndDate);
      if (isNaN(endDate.getTime())) return;

      updateCountdown(el, endDate);
      setInterval(() => updateCountdown(el, endDate), 1000);
    });
  }

  function updateCountdown(el, endDate) {
    const now = new Date();
    const diff = endDate - now;

    if (diff <= 0) {
      el.textContent = 'Sale ended';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    el.textContent = `Sale ends in ${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`;
  }

  // Initialize features
  document.addEventListener('DOMContentLoaded', function() {
    checkHidePrices();
    checkRetailerSession();
    validateCart();
    initSaleClocks();
  });

})();
```

---

## Feature-Specific Integration

### 1. Login to View Prices

Add to product template (`product.liquid`):

```liquid
{% unless customer %}
  <div class="login-to-view-prices" id="price-hidden-message">
    <p class="message">Login to see wholesale pricing</p>
    <a href="/account/login" class="button">Login to View Prices</a>
  </div>

  <style>
    .product__price { display: none; }
  </style>
{% endunless %}
```

### 2. Wholesale Price Display

Add to product card (`product-card.liquid`):

```liquid
<div class="product-card"
     data-product-id="{{ product.id }}"
     data-variant-id="{{ product.selected_or_first_available_variant.id }}"
     data-price="{{ product.selected_or_first_available_variant.price | divided_by: 100.0 }}">

  <div class="price" data-price-wrapper>
    <span class="price__regular">{{ product.selected_or_first_available_variant.price | money }}</span>
  </div>
</div>
```

### 3. Volume Pricing Table

Create snippet `snippets/wholesale-volume-pricing.liquid`:

```liquid
{% comment %}
  Displays volume pricing tiers
  Usage: {% render 'wholesale-volume-pricing', product: product %}
{% endcomment %}

<div class="volume-pricing-table" data-volume-pricing>
  <h4>Volume Discounts</h4>
  <table>
    <thead>
      <tr>
        <th>Quantity</th>
        <th>Price Per Unit</th>
        <th>You Save</th>
      </tr>
    </thead>
    <tbody id="volume-pricing-body">
      <!-- Populated by JavaScript -->
    </tbody>
  </table>
</div>

<script>
  // Fetch volume pricing for this product
  fetch('/api/wholesale/volume-pricing?productId={{ product.id }}')
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('volume-pricing-body');
      data.tiers.forEach(tier => {
        const row = `
          <tr>
            <td>${tier.quantity}+</td>
            <td>$${tier.price.toFixed(2)}</td>
            <td>${tier.discount}% off</td>
          </tr>
        `;
        tbody.innerHTML += row;
      });
    });
</script>
```

### 4. Sale Clock Widget

Create snippet `snippets/wholesale-sale-clock.liquid`:

```liquid
{% comment %}
  Display countdown timer for sales
  Usage: {% render 'wholesale-sale-clock', end_date: '2024-12-31T23:59:59' %}
{% endcomment %}

{% if end_date %}
  <div class="sale-clock"
       data-sale-end-date="{{ end_date }}"
       style="background: #000000; color: #ffffff; padding: 12px; text-align: left; border-radius: 4px; font-size: 14px;">
    Loading...
  </div>
{% endif %}
```

### 5. Retailer Portal Link

Add to header (`header.liquid`):

```liquid
{% if customer %}
  <div id="retailer-portal-link"></div>
{% endif %}
```

### 6. Order Minimum Warning

Add to cart page (`cart.liquid`):

```liquid
{% if customer %}
  <div id="wholesale-order-minimum" class="cart-message"></div>
{% endif %}

<script>
  // Check order minimums on page load and cart update
  function checkOrderMinimum() {
    if (!window.wholesaleConfig?.customer.isLoggedIn) return;

    const cartTotal = {{ cart.total_price | divided_by: 100.0 }};
    const itemCount = {{ cart.item_count }};

    // Validate
    fetch('/api/wholesale/cart-validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop: '{{ shop.domain }}',
        customerId: '{{ customer.id }}',
        customerTags: {{ customer.tags | json }},
        cartTotal: cartTotal,
        cartItems: itemCount
      })
    })
    .then(res => res.json())
    .then(data => {
      const messageEl = document.getElementById('wholesale-order-minimum');
      if (!data.validation.canProceed) {
        messageEl.innerHTML = `
          <div class="alert alert-warning">
            ${data.validation.messages.join('<br>')}
          </div>
        `;
        document.querySelector('[name="checkout"]').disabled = data.validation.shouldBlock;
      } else {
        messageEl.innerHTML = '';
        document.querySelector('[name="checkout"]').disabled = false;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', checkOrderMinimum);
  document.addEventListener('cart:updated', checkOrderMinimum);
</script>
```

---

## CSS Styling

Add to your theme's CSS file:

```css
/* Wholesale Features Styling */

.wholesale-price-display {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0;
}

.wholesale-price {
  color: #008060;
  font-weight: bold;
  font-size: 1.2em;
}

.retail-price {
  text-decoration: line-through;
  color: #999;
  font-size: 0.9em;
}

.savings-badge {
  background: #008060;
  color: white;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 0.85em;
  font-weight: bold;
}

.wholesale-login-required {
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
  text-align: center;
}

.wholesale-message {
  font-size: 1.1em;
  margin-bottom: 12px;
  color: #333;
}

.wholesale-login-btn {
  display: inline-block;
  background: #008060;
  color: white;
  padding: 12px 24px;
  border-radius: 4px;
  text-decoration: none;
  font-weight: bold;
}

.wholesale-login-btn:hover {
  background: #006e52;
}

.wholesale-portal-link {
  font-weight: bold;
  color: #008060 !important;
  margin-left: 16px;
}

.volume-pricing-table {
  margin: 20px 0;
  padding: 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.volume-pricing-table table {
  width: 100%;
  border-collapse: collapse;
}

.volume-pricing-table th,
.volume-pricing-table td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.volume-pricing-table th {
  font-weight: bold;
  background: #f5f5f5;
}

.sale-clock {
  font-family: monospace;
  margin: 12px 0;
}
```

---

## Testing Checklist

Before going live, test:

- [ ] Login to View Prices works (logged out users see message)
- [ ] Wholesale pricing displays correctly for logged-in wholesale customers
- [ ] Individual variant pricing overrides rule-based pricing
- [ ] Volume pricing table shows correct tiers
- [ ] Sale clock countdown displays and updates
- [ ] Retailer portal link appears for wholesale customers
- [ ] Order validation blocks checkout when minimums not met
- [ ] Additional fees apply correctly to wholesale orders
- [ ] Mobile responsiveness for all features
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari, Edge)

---

## API Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/wholesale/should-hide-prices` | GET | Check if prices should be hidden |
| `/api/wholesale/price` | GET | Get wholesale price for product |
| `/api/wholesale/variant-price` | GET | Get individual variant pricing |
| `/api/wholesale/cart-validate` | POST | Validate cart against order limits |
| `/api/wholesale/cart-pricing` | POST | Calculate cart with wholesale pricing |
| `/api/retailer/check-session` | GET | Check if customer is wholesale retailer |
| `/api/wholesale/customer-info` | GET | Get customer wholesale status |

---

## Troubleshooting

### Prices not showing wholesale discount
1. Verify customer has correct tags
2. Check pricing rule is published
3. Ensure customer is logged in
4. Check browser console for errors
5. Verify API endpoints are accessible

### Login to View Prices not working
1. Check feature is enabled in admin
2. Verify JavaScript is loading
3. Check customer login status
4. Inspect DOM for hidden price elements

### Sale clock not updating
1. Verify end date format is correct
2. Check JavaScript console for errors
3. Ensure data attribute is set correctly
4. Test with future date

### Order validation not blocking
1. Check order limit rules are active
2. Verify customer tags match rule
3. Test with cart below minimum
4. Check console for API errors

---

## Support

For issues or questions:
1. Check browser console for JavaScript errors
2. Verify API endpoints return correct data
3. Review admin settings for each feature
4. Contact support with error messages

---

## Next Steps

1. Install JavaScript and CSS files
2. Test features in development theme
3. Configure settings in admin panel
4. Test with real customer accounts
5. Deploy to live theme
6. Monitor for issues and optimize

Good luck with your wholesale integration! 🚀
