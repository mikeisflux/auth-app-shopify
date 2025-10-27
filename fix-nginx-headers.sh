#!/bin/bash

echo "=== Fixing Nginx Proxy Headers for Shopify Webhooks ==="
echo ""

echo "1. Checking current nginx configuration..."
NGINX_CONF=$(sudo find /etc/nginx -name "*.conf" -exec grep -l "verifymycollectible.com" {} \;)
echo "Found config: $NGINX_CONF"

echo ""
echo "2. Backing up current nginx config..."
sudo cp $NGINX_CONF ${NGINX_CONF}.backup.$(date +%Y%m%d_%H%M%S)

echo ""
echo "3. Checking if proxy headers are configured..."
if sudo grep -q "proxy_set_header X-Shopify-Hmac-SHA256" $NGINX_CONF; then
    echo "✅ Shopify HMAC header already configured"
else
    echo "❌ Shopify HMAC header NOT configured - needs fixing"
    echo ""
    echo "Current proxy configuration:"
    sudo grep -A 10 "location / {" $NGINX_CONF | head -15
fi

echo ""
echo "4. Displaying current nginx configuration for verifymycollectible.com:"
echo "===================="
sudo cat $NGINX_CONF
echo "===================="

echo ""
echo "=== Diagnosis Complete ==="
echo ""
echo "To fix, we need to add these headers to the location / block:"
echo ""
cat <<'EOF'
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # CRITICAL: Preserve Shopify webhook headers
        proxy_set_header X-Shopify-Hmac-SHA256 $http_x_shopify_hmac_sha256;
        proxy_set_header X-Shopify-Shop-Domain $http_x_shopify_shop_domain;
        proxy_set_header X-Shopify-Topic $http_x_shopify_topic;
        proxy_set_header X-Shopify-API-Version $http_x_shopify_api_version;

        proxy_cache_bypass $http_upgrade;
    }
EOF
