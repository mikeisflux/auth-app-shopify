// Create New Additional Fee Rule
import { json, redirect } from "@remix-run/node";
import { useActionData, useNavigate, Form } from "@remix-run/react";
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
import { query } from "../db/connection.server";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const formData = await request.formData();
  const name = formData.get('name');
  const description = formData.get('description');
  const feeType = formData.get('feeType');
  const feeValue = parseFloat(formData.get('feeValue'));
  const customerTags = formData.get('customerTags') || null;
  const appliesTo = formData.get('appliesTo');
  const status = formData.get('status');

  if (!name || !feeType || !feeValue) {
    return json({ error: 'Name, fee type, and fee value are required' }, { status: 400 });
  }

  try {
    await query(
      `INSERT INTO additional_fee_rules (
        shop_id, name, description, fee_type, fee_value,
        customer_tags, applies_to, status
      )
      SELECT s.id, $2, $3, $4, $5, $6, $7, $8
      FROM shops s
      WHERE s.shop_domain = $1`,
      [shopDomain, name, description, feeType, feeValue, customerTags, appliesTo, status]
    );

    return redirect('/app/wholesale/additional-fees');
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function NewAdditionalFee() {
  const actionData = useActionData();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [feeType, setFeeType] = useState('percentage');
  const [feeValue, setFeeValue] = useState('');
  const [customerTags, setCustomerTags] = useState('');
  const [appliesTo, setAppliesTo] = useState('wholesale_only');
  const [status, setStatus] = useState('active');

  return (
    <Page
      title="Create Additional Fee Rule"
      subtitle="Add processing or handling fees to orders"
      backAction={{ onAction: () => navigate('/app/wholesale/additional-fees') }}
    >
      <Layout>
        <Layout.Section>
          {actionData?.error && (
            <Banner status="critical">
              <p>{actionData.error}</p>
            </Banner>
          )}

          <Form method="post">
            <Card>
              <BlockStack gap="400">
                <FormLayout>
                  <TextField
                    label="Fee Name"
                    name="name"
                    value={name}
                    onChange={setName}
                    placeholder="Credit Card Processing Fee"
                    autoComplete="off"
                    requiredIndicator
                  />

                  <TextField
                    label="Description"
                    name="description"
                    value={description}
                    onChange={setDescription}
                    placeholder="3% fee to cover credit card processing costs"
                    autoComplete="off"
                    multiline={2}
                  />

                  <Select
                    label="Fee Type"
                    name="feeType"
                    options={[
                      { label: 'Percentage of Subtotal', value: 'percentage' },
                      { label: 'Fixed Amount', value: 'fixed_amount' }
                    ]}
                    value={feeType}
                    onChange={setFeeType}
                  />

                  <TextField
                    label="Fee Value"
                    name="feeValue"
                    value={feeValue}
                    onChange={setFeeValue}
                    type="number"
                    placeholder={feeType === 'percentage' ? '3' : '5.00'}
                    prefix={feeType === 'percentage' ? '' : '$'}
                    suffix={feeType === 'percentage' ? '%' : ''}
                    helpText={
                      feeType === 'percentage'
                        ? 'Enter percentage (e.g., 3 for 3%)'
                        : 'Enter dollar amount (e.g., 5.00)'
                    }
                    autoComplete="off"
                    requiredIndicator
                  />

                  <TextField
                    label="Customer Tags (optional)"
                    name="customerTags"
                    value={customerTags}
                    onChange={setCustomerTags}
                    placeholder="wholesale, tier1"
                    helpText="Comma-separated tags. Leave empty to apply to all eligible customers."
                    autoComplete="off"
                  />

                  <Select
                    label="Applies To"
                    name="appliesTo"
                    options={[
                      { label: 'All Customers', value: 'all' },
                      { label: 'Wholesale Customers Only', value: 'wholesale_only' },
                      { label: 'Customers with Specific Tags', value: 'tagged' }
                    ]}
                    value={appliesTo}
                    onChange={setAppliesTo}
                    helpText={
                      appliesTo === 'tagged'
                        ? 'Will only apply to customers matching the tags above'
                        : appliesTo === 'wholesale_only'
                        ? 'Will only apply to approved wholesale customers'
                        : 'Will apply to all customers'
                    }
                  />

                  <Select
                    label="Status"
                    name="status"
                    options={[
                      { label: 'Active', value: 'active' },
                      { label: 'Inactive', value: 'inactive' }
                    ]}
                    value={status}
                    onChange={setStatus}
                  />

                  <Button variant="primary" submit>
                    Create Fee Rule
                  </Button>
                </FormLayout>
              </BlockStack>
            </Card>
          </Form>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Examples</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  <strong>Credit Card Fee:</strong>
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Type: Percentage, Value: 3%
                </Text>
                <Text variant="bodySm">
                  <strong>Handling Fee:</strong>
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Type: Fixed Amount, Value: $5.00
                </Text>
                <Text variant="bodySm">
                  <strong>Rush Order Fee:</strong>
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Type: Fixed Amount, Value: $25.00
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Best Practices</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  • Clearly describe the fee purpose
                </Text>
                <Text variant="bodySm">
                  • Use reasonable fee amounts
                </Text>
                <Text variant="bodySm">
                  • Communicate fees before checkout
                </Text>
                <Text variant="bodySm">
                  • Comply with local regulations
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
