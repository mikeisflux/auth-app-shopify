#!/bin/bash

echo "=== Checking OAuth Installation and Webhook Registration ==="
echo ""

# Set DATABASE_URL directly (script will read from .env on production)
# If DATABASE_URL is truncated in .env, construct it from components
if [ -f .env ]; then
    source <(grep -v '^#' .env | sed 's/^/export /')
fi

# Reconstruct DATABASE_URL if needed
if [ -n "$AWS_DB_USER" ] && [ -n "$AWS_DB_PASSWORD" ] && [ -n "$AWS_DB_HOST" ] && [ -n "$AWS_DB_NAME" ]; then
    export DATABASE_URL="postgresql://${AWS_DB_USER}:${AWS_DB_PASSWORD}@${AWS_DB_HOST}:${AWS_DB_PORT:-5432}/${AWS_DB_NAME}?sslmode=require"
    echo "Constructed DATABASE_URL from AWS credentials"
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not configured"
    exit 1
fi

echo "1. Check database connection..."
psql "$DATABASE_URL" -c "SELECT version();" 2>&1 | head -1

echo ""
echo "2. List all database tables..."
psql "$DATABASE_URL" -c "\dt" 2>/dev/null || echo "❌ Could not list tables"

echo ""
echo "3. Check 'shops' table for installed shops..."
psql "$DATABASE_URL" -c "SELECT shop_domain, access_token IS NOT NULL as has_token, scope, is_active, created_at FROM shops ORDER BY created_at DESC LIMIT 10;" 2>/dev/null || echo "❌ Could not query shops table. Checking if table exists..."

echo ""
echo "4. Check 'shopify_sessions' table..."
SHOP="test1-239283829347123859138630.myshopify.com"
psql "$DATABASE_URL" -c "SELECT id, shop, state, isOnline, expires FROM shopify_sessions WHERE shop = '$SHOP' ORDER BY expires DESC LIMIT 5;" 2>/dev/null || echo "❌ Could not query shopify_sessions table"

echo ""
echo "5. Check all sessions (any shop)..."
psql "$DATABASE_URL" -c "SELECT shop, state, isOnline, expires FROM shopify_sessions ORDER BY expires DESC LIMIT 5;" 2>/dev/null

echo ""
echo "6. Check nginx logs for OAuth callback requests..."
echo "Looking for /auth/callback in last 500 lines of access logs:"
sudo tail -500 /var/log/nginx/access.log | grep "/auth/callback" | tail -10

echo ""
echo "7. Check nginx logs for /auth (install start) requests..."
echo "Looking for /auth requests:"
sudo tail -500 /var/log/nginx/access.log | grep "GET /auth" | grep -v callback | grep -v ".js" | grep -v ".css" | tail -10

echo ""
echo "8. Check PM2 logs for webhook registration..."
echo "Looking for 'webhook' or 'register' in application logs:"
pm2 logs verify-my-collectible --lines 1000 --nostream 2>/dev/null | grep -i "webhook\|register" | tail -15

echo ""
echo "9. Check for APP_UNINSTALLED webhook handler..."
pm2 logs verify-my-collectible --lines 200 --nostream 2>/dev/null | grep -i "APP_UNINSTALLED\|uninstall" | tail -5

echo ""
echo "=== Diagnosis Summary ==="
echo ""
echo "✅ If 'shops' table has your store → OAuth completed"
echo "✅ If 'shopify_sessions' table has active sessions → App is installed"
echo "✅ If '/auth/callback' in nginx logs → OAuth flow happened"
echo "✅ If 'webhook' in PM2 logs → Webhooks were registered"
echo ""
echo "❌ If none of the above → Need to reinstall app"
echo ""
