// Create New Shipping Rule
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
  const title = formData.get('title');
  const rateType = formData.get('rateType');
  const shippingCharge = parseFloat(formData.get('shippingCharge'));
  const customerTags = formData.get('customerTags')?.split(',').map(t => t.trim()).filter(Boolean) || [];
  const status = formData.get('status');

  try {
    await WholesaleModel.createShippingRule(shopDomain, {
      title,
      status,
      rateType,
      shippingCharge,
      customerSelection: 'tagged',
      customerTags,
      geographicScope: 'all_countries',
      rateCalculationBasis: 'amount'
    });

    return redirect('/app/wholesale/shipping');
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function NewShippingRule() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const actionData = useActionData();

  const [title, setTitle] = useState('');
  const [rateType, setRateType] = useState('flat');
  const [shippingCharge, setShippingCharge] = useState('');
  const [customerTags, setCustomerTags] = useState('');
  const [status, setStatus] = useState('active');

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('rateType', rateType);
    formData.append('shippingCharge', shippingCharge);
    formData.append('customerTags', customerTags);
    formData.append('status', status);

    submit(formData, { method: 'post' });
  };

  return (
    <Page
      title="Create Shipping Rule"
      backAction={{ onAction: () => navigate('/app/wholesale/shipping') }}
      primaryAction={{
        content: 'Save',
        onAction: handleSubmit,
        disabled: !title || shippingCharge === ''
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
                label="Shipping Title"
                value={title}
                onChange={setTitle}
                placeholder="e.g., Wholesale Free Shipping"
                autoComplete="off"
                helpText="Name shown to customers at checkout (max 80 characters)"
                maxLength={80}
              />

              <Select
                label="Rate Type"
                options={[
                  { label: 'Flat Rate', value: 'flat' },
                  { label: 'Percentage of Cart', value: 'percentage' },
                  { label: 'Conditional', value: 'conditional' }
                ]}
                value={rateType}
                onChange={setRateType}
              />

              <TextField
                label="Shipping Charge"
                type="number"
                value={shippingCharge}
                onChange={setShippingCharge}
                placeholder="0.00"
                prefix="$"
                autoComplete="off"
                helpText="Enter 0 for free shipping"
              />

              <TextField
                label="Customer Tags"
                value={customerTags}
                onChange={setCustomerTags}
                placeholder="wholesale, vip"
                autoComplete="off"
                helpText="Comma-separated list of customer tags"
              />

              <Select
                label="Status"
                options={[
                  { label: 'Active', value: 'active' },
                  { label: 'Inactive', value: 'inactive' }
                ]}
                value={status}
                onChange={setStatus}
              />
            </FormLayout>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Quick Tips</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">• Set charge to $0 for free shipping</Text>
                <Text variant="bodySm">• Tags must match customer tags</Text>
                <Text variant="bodySm">• Flat rate is most common</Text>
                <Text variant="bodySm">• Test before activating</Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
