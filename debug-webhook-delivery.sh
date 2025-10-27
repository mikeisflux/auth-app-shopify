#!/bin/bash

echo "=== Debugging Shopify Webhook Delivery ==="
echo ""

echo "1. Check nginx access logs for webhook requests..."
echo "Looking for POST requests to /webhooks in the last 100 lines:"
sudo tail -100 /var/log/nginx/access.log | grep -i webhook

echo ""
echo "2. Check nginx access logs for ANY recent Shopify requests..."
echo "Looking for 'shopify' in user agent or headers:"
sudo tail -100 /var/log/nginx/access.log | grep -i shopify

echo ""
echo "3. Check nginx error logs for any issues..."
sudo tail -50 /var/log/nginx/error.log | grep -i webhook

echo ""
echo "4. Test webhook endpoint is publicly accessible..."
echo "Testing from external perspective:"
curl -X POST https://verifymycollectible.com/webhooks \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: app/uninstalled" \
  -H "X-Shopify-Shop-Domain: test-shop.myshopify.com" \
  -d '{"test": "data"}' \
  -v 2>&1 | grep -E "(HTTP|X-Shopify|< )"

echo ""
echo "5. Check application is listening on port 3000..."
sudo netstat -tlnp | grep 3000

echo ""
echo "6. Check PM2 app status..."
pm2 status

echo ""
echo "7. Flush logs and send test request..."
pm2 flush
echo "Sending test request..."
curl -X POST https://verifymycollectible.com/webhooks \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: customers/data_request" \
  -H "X-Shopify-Shop-Domain: test.myshopify.com" \
  -d '{"shop_id": 123, "shop_domain": "test.myshopify.com"}'

echo ""
echo "Wait 2 seconds for logs..."
sleep 2

echo ""
echo "8. Check if request appeared in logs..."
pm2 logs verify-my-collectible --lines 20 --nostream

echo ""
echo "=== Diagnosis Complete ==="
echo ""
echo "If nginx access logs show no requests to /webhooks,"
echo "then Shopify isn't sending webhooks to your server."
echo ""
echo "Possible reasons:"
echo "1. Webhooks not registered in Shopify Partner Dashboard"
echo "2. Wrong webhook URL configured"
echo "3. App not installed on a dev store"
echo "4. Webhook delivery endpoint URL mismatch"
