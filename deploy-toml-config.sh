#!/bin/bash

echo "=== Deploying shopify.app.toml Configuration to Shopify ==="
echo ""

echo "This will push your TOML configuration (including GDPR webhooks) to Shopify"
echo ""

# Check if Shopify CLI is installed
if ! command -v shopify &> /dev/null; then
    echo "❌ Shopify CLI not installed"
    echo ""
    echo "Install it with:"
    echo "  npm install -g @shopify/cli @shopify/app"
    echo ""
    echo "Or using Homebrew (Mac):"
    echo "  brew tap shopify/shopify"
    echo "  brew install shopify-cli"
    echo ""
    exit 1
fi

echo "✅ Shopify CLI installed"
echo ""

echo "Checking shopify.app.toml configuration..."
if grep -q "compliance_topics" shopify.app.toml; then
    echo "✅ GDPR compliance webhooks found in TOML:"
    grep -A 2 "compliance_topics" shopify.app.toml
else
    echo "❌ No compliance_topics in shopify.app.toml"
    exit 1
fi

echo ""
echo "Pushing configuration to Shopify..."
echo ""

# Deploy the app configuration
shopify app config push

echo ""
echo "=== Configuration Deployed ==="
echo ""
echo "The GDPR webhooks from shopify.app.toml are now registered with Shopify!"
echo "Test them by triggering the webhooks from your Partner Dashboard."
