#!/bin/bash

echo "=== Registering GDPR Compliance Webhooks via Shopify Admin API ==="
echo ""

# Load database credentials
if [ -f .env ]; then
    source <(grep -v '^#' .env | sed 's/^/export /')
fi

if [ -n "$AWS_DB_USER" ] && [ -n "$AWS_DB_PASSWORD" ] && [ -n "$AWS_DB_HOST" ] && [ -n "$AWS_DB_NAME" ]; then
    export DATABASE_URL="postgresql://${AWS_DB_USER}:${AWS_DB_PASSWORD}@${AWS_DB_HOST}:${AWS_DB_PORT:-5432}/${AWS_DB_NAME}?sslmode=require"
fi

SHOP="test1-239283829347123859138630.myshopify.com"
WEBHOOK_URL="https://verifymycollectible.com/webhooks"

echo "1. Getting access token from database..."
ACCESS_TOKEN=$(psql "$DATABASE_URL" -t -c "SELECT access_token FROM shops WHERE shop_domain = '$SHOP';" | xargs)

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Could not find access token for shop: $SHOP"
    exit 1
fi

echo "✅ Found access token"
echo ""

echo "2. Checking currently registered webhooks..."
EXISTING=$(curl -s -X GET \
  "https://${SHOP}/admin/api/2024-10/webhooks.json" \
  -H "X-Shopify-Access-Token: ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json")

echo "Current webhooks:"
echo "$EXISTING" | python3 -m json.tool 2>/dev/null || echo "$EXISTING"
echo ""

echo "3. Registering customers/data_request webhook..."
RESPONSE=$(curl -s -X POST \
  "https://${SHOP}/admin/api/2024-10/webhooks.json" \
  -H "X-Shopify-Access-Token: ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"webhook\": {
      \"topic\": \"customers/data_request\",
      \"address\": \"${WEBHOOK_URL}\",
      \"format\": \"json\"
    }
  }")

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "4. Registering customers/redact webhook..."
RESPONSE=$(curl -s -X POST \
  "https://${SHOP}/admin/api/2024-10/webhooks.json" \
  -H "X-Shopify-Access-Token: ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"webhook\": {
      \"topic\": \"customers/redact\",
      \"address\": \"${WEBHOOK_URL}\",
      \"format\": \"json\"
    }
  }")

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "5. Registering shop/redact webhook..."
RESPONSE=$(curl -s -X POST \
  "https://${SHOP}/admin/api/2024-10/webhooks.json" \
  -H "X-Shopify-Access-Token: ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"webhook\": {
      \"topic\": \"shop/redact\",
      \"address\": \"${WEBHOOK_URL}\",
      \"format\": \"json\"
    }
  }")

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "6. Verifying all webhooks are registered..."
FINAL=$(curl -s -X GET \
  "https://${SHOP}/admin/api/2024-10/webhooks.json" \
  -H "X-Shopify-Access-Token: ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json")

echo "All registered webhooks:"
echo "$FINAL" | python3 -m json.tool 2>/dev/null || echo "$FINAL"

echo ""
echo "=== Registration Complete ==="
echo ""
echo "If you see webhooks with IDs, they were registered successfully!"
echo "If you see errors about 'already exists', they're already registered (good!)"
