#!/bin/bash

echo "=== Updating Nginx Configuration for Shopify Webhooks ==="
echo ""

# Find the nginx config file
NGINX_CONF="/etc/nginx/conf.d/verifymycollectible.conf"
if [ ! -f "$NGINX_CONF" ]; then
    NGINX_CONF="/etc/nginx/sites-available/verifymycollectible.com"
fi
if [ ! -f "$NGINX_CONF" ]; then
    echo "❌ Could not find nginx config file"
    echo "Please provide the path to your nginx config:"
    sudo find /etc/nginx -name "*.conf" -exec grep -l "verifymycollectible.com" {} \;
    exit 1
fi

echo "Using config: $NGINX_CONF"

echo ""
echo "1. Backing up current config..."
sudo cp $NGINX_CONF ${NGINX_CONF}.backup.$(date +%Y%m%d_%H%M%S)

echo ""
echo "2. Creating updated config..."
sudo tee /tmp/nginx-updated.conf > /dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name verifymycollectible.com www.verifymycollectible.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name verifymycollectible.com www.verifymycollectible.com;

    # SSL configuration (update paths to your actual certificate paths)
    ssl_certificate /etc/letsencrypt/live/verifymycollectible.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/verifymycollectible.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Increase client body size for file uploads
    client_max_body_size 100M;

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
        proxy_set_header X-Shopify-Webhook-Id $http_x_shopify_webhook_id;

        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }
}
EOF

echo ""
echo "3. Review the new configuration:"
echo "===================="
cat /tmp/nginx-updated.conf
echo "===================="

echo ""
read -p "Apply this configuration? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "4. Testing nginx configuration..."
    sudo cp /tmp/nginx-updated.conf $NGINX_CONF
    sudo nginx -t

    if [ $? -eq 0 ]; then
        echo ""
        echo "5. Reloading nginx..."
        sudo systemctl reload nginx
        echo "✅ Nginx configuration updated successfully!"

        echo ""
        echo "6. Testing webhook endpoint..."
        sleep 2
        curl -I https://verifymycollectible.com/webhooks/health
    else
        echo "❌ Nginx configuration test failed!"
        echo "Restoring backup..."
        sudo cp ${NGINX_CONF}.backup.* $NGINX_CONF
        exit 1
    fi
else
    echo "Configuration not applied. Backup saved at: ${NGINX_CONF}.backup.*"
fi

echo ""
echo "=== Update Complete ==="
