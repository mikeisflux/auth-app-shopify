#!/bin/bash

echo "=== Checking OAuth Installation and Webhook Registration ==="
echo ""

echo "1. Check database for installed shops..."
echo "Connecting to database..."

# Check if shop is in database
psql $DATABASE_URL -c "SELECT shop_domain, access_token IS NOT NULL as has_token, scope, is_active, created_at FROM shops ORDER BY created_at DESC LIMIT 5;" 2>/dev/null || echo "❌ Could not connect to database. Set DATABASE_URL environment variable."

echo ""
echo "2. Check nginx logs for OAuth callback requests..."
echo "Looking for /auth/callback in access logs:"
sudo tail -200 /var/log/nginx/access.log | grep "/auth/callback" | tail -5

echo ""
echo "3. Check nginx logs for /auth (install start) requests..."
echo "Looking for /auth requests:"
sudo tail -200 /var/log/nginx/access.log | grep "GET /auth" | grep -v callback | tail -5

echo ""
echo "4. Check PM2 logs for webhook registration..."
echo "Looking for 'Register' or 'webhook' in application logs:"
pm2 logs verify-my-collectible --lines 500 --nostream 2>/dev/null | grep -i "register\|webhook" | tail -10

echo ""
echo "5. Test if shop has active session..."
SHOP="test1-239283829347123859138630.myshopify.com"
echo "Checking sessions table for shop: $SHOP"
psql $DATABASE_URL -c "SELECT id, shop, expires FROM shopify_sessions WHERE shop = '$SHOP' ORDER BY expires DESC LIMIT 3;" 2>/dev/null || echo "❌ Could not query sessions table"

echo ""
echo "=== Diagnosis Complete ==="
echo ""
echo "If you see:"
echo "  ✅ Shop in database with access_token = true → OAuth completed"
echo "  ✅ /auth/callback requests in nginx logs → OAuth flow happened"
echo "  ✅ 'webhook' in PM2 logs → Webhooks were registered"
echo ""
echo "  ❌ No /auth/callback requests → Need to reinstall app"
echo "  ❌ No shop in database → Need to complete OAuth flow"
echo ""
echo "To reinstall the app and trigger webhook registration:"
echo "1. Uninstall the app from your dev store"
echo "2. Reinstall by visiting: https://verifymycollectible.com/auth?shop=test1-239283829347123859138630.myshopify.com"
