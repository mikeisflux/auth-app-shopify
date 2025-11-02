// Login to View Prices - Hide Pricing from Non-Logged-In Users
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigate } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Checkbox,
  Button,
  BlockStack,
  Text,
  Banner,
  InlineStack,
  Select
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { query } from "../db/connection.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Get hide prices settings
  const result = await query(
    `SELECT hps.*
     FROM hide_prices_settings hps
     INNER JOIN shops s ON hps.shop_id = s.id
     WHERE s.shop_domain = $1`,
    [shopDomain]
  );

  const settings = result.rows[0] || {
    enabled: false,
    hide_add_to_cart: true,
    custom_message: 'Login to see prices',
    button_text: 'Login to View Prices',
    apply_to_collections: null,
    exclude_collections: null
  };

  return json({ settings });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const formData = await request.formData();
  const enabled = formData.get('enabled') === 'true';
  const hideAddToCart = formData.get('hideAddToCart') === 'true';
  const customMessage = formData.get('customMessage');
  const buttonText = formData.get('buttonText');
  const applyToCollections = formData.get('applyToCollections') || null;
  const excludeCollections = formData.get('excludeCollections') || null;

  try {
    await query(
      `INSERT INTO hide_prices_settings (
        shop_id, enabled, hide_add_to_cart, custom_message,
        button_text, apply_to_collections, exclude_collections
      )
      SELECT s.id, $2, $3, $4, $5, $6, $7
      FROM shops s
      WHERE s.shop_domain = $1
      ON CONFLICT (shop_id) DO UPDATE
      SET enabled = $2,
          hide_add_to_cart = $3,
          custom_message = $4,
          button_text = $5,
          apply_to_collections = $6,
          exclude_collections = $7,
          updated_at = CURRENT_TIMESTAMP`,
      [shopDomain, enabled, hideAddToCart, customMessage, buttonText,
       applyToCollections, excludeCollections]
    );

    return json({ success: true, message: 'Settings saved successfully!' });
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function HidePricesSettings() {
  const { settings } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();

  const [enabled, setEnabled] = useState(settings.enabled);
  const [hideAddToCart, setHideAddToCart] = useState(settings.hide_add_to_cart);
  const [customMessage, setCustomMessage] = useState(settings.custom_message);
  const [buttonText, setButtonText] = useState(settings.button_text);
  const [applyToCollections, setApplyToCollections] = useState(settings.apply_to_collections || '');
  const [excludeCollections, setExcludeCollections] = useState(settings.exclude_collections || '');

  return (
    <Page
      title="Login to View Prices"
      subtitle="Require customer login to see pricing and add to cart"
      backAction={{ onAction: () => navigate('/app/wholesale') }}
    >
      <Layout>
        <Layout.Section>
          {actionData?.success && (
            <Banner status="success" onDismiss={() => {}}>
              <p>{actionData.message}</p>
            </Banner>
          )}

          {actionData?.error && (
            <Banner status="critical">
              <p>{actionData.error}</p>
            </Banner>
          )}

          {enabled && (
            <Banner status="info">
              <p>Login to View Prices is ENABLED. Non-logged-in customers will not see pricing.</p>
            </Banner>
          )}

          <Form method="post">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Hide Prices Settings</Text>

                <Checkbox
                  label="Enable Login to View Prices"
                  checked={enabled}
                  onChange={setEnabled}
                  helpText="When enabled, prices will be hidden from non-logged-in customers"
                />

                <input type="hidden" name="enabled" value={enabled.toString()} />

                {enabled && (
                  <BlockStack gap="400">
                    <Checkbox
                      label="Hide Add to Cart Button"
                      checked={hideAddToCart}
                      onChange={setHideAddToCart}
                      helpText="Also hide the add to cart button for non-logged-in users"
                    />

                    <input type="hidden" name="hideAddToCart" value={hideAddToCart.toString()} />

                    <TextField
                      label="Custom Message"
                      name="customMessage"
                      value={customMessage}
                      onChange={setCustomMessage}
                      helpText="Message shown instead of price"
                      autoComplete="off"
                    />

                    <TextField
                      label="Login Button Text"
                      name="buttonText"
                      value={buttonText}
                      onChange={setButtonText}
                      helpText="Text for the login button"
                      autoComplete="off"
                    />

                    <TextField
                      label="Apply to Collections (optional)"
                      name="applyToCollections"
                      value={applyToCollections}
                      onChange={setApplyToCollections}
                      placeholder='["collection-id-1", "collection-id-2"]'
                      helpText="JSON array of collection IDs to apply this to. Leave empty for all products."
                      autoComplete="off"
                      multiline={2}
                    />

                    <TextField
                      label="Exclude Collections (optional)"
                      name="excludeCollections"
                      value={excludeCollections}
                      onChange={setExcludeCollections}
                      placeholder='["collection-id-3", "collection-id-4"]'
                      helpText="JSON array of collection IDs to exclude from hiding prices"
                      autoComplete="off"
                      multiline={2}
                    />
                  </BlockStack>
                )}

                <InlineStack gap="200">
                  <Button variant="primary" submit>
                    Save Settings
                  </Button>
                  <Button onClick={() => navigate('/app/wholesale')}>
                    Cancel
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Form>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">How It Works</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  <strong>When Enabled:</strong>
                </Text>
                <Text variant="bodySm">
                  • Non-logged-in customers see custom message instead of price
                </Text>
                <Text variant="bodySm">
                  • Login button encourages registration
                </Text>
                <Text variant="bodySm">
                  • Logged-in customers see normal pricing
                </Text>
                <Text variant="bodySm">
                  • Protects wholesale pricing information
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Storefront Integration</Text>
              <Text variant="bodySm">
                Add this JavaScript to your theme to check login status and hide prices:
              </Text>
              <Text variant="bodySm" tone="subdued" fontFamily="mono">
                {`{% unless customer %}`}
              </Text>
              <Text variant="bodySm" tone="subdued" fontFamily="mono">
                {`  <p class="hidden-price">${customMessage}</p>`}
              </Text>
              <Text variant="bodySm" tone="subdued" fontFamily="mono">
                {`  <a href="/account/login">${buttonText}</a>`}
              </Text>
              <Text variant="bodySm" tone="subdued" fontFamily="mono">
                {`{% else %}`}
              </Text>
              <Text variant="bodySm" tone="subdued" fontFamily="mono">
                {`  {{ product.price }}`}
              </Text>
              <Text variant="bodySm" tone="subdued" fontFamily="mono">
                {`{% endunless %}`}
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">API Endpoint</Text>
              <Text variant="bodySm">
                Check if prices should be hidden via API:
              </Text>
              <Text variant="bodySm" tone="subdued" fontFamily="mono">
                GET /api/wholesale/should-hide-prices
              </Text>
              <Text variant="bodySm" tone="subdued" fontFamily="mono">
                ?shop=[domain]&logged_in=[true/false]
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Use Cases</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  • Encourage customer registration
                </Text>
                <Text variant="bodySm">
                  • Protect wholesale pricing from competitors
                </Text>
                <Text variant="bodySm">
                  • Build customer database
                </Text>
                <Text variant="bodySm">
                  • Create exclusive pricing atmosphere
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
