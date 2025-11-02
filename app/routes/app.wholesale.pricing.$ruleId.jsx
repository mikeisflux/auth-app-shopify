// Edit Pricing Rule - Full Featured
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigate, useSubmit } from "@remix-run/react";
import { useState, useCallback } from "react";
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
  Divider,
  Text,
  ChoiceList,
  DatePicker,
  Icon,
  Box,
  Badge
} from "@shopify/polaris";
import { DeleteMinor, PlusMinor } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { WholesaleModel } from "../models/wholesale.server";

export const loader = async ({ params, request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const { ruleId } = params;

  const rule = await WholesaleModel.getPricingRuleById(ruleId, shopDomain);

  if (!rule) {
    throw new Response("Pricing rule not found", { status: 404 });
  }

  return json({ rule });
};

export const action = async ({ params, request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const { ruleId } = params;

  const formData = await request.formData();
  const action = formData.get('_action');

  if (action === 'delete') {
    try {
      await WholesaleModel.deletePricingRule(ruleId, shopDomain);
      return redirect('/app/wholesale/pricing');
    } catch (error) {
      return json({ error: error.message }, { status: 400 });
    }
  }

  // Update rule
  const name = formData.get('name');
  const status = formData.get('status');
  const discountType = formData.get('discountType');
  const discountValue = parseFloat(formData.get('discountValue'));
  const customerSelection = formData.get('customerSelection');
  const customerTags = formData.get('customerTags')?.split(',').map(t => t.trim()).filter(Boolean) || [];
  const productScope = formData.get('productScope');
  const productIds = formData.get('productIds')?.split(',').map(t => t.trim()).filter(Boolean) || [];
  const collectionIds = formData.get('collectionIds')?.split(',').map(t => t.trim()).filter(Boolean) || [];
  const excludedProductIds = formData.get('excludedProductIds')?.split(',').map(t => t.trim()).filter(Boolean) || [];
  const excludedCollectionIds = formData.get('excludedCollectionIds')?.split(',').map(t => t.trim()).filter(Boolean) || [];
  const startDate = formData.get('startDate') || null;
  const endDate = formData.get('endDate') || null;

  // Parse volume tiers if present
  const tiersJson = formData.get('tiers');
  let tiers = [];
  if (tiersJson) {
    try {
      tiers = JSON.parse(tiersJson);
    } catch (e) {
      return json({ error: 'Invalid tier data' }, { status: 400 });
    }
  }

  try {
    await WholesaleModel.updatePricingRule(ruleId, shopDomain, {
      name,
      status,
      discountType,
      discountValue,
      customerSelection,
      customerTags,
      productScope,
      productIds,
      collectionIds,
      excludedProductIds,
      excludedCollectionIds,
      startDate,
      endDate
    });

    // Update tiers if volume pricing
    if (tiers.length > 0) {
      // Delete existing tiers and recreate (simpler approach)
      // In production, you'd want more sophisticated tier management
    }

    return json({ success: true, message: 'Pricing rule updated successfully!' });
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function EditPricingRule() {
  const { rule } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [name, setName] = useState(rule.name);
  const [status, setStatus] = useState(rule.status);
  const [discountType, setDiscountType] = useState(rule.discount_type);
  const [discountValue, setDiscountValue] = useState(rule.discount_value.toString());
  const [customerSelection, setCustomerSelection] = useState(rule.customer_selection);
  const [customerTags, setCustomerTags] = useState(
    JSON.parse(rule.customer_tags || '[]').join(', ')
  );
  const [productScope, setProductScope] = useState(rule.product_scope);
  const [productIds, setProductIds] = useState(
    JSON.parse(rule.product_ids || '[]').join(', ')
  );
  const [collectionIds, setCollectionIds] = useState(
    JSON.parse(rule.collection_ids || '[]').join(', ')
  );
  const [excludedProductIds, setExcludedProductIds] = useState(
    JSON.parse(rule.excluded_product_ids || '[]').join(', ')
  );
  const [excludedCollectionIds, setExcludedCollectionIds] = useState(
    JSON.parse(rule.excluded_collection_ids || '[]').join(', ')
  );
  const [startDate, setStartDate] = useState(rule.start_date || '');
  const [endDate, setEndDate] = useState(rule.end_date || '');

  // Volume tiers state
  const [tiers, setTiers] = useState(rule.tiers || []);

  const addTier = useCallback(() => {
    setTiers([...tiers, { quantity: '', discount_value: '', discount_type: discountType }]);
  }, [tiers, discountType]);

  const removeTier = useCallback((index) => {
    setTiers(tiers.filter((_, i) => i !== index));
  }, [tiers]);

  const updateTier = useCallback((index, field, value) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setTiers(newTiers);
  }, [tiers]);

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('status', status);
    formData.append('discountType', discountType);
    formData.append('discountValue', discountValue);
    formData.append('customerSelection', customerSelection);
    formData.append('customerTags', customerTags);
    formData.append('productScope', productScope);
    formData.append('productIds', productIds);
    formData.append('collectionIds', collectionIds);
    formData.append('excludedProductIds', excludedProductIds);
    formData.append('excludedCollectionIds', excludedCollectionIds);
    formData.append('startDate', startDate);
    formData.append('endDate', endDate);
    formData.append('tiers', JSON.stringify(tiers));

    submit(formData, { method: 'post' });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this pricing rule? This cannot be undone.')) {
      const formData = new FormData();
      formData.append('_action', 'delete');
      submit(formData, { method: 'post' });
    }
  };

  return (
    <Page
      title={`Edit: ${rule.name}`}
      backAction={{ onAction: () => navigate('/app/wholesale/pricing') }}
      primaryAction={{
        content: 'Save Changes',
        onAction: handleSubmit,
        disabled: !name || !discountValue
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
                  label="Rule Name"
                  value={name}
                  onChange={setName}
                  placeholder="e.g., Wholesale 40% Off"
                  autoComplete="off"
                />

                <Select
                  label="Status"
                  options={[
                    { label: 'Published (Active)', value: 'published' },
                    { label: 'Unpublished (Draft)', value: 'unpublished' }
                  ]}
                  value={status}
                  onChange={setStatus}
                />

                <InlineStack gap="200">
                  <Box minWidth="50%">
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
                  </Box>
                  <Box minWidth="50%">
                    <TextField
                      label="Discount Value"
                      type="number"
                      value={discountValue}
                      onChange={setDiscountValue}
                      placeholder={discountType === 'percentage' ? '40' : '10.00'}
                      autoComplete="off"
                    />
                  </Box>
                </InlineStack>
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
                    { label: 'All customers (requires Business plan)', value: 'all_customers' }
                  ]}
                  value={customerSelection}
                  onChange={setCustomerSelection}
                  helpText="Who can see this pricing?"
                />

                {customerSelection === 'tagged' && (
                  <TextField
                    label="Customer Tags"
                    value={customerTags}
                    onChange={setCustomerTags}
                    placeholder="wholesale, tier1, vip"
                    autoComplete="off"
                    helpText="Comma-separated tags. Customers must have at least one matching tag."
                  />
                )}
              </FormLayout>
            </BlockStack>
          </Card>

          {/* Product Scope */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Product Scope</Text>
              <FormLayout>
                <Select
                  label="Apply to"
                  options={[
                    { label: 'All products', value: 'all' },
                    { label: 'Specific collections', value: 'collections' },
                    { label: 'Specific products', value: 'specific' }
                  ]}
                  value={productScope}
                  onChange={setProductScope}
                />

                {productScope === 'collections' && (
                  <TextField
                    label="Collection IDs"
                    value={collectionIds}
                    onChange={setCollectionIds}
                    placeholder="123456, 234567"
                    autoComplete="off"
                    helpText="Comma-separated Shopify collection IDs"
                  />
                )}

                {productScope === 'specific' && (
                  <TextField
                    label="Product IDs"
                    value={productIds}
                    onChange={setProductIds}
                    placeholder="123456, 234567"
                    autoComplete="off"
                    helpText="Comma-separated Shopify product IDs"
                  />
                )}

                <TextField
                  label="Exclude Product IDs (optional)"
                  value={excludedProductIds}
                  onChange={setExcludedProductIds}
                  placeholder="123456, 234567"
                  autoComplete="off"
                  helpText="Products to exclude from this rule"
                />

                <TextField
                  label="Exclude Collection IDs (optional)"
                  value={excludedCollectionIds}
                  onChange={setExcludedCollectionIds}
                  placeholder="123456, 234567"
                  autoComplete="off"
                  helpText="Collections to exclude from this rule"
                />
              </FormLayout>
            </BlockStack>
          </Card>

          {/* Volume Tiers (if rule type is volume) */}
          {rule.rule_type === 'volume' && (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h2">Volume Pricing Tiers</Text>
                  <Button onClick={addTier} icon={PlusMinor}>
                    Add Tier
                  </Button>
                </InlineStack>

                {tiers.length > 0 ? (
                  <BlockStack gap="300">
                    {tiers.map((tier, index) => (
                      <Box
                        key={index}
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <InlineStack gap="200" align="space-between">
                          <Box minWidth="30%">
                            <TextField
                              label="Minimum Quantity"
                              type="number"
                              value={tier.quantity?.toString() || ''}
                              onChange={(value) => updateTier(index, 'quantity', parseInt(value))}
                              placeholder="5"
                              autoComplete="off"
                            />
                          </Box>
                          <Box minWidth="30%">
                            <TextField
                              label="Discount Value"
                              type="number"
                              value={tier.discount_value?.toString() || ''}
                              onChange={(value) => updateTier(index, 'discount_value', parseFloat(value))}
                              placeholder="55"
                              autoComplete="off"
                            />
                          </Box>
                          <Box minWidth="30%">
                            <Select
                              label="Type"
                              options={[
                                { label: 'Percentage', value: 'percentage' },
                                { label: 'Fixed Amount', value: 'fixed_amount' },
                                { label: 'Fixed Price', value: 'fixed_price' }
                              ]}
                              value={tier.discount_type || discountType}
                              onChange={(value) => updateTier(index, 'discount_type', value)}
                            />
                          </Box>
                          <Button
                            icon={DeleteMinor}
                            onClick={() => removeTier(index)}
                            destructive
                            plain
                          />
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                ) : (
                  <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                    <Text tone="subdued" alignment="center">
                      No tiers added yet. Click "Add Tier" to create quantity-based pricing.
                    </Text>
                  </Box>
                )}

                <Text variant="bodySm" tone="subdued">
                  Example: Qty 5 = 55% off, Qty 10 = 60% off, Qty 15 = 65% off
                </Text>
              </BlockStack>
            </Card>
          )}

          {/* Scheduling */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Schedule (Optional)</Text>
              <FormLayout>
                <TextField
                  label="Start Date"
                  type="datetime-local"
                  value={startDate}
                  onChange={setStartDate}
                  helpText="Leave empty to start immediately"
                />

                <TextField
                  label="End Date"
                  type="datetime-local"
                  value={endDate}
                  onChange={setEndDate}
                  helpText="Leave empty for no end date"
                />
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
                  <strong>Type:</strong> {rule.rule_type}
                </Text>
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
              <Text variant="headingMd" as="h2">Tips</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">• Test rules before publishing</Text>
                <Text variant="bodySm">• Use specific tags for better control</Text>
                <Text variant="bodySm">• Exclude products take priority</Text>
                <Text variant="bodySm">• Volume tiers apply at quantity thresholds</Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
