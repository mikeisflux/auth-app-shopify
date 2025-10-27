#!/bin/bash

echo "=== Checking Currently Registered Webhooks ==="
echo ""

# Load database credentials
if [ -f .env ]; then
    source <(grep -v '^#' .env | sed 's/^/export /')
fi

if [ -n "$AWS_DB_USER" ] && [ -n "$AWS_DB_PASSWORD" ] && [ -n "$AWS_DB_HOST" ] && [ -n "$AWS_DB_NAME" ]; then
    export DATABASE_URL="postgresql://${AWS_DB_USER}:${AWS_DB_PASSWORD}@${AWS_DB_HOST}:${AWS_DB_PORT:-5432}/${AWS_DB_NAME}?sslmode=require"
fi

echo "1. Get shop access token from database..."
SHOP="test1-239283829347123859138630.myshopify.com"
ACCESS_TOKEN=$(psql "$DATABASE_URL" -t -c "SELECT access_token FROM shops WHERE shop_domain = '$SHOP';" | xargs)

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Could not find access token for shop: $SHOP"
    exit 1
fi

echo "✅ Found access token"
echo ""

echo "2. Query Shopify Admin API for registered webhooks..."
curl -s -X GET \
  "https://${SHOP}/admin/api/2024-10/webhooks.json" \
  -H "X-Shopify-Access-Token: ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" | python3 -m json.tool 2>/dev/null || echo "Response (raw):"

echo ""
echo ""
echo "3. Checking if GDPR webhooks show up in response..."
echo ""

WEBHOOKS=$(curl -s -X GET \
  "https://${SHOP}/admin/api/2024-10/webhooks.json" \
  -H "X-Shopify-Access-Token: ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json")

echo "Raw response:"
echo "$WEBHOOKS"

echo ""
echo "=== Analysis ==="
echo ""
echo "If you see webhooks listed:"
echo "  ✅ app/uninstalled → Auto-registered, working"
echo "  ✅ customers/data_request → GDPR webhook registered"
echo "  ✅ customers/redact → GDPR webhook registered"
echo "  ✅ shop/redact → GDPR webhook registered"
echo ""
echo "If GDPR webhooks are missing:"
echo "  → They need to be configured via Shopify Partner Dashboard"
echo "  → OR registered programmatically (different API endpoint)"
