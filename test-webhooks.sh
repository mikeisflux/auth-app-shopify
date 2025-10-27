#!/bin/bash

echo "=== Testing Webhook Endpoints ==="
echo ""

cd /home/ec2-user/verify-my-collectible || exit 1

echo "1. Clearing old PM2 logs..."
pm2 flush

echo ""
echo "2. Checking server is running..."
pm2 status

echo ""
echo "3. Testing health endpoint..."
curl -s https://verifymycollectible.com/webhooks/health
echo ""

echo ""
echo "4. Testing webhook endpoint (should reject unauthorized)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://verifymycollectible.com/webhooks \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}')
echo "Response code: $HTTP_CODE"
if [ "$HTTP_CODE" == "401" ]; then
  echo "✅ PASS - Correctly rejected unauthorized webhook with 401"
else
  echo "❌ FAIL - Expected 401, got $HTTP_CODE"
fi

echo ""
echo "5. Checking fresh logs after test..."
sleep 1
pm2 logs verify-my-collectible --lines 20 --nostream

echo ""
echo "=== Test Complete ==="
echo ""
echo "Now test in Shopify Partner Dashboard:"
echo "1. Go to https://partners.shopify.com"
echo "2. Select your app → Configuration → Webhooks"
echo "3. Test each GDPR webhook:"
echo "   - customers/data_request"
echo "   - customers/redact"
echo "   - shop/redact"
echo ""
echo "All should return 200 OK!"
