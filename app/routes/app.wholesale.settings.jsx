// Wholesale Settings
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigate, useSubmit } from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  Select,
  Checkbox,
  Button,
  BlockStack,
  Banner,
  Text
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { WholesaleModel } from "../models/wholesale.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const settings = await WholesaleModel.getSettings(shopDomain);

  return json({ settings });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const formData = await request.formData();

  const settings = {
    showCrossedPrices: formData.get('showCrossedPrices') === 'true',
    compareAtAsCrossed: formData.get('compareAtAsCrossed') === 'true',
    couponFieldMode: formData.get('couponFieldMode'),
    preventShopifyAutoDiscounts: formData.get('preventShopifyAutoDiscounts') === 'true',
    checkoutMethod: formData.get('checkoutMethod'),
    appMode: formData.get('appMode')
  };

  try {
    await WholesaleModel.updateSettings(shopDomain, settings);
    return json({ success: true, message: 'Settings saved successfully!' });
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function WholesaleSettings() {
  const { settings } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [showCrossedPrices, setShowCrossedPrices] = useState(settings?.show_crossed_prices ?? true);
  const [compareAtAsCrossed, setCompareAtAsCrossed] = useState(settings?.compare_at_as_crossed ?? false);
  const [couponFieldMode, setCouponFieldMode] = useState(settings?.coupon_field_mode ?? 'disabled');
  const [preventShopifyAutoDiscounts, setPreventShopifyAutoDiscounts] = useState(settings?.prevent_shopify_auto_discounts ?? false);
  const [checkoutMethod, setCheckoutMethod] = useState(settings?.checkout_method ?? 'draft_order');
  const [appMode, setAppMode] = useState(settings?.app_mode ?? 'test');

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append('showCrossedPrices', showCrossedPrices);
    formData.append('compareAtAsCrossed', compareAtAsCrossed);
    formData.append('couponFieldMode', couponFieldMode);
    formData.append('preventShopifyAutoDiscounts', preventShopifyAutoDiscounts);
    formData.append('checkoutMethod', checkoutMethod);
    formData.append('appMode', appMode);

    submit(formData, { method: 'post' });
  };

  return (
    <Page
      title="Wholesale Settings"
      subtitle="Configure global wholesale portal settings"
      backAction={{ onAction: () => navigate('/app/wholesale') }}
      primaryAction={{
        content: 'Save Settings',
        onAction: handleSubmit
      }}
    >
      <Layout>
        <Layout.Section>
          {actionData?.success && (
            <Banner status="success">
              <p>{actionData.message}</p>
            </Banner>
          )}

          {actionData?.error && (
            <Banner status="critical">
              <p>{actionData.error}</p>
            </Banner>
          )}

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">General Settings</Text>

              <FormLayout>
                <Select
                  label="App Mode"
                  options={[
                    { label: 'Test Mode (Preview)', value: 'test' },
                    { label: 'Live Mode (Active)', value: 'live' }
                  ]}
                  value={appMode}
                  onChange={setAppMode}
                  helpText="Test mode hides features from customers. Switch to Live when ready."
                />

                <Checkbox
                  label="Show crossed-out retail prices"
                  checked={showCrossedPrices}
                  onChange={setShowCrossedPrices}
                  helpText="Display original price with strikethrough next to wholesale price"
                />

                <Checkbox
                  label="Use compare-at price for crossed out display"
                  checked={compareAtAsCrossed}
                  onChange={setCompareAtAsCrossed}
                  helpText="Show Shopify's compare-at price instead of retail price"
                />
              </FormLayout>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Checkout Settings</Text>

              <FormLayout>
                <Select
                  label="Checkout Method"
                  options={[
                    { label: 'Draft Order API (Recommended)', value: 'draft_order' },
                    { label: 'Coupon Code API', value: 'coupon_code' }
                  ]}
                  value={checkoutMethod}
                  onChange={setCheckoutMethod}
                  helpText="Draft Order API supports custom shipping and fees"
                />

                <Select
                  label="Coupon Code Field"
                  options={[
                    { label: 'Disabled for wholesale customers (Recommended)', value: 'disabled' },
                    { label: 'Enabled for all', value: 'all' },
                    { label: 'Enabled for specific tags', value: 'tagged' }
                  ]}
                  value={couponFieldMode}
                  onChange={setCouponFieldMode}
                  helpText="Control coupon code availability during checkout"
                />

                <Checkbox
                  label="Prevent Shopify automatic discounts"
                  checked={preventShopifyAutoDiscounts}
                  onChange={setPreventShopifyAutoDiscounts}
                  helpText="Disable Shopify's automatic discounts for wholesale orders"
                />
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">About Settings</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  These settings control the global behavior of the Wholesale Portal.
                </Text>
                <Text variant="bodySm">
                  Changes take effect immediately after saving.
                </Text>
                <Text variant="bodySm">
                  Always test in Test Mode before switching to Live Mode.
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Current Mode</Text>
              <Banner status={appMode === 'live' ? 'success' : 'info'}>
                <p>
                  <strong>{appMode === 'live' ? 'Live Mode' : 'Test Mode'}</strong>
                  <br />
                  {appMode === 'live'
                    ? 'Wholesale features are visible to customers'
                    : 'Wholesale features are hidden from customers'}
                </p>
              </Banner>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
