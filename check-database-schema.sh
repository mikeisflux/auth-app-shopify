#!/bin/bash

echo "=== Checking Actual Database Schema and Data ==="
echo ""

# Load database credentials
if [ -f .env ]; then
    source <(grep -v '^#' .env | sed 's/^/export /')
fi

if [ -n "$AWS_DB_USER" ] && [ -n "$AWS_DB_PASSWORD" ] && [ -n "$AWS_DB_HOST" ] && [ -n "$AWS_DB_NAME" ]; then
    export DATABASE_URL="postgresql://${AWS_DB_USER}:${AWS_DB_PASSWORD}@${AWS_DB_HOST}:${AWS_DB_PORT:-5432}/${AWS_DB_NAME}?sslmode=require"
fi

echo "1. Check 'shops' table schema..."
psql "$DATABASE_URL" -c "\d shops"

echo ""
echo "2. Count rows in 'shops' table..."
psql "$DATABASE_URL" -c "SELECT COUNT(*) as total_shops FROM shops;"

echo ""
echo "3. Show ALL data in 'shops' table..."
psql "$DATABASE_URL" -c "SELECT * FROM shops;"

echo ""
echo "4. Check 'shopify_sessions' table schema..."
psql "$DATABASE_URL" -c "\d shopify_sessions"

echo ""
echo "5. Count rows in 'shopify_sessions' table..."
psql "$DATABASE_URL" -c "SELECT COUNT(*) as total_sessions FROM shopify_sessions;"

echo ""
echo "6. Show ALL sessions..."
psql "$DATABASE_URL" -c "SELECT * FROM shopify_sessions ORDER BY id DESC LIMIT 10;"

echo ""
echo "7. Check nginx logs for RECENT auth requests (last 100 lines)..."
echo "Looking for /auth in access logs from the last few minutes:"
sudo tail -100 /var/log/nginx/access.log | grep -E "GET /auth|POST /auth" | tail -20

echo ""
echo "8. Check nginx logs for the REINSTALL (look for timestamp)..."
echo "Last 20 requests to the app:"
sudo tail -100 /var/log/nginx/access.log | grep "verifymycollectible.com" | tail -20

echo ""
echo "9. Check PM2 logs for OAuth/auth activity..."
pm2 logs verify-my-collectible --lines 500 --nostream 2>/dev/null | grep -i "auth\|oauth\|install\|callback" | tail -20

echo ""
echo "=== Analysis ==="
echo ""
echo "If shops table is EMPTY → OAuth never completed"
echo "If shopify_sessions table is EMPTY → No active session"
echo "If no /auth/callback in nginx → OAuth flow didn't finish"
