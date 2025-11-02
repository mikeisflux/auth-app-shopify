// Create New Pricing Rule
import { json, redirect } from "@remix-run/node";
import { useActionData, useNavigate, useSubmit } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Button,
  BlockStack,
  Banner
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { WholesaleModel } from "../models/wholesale.server";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const formData = await request.formData();
  const name = formData.get('name');
  const ruleType = formData.get('ruleType');
  const discountType = formData.get('discountType');
  const discountValue = parseFloat(formData.get('discountValue'));
  const customerTags = formData.get('customerTags')?.split(',').map(t => t.trim()).filter(Boolean) || [];
  const status = formData.get('status');

  try {
    await WholesaleModel.createPricingRule(shopDomain, {
      name,
      ruleType,
      status,
      discountType,
      discountValue,
      customerSelection: 'tagged',
      customerTags,
      productScope: 'all'
    });

    return redirect('/app/wholesale/pricing');
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function NewPricingRule() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const actionData = useActionData();

  const [name, setName] = useState('');
  const [ruleType, setRuleType] = useState('wholesale');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [customerTags, setCustomerTags] = useState('');
  const [status, setStatus] = useState('unpublished');

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('ruleType', ruleType);
    formData.append('discountType', discountType);
    formData.append('discountValue', discountValue);
    formData.append('customerTags', customerTags);
    formData.append('status', status);

    submit(formData, { method: 'post' });
  };

  return (
    <Page
      title="Create Pricing Rule"
      backAction={{ onAction: () => navigate('/app/wholesale/pricing') }}
      primaryAction={{
        content: 'Save',
        onAction: handleSubmit,
        disabled: !name || !discountValue
      }}
    >
      <Layout>
        <Layout.Section>
          {actionData?.error && (
            <Banner status="critical">
              <p>{actionData.error}</p>
            </Banner>
          )}

          <Card>
            <FormLayout>
              <TextField
                label="Rule Name"
                value={name}
                onChange={setName}
                placeholder="e.g., Wholesale 40% Off"
                autoComplete="off"
                helpText="Internal name for this pricing rule"
              />

              <Select
                label="Rule Type"
                options={[
                  { label: 'Wholesale Pricing', value: 'wholesale' },
                  { label: 'Volume Pricing', value: 'volume' },
                  { label: 'Individual Product Pricing', value: 'individual' }
                ]}
                value={ruleType}
                onChange={setRuleType}
              />

              <Select
                label="Discount Type"
                options={[
                  { label: 'Percentage Off', value: 'percentage' },
                  { label: 'Fixed Amount Off', value: 'fixed_amount' },
                  { label: 'Fixed Price', value: 'fixed_price' }
                ]}
                value={discountType}
                onChange={setDiscountType}
              />

              <TextField
                label="Discount Value"
                type="number"
                value={discountValue}
                onChange={setDiscountValue}
                placeholder={discountType === 'percentage' ? '40' : '10.00'}
                autoComplete="off"
                helpText={
                  discountType === 'percentage'
                    ? 'Enter percentage (e.g., 40 for 40% off)'
                    : 'Enter amount in dollars'
                }
              />

              <TextField
                label="Customer Tags"
                value={customerTags}
                onChange={setCustomerTags}
                placeholder="wholesale, tier1, kickstarter"
                autoComplete="off"
                helpText="Comma-separated list of customer tags. Only customers with these tags will see this pricing."
              />

              <Select
                label="Status"
                options={[
                  { label: 'Published (Active)', value: 'published' },
                  { label: 'Unpublished (Draft)', value: 'unpublished' }
                ]}
                value={status}
                onChange={setStatus}
                helpText="Unpublished rules are saved but not active"
              />
            </FormLayout>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Quick Tips</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">• Use customer tags to target specific groups</Text>
                <Text variant="bodySm">• Start with unpublished status to test</Text>
                <Text variant="bodySm">• Percentage discounts are most common</Text>
                <Text variant="bodySm">• You can edit rules after creation</Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
