// Edit Shipping Rule
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigate, useSubmit } from "@remix-run/react";
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
  InlineStack,
  Banner,
  Text
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { WholesaleModel } from "../models/wholesale.server";

export const loader = async ({ params, request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const { ruleId } = params;

  const rule = await WholesaleModel.getShippingRuleById(ruleId, shopDomain);

  if (!rule) {
    throw new Response("Shipping rule not found", { status: 404 });
  }

  return json({ rule });
};

export const action = async ({ params, request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const { ruleId } = params;

  const formData = await request.formData();
  const action = formData.get('_action');

  try {
    if (action === 'delete') {
      await WholesaleModel.deleteShippingRule(ruleId, shopDomain);
      return redirect('/app/wholesale/shipping');
    }

    const title = formData.get('title');
    const message = formData.get('message');
    const status = formData.get('status');
    const customerSelection = formData.get('customerSelection');
    const customerTags = formData.get('customerTags')?.split(',').map(t => t.trim()).filter(Boolean) || [];
    const geographicScope = formData.get('geographicScope');
    const countryCodes = formData.get('countryCodes')?.split(',').map(t => t.trim()).filter(Boolean) || [];
    const rateType = formData.get('rateType');
    const rateCalculationBasis = formData.get('rateCalculationBasis');
    const shippingCharge = parseFloat(formData.get('shippingCharge'));
    const minimumThreshold = parseFloat(formData.get('minimumThreshold'));
    const maximumThreshold = formData.get('maximumThreshold') ? parseFloat(formData.get('maximumThreshold')) : null;

    await WholesaleModel.updateShippingRule(ruleId, shopDomain, {
      title,
      message,
      status,
      customerSelection,
      customerTags,
      geographicScope,
      countryCodes,
      rateType,
      rateCalculationBasis,
      shippingCharge,
      minimumThreshold,
      maximumThreshold
    });

    return json({ success: true, message: 'Shipping rule updated successfully!' });
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function EditShippingRule() {
  const { rule } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [title, setTitle] = useState(rule.title);
  const [message, setMessage] = useState(rule.message || '');
  const [status, setStatus] = useState(rule.status);
  const [customerSelection, setCustomerSelection] = useState(rule.customer_selection);
  const [customerTags, setCustomerTags] = useState(
    JSON.parse(rule.customer_tags || '[]').join(', ')
  );
  const [geographicScope, setGeographicScope] = useState(rule.geographic_scope);
  const [countryCodes, setCountryCodes] = useState(
    JSON.parse(rule.country_codes || '[]').join(', ')
  );
  const [rateType, setRateType] = useState(rule.rate_type);
  const [rateCalculationBasis, setRateCalculationBasis] = useState(rule.rate_calculation_basis);
  const [shippingCharge, setShippingCharge] = useState(rule.shipping_charge.toString());
  const [minimumThreshold, setMinimumThreshold] = useState(rule.minimum_threshold.toString());
  const [maximumThreshold, setMaximumThreshold] = useState(
    rule.maximum_threshold ? rule.maximum_threshold.toString() : ''
  );

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('message', message);
    formData.append('status', status);
    formData.append('customerSelection', customerSelection);
    formData.append('customerTags', customerTags);
    formData.append('geographicScope', geographicScope);
    formData.append('countryCodes', countryCodes);
    formData.append('rateType', rateType);
    formData.append('rateCalculationBasis', rateCalculationBasis);
    formData.append('shippingCharge', shippingCharge);
    formData.append('minimumThreshold', minimumThreshold);
    formData.append('maximumThreshold', maximumThreshold);

    submit(formData, { method: 'post' });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this shipping rule?')) {
      const formData = new FormData();
      formData.append('_action', 'delete');
      submit(formData, { method: 'post' });
    }
  };

  return (
    <Page
      title={`Edit: ${rule.title}`}
      backAction={{ onAction: () => navigate('/app/wholesale/shipping') }}
      primaryAction={{
        content: 'Save Changes',
        onAction: handleSubmit,
        disabled: !title || shippingCharge === ''
      }}
      secondaryActions={[
        {
          content: 'Delete Rule',
          destructive: true,
          onAction: handleDelete
        }
      ]}
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

          {/* Basic Info */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Basic Information</Text>
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

                <TextField
                  label="Cart Message (optional)"
                  value={message}
                  onChange={setMessage}
                  placeholder="Free shipping for wholesale orders"
                  autoComplete="off"
                  helpText="Optional message displayed in cart (max 160 characters)"
                  maxLength={160}
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
            </BlockStack>
          </Card>

          {/* Customer Targeting */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Customer Targeting</Text>
              <FormLayout>
                <Select
                  label="Customer Selection"
                  options={[
                    { label: 'Logged-in customers with matching tags (Recommended)', value: 'tagged' },
                    { label: 'All logged-in customers', value: 'all_logged_in' },
                    { label: 'All customers', value: 'all_customers' }
                  ]}
                  value={customerSelection}
                  onChange={setCustomerSelection}
                />

                {customerSelection === 'tagged' && (
                  <TextField
                    label="Customer Tags"
                    value={customerTags}
                    onChange={setCustomerTags}
                    placeholder="wholesale, vip"
                    autoComplete="off"
                    helpText="Comma-separated tags"
                  />
                )}
              </FormLayout>
            </BlockStack>
          </Card>

          {/* Geographic Scope */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Geographic Scope</Text>
              <FormLayout>
                <Select
                  label="Apply to"
                  options={[
                    { label: 'All countries', value: 'all_countries' },
                    { label: 'Specific countries', value: 'specific_countries' }
                  ]}
                  value={geographicScope}
                  onChange={setGeographicScope}
                />

                {geographicScope === 'specific_countries' && (
                  <TextField
                    label="Country Codes"
                    value={countryCodes}
                    onChange={setCountryCodes}
                    placeholder="US, CA, GB"
                    autoComplete="off"
                    helpText="Comma-separated ISO country codes (e.g., US, CA, GB)"
                  />
                )}
              </FormLayout>
            </BlockStack>
          </Card>

          {/* Shipping Rates */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Shipping Rates</Text>
              <FormLayout>
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

                {rateType === 'conditional' && (
                  <>
                    <Select
                      label="Based On"
                      options={[
                        { label: 'Cart Total Amount', value: 'amount' },
                        { label: 'Cart Total Items', value: 'quantity' },
                        { label: 'Cart Total Weight', value: 'weight' }
                      ]}
                      value={rateCalculationBasis}
                      onChange={setRateCalculationBasis}
                    />

                    <InlineStack gap="200">
                      <TextField
                        label="Minimum Threshold"
                        type="number"
                        value={minimumThreshold}
                        onChange={setMinimumThreshold}
                        placeholder="0"
                        autoComplete="off"
                      />

                      <TextField
                        label="Maximum Threshold (optional)"
                        type="number"
                        value={maximumThreshold}
                        onChange={setMaximumThreshold}
                        placeholder="No limit"
                        autoComplete="off"
                      />
                    </InlineStack>
                  </>
                )}
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Rule Info</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  <strong>Created:</strong> {new Date(rule.created_at).toLocaleDateString()}
                </Text>
                <Text variant="bodySm">
                  <strong>Updated:</strong> {new Date(rule.updated_at).toLocaleDateString()}
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Examples</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  <strong>Free Shipping:</strong> Set charge to $0
                </Text>
                <Text variant="bodySm">
                  <strong>Flat $10:</strong> Charge $10 regardless of cart
                </Text>
                <Text variant="bodySm">
                  <strong>Conditional:</strong> Free over $100, $10 under
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
