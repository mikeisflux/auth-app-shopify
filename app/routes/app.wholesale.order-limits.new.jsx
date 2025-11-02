// Create Order Limit with Conditions Builder
import { json, redirect } from "@remix-run/node";
import { useActionData, useNavigate, useSubmit } from "@remix-run/react";
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
  Text,
  Box,
  ChoiceList
} from "@shopify/polaris";
import { DeleteMinor, PlusMinor } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { WholesaleModel } from "../models/wholesale.server";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const formData = await request.formData();
  const name = formData.get('name');
  const status = formData.get('status');
  const scope = formData.get('scope');
  const conditionLogic = formData.get('conditionLogic');
  const failureAction = formData.get('failureAction');
  const customerMessage = formData.get('customerMessage');
  const customerTags = formData.get('customerTags')?.split(',').map(t => t.trim()).filter(Boolean) || [];

  const conditionsJson = formData.get('conditions');
  let conditions = [];
  if (conditionsJson) {
    try {
      conditions = JSON.parse(conditionsJson);
    } catch (e) {
      return json({ error: 'Invalid conditions data' }, { status: 400 });
    }
  }

  try {
    const limit = await WholesaleModel.createOrderLimit(shopDomain, {
      name,
      status,
      scope,
      conditionLogic,
      failureAction,
      customerMessage,
      customerTags,
      conditions
    });

    return redirect('/app/wholesale/order-limits');
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function NewOrderLimit() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const actionData = useActionData();

  const [name, setName] = useState('');
  const [status, setStatus] = useState('active');
  const [scope, setScope] = useState('all_orders');
  const [conditionLogic, setConditionLogic] = useState('all');
  const [failureAction, setFailureAction] = useState('block');
  const [customerMessage, setCustomerMessage] = useState('');
  const [customerTags, setCustomerTags] = useState('');

  // Conditions state
  const [conditions, setConditions] = useState([
    { field: 'cart_total_amount', operator: 'is_minimum', value: '100', value_max: '' }
  ]);

  const addCondition = useCallback(() => {
    setConditions([
      ...conditions,
      { field: 'cart_total_amount', operator: 'is_minimum', value: '', value_max: '' }
    ]);
  }, [conditions]);

  const removeCondition = useCallback((index) => {
    setConditions(conditions.filter((_, i) => i !== index));
  }, [conditions]);

  const updateCondition = useCallback((index, field, value) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], [field]: value };
    setConditions(newConditions);
  }, [conditions]);

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('status', status);
    formData.append('scope', scope);
    formData.append('conditionLogic', conditionLogic);
    formData.append('failureAction', failureAction);
    formData.append('customerMessage', customerMessage);
    formData.append('customerTags', customerTags);
    formData.append('conditions', JSON.stringify(conditions));

    submit(formData, { method: 'post' });
  };

  return (
    <Page
      title="Create Order Limit"
      backAction={{ onAction: () => navigate('/app/wholesale/order-limits') }}
      primaryAction={{
        content: 'Save',
        onAction: handleSubmit,
        disabled: !name || conditions.length === 0
      }}
    >
      <Layout>
        <Layout.Section>
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
                  placeholder="e.g., Wholesale Minimum Order"
                  autoComplete="off"
                  helpText="Internal name for this limit"
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

                <Select
                  label="Order Limit Scope"
                  options={[
                    { label: 'All orders', value: 'all_orders' },
                    { label: 'First order only', value: 'first_only' },
                    { label: 'Separate first/subsequent', value: 'separate_first' }
                  ]}
                  value={scope}
                  onChange={setScope}
                  helpText="When should this limit apply?"
                />

                <TextField
                  label="Customer Tags"
                  value={customerTags}
                  onChange={setCustomerTags}
                  placeholder="wholesale, tier1"
                  autoComplete="off"
                  helpText="Comma-separated tags. Leave empty for all customers."
                />
              </FormLayout>
            </BlockStack>
          </Card>

          {/* Conditions Builder */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">Order Conditions</Text>
                <Button onClick={addCondition} icon={PlusMinor}>
                  Add Condition
                </Button>
              </InlineStack>

              <Select
                label="Conditions Logic"
                options={[
                  { label: 'Must match ALL conditions (AND)', value: 'all' },
                  { label: 'Must match ANY condition (OR)', value: 'any' }
                ]}
                value={conditionLogic}
                onChange={setConditionLogic}
              />

              <BlockStack gap="300">
                {conditions.map((condition, index) => (
                  <Box
                    key={index}
                    padding="400"
                    background="bg-surface-secondary"
                    borderRadius="200"
                  >
                    <BlockStack gap="300">
                      <InlineStack align="space-between">
                        <Text variant="headingSm" as="h3">Condition {index + 1}</Text>
                        {conditions.length > 1 && (
                          <Button
                            icon={DeleteMinor}
                            onClick={() => removeCondition(index)}
                            destructive
                            plain
                          />
                        )}
                      </InlineStack>

                      <InlineStack gap="200">
                        <Box minWidth="33%">
                          <Select
                            label="Field"
                            options={[
                              { label: 'Cart Total Amount', value: 'cart_total_amount' },
                              { label: 'Cart Total Items', value: 'cart_total_items' },
                              { label: 'Cart Total Weight', value: 'cart_total_weight' }
                            ]}
                            value={condition.field}
                            onChange={(value) => updateCondition(index, 'field', value)}
                          />
                        </Box>

                        <Box minWidth="33%">
                          <Select
                            label="Operator"
                            options={[
                              { label: 'Is Minimum', value: 'is_minimum' },
                              { label: 'Is Maximum', value: 'is_maximum' },
                              { label: 'Equals', value: 'equals' },
                              { label: 'Between', value: 'between' }
                            ]}
                            value={condition.operator}
                            onChange={(value) => updateCondition(index, 'operator', value)}
                          />
                        </Box>

                        <Box minWidth="33%">
                          <TextField
                            label="Value"
                            type="number"
                            value={condition.value}
                            onChange={(value) => updateCondition(index, 'value', value)}
                            placeholder={
                              condition.field === 'cart_total_amount' ? '100.00' :
                              condition.field === 'cart_total_items' ? '10' :
                              '5.00'
                            }
                            autoComplete="off"
                          />
                        </Box>
                      </InlineStack>

                      {condition.operator === 'between' && (
                        <TextField
                          label="Maximum Value"
                          type="number"
                          value={condition.value_max}
                          onChange={(value) => updateCondition(index, 'value_max', value)}
                          placeholder="200.00"
                          autoComplete="off"
                        />
                      )}
                    </BlockStack>
                  </Box>
                ))}
              </BlockStack>

              <Text variant="bodySm" tone="subdued">
                Example: "Cart total amount is minimum $100" means customers must spend at least $100
              </Text>
            </BlockStack>
          </Card>

          {/* Failure Action */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">When Conditions Not Met</Text>
              <FormLayout>
                <Select
                  label="Action"
                  options={[
                    { label: 'Block order (prevent checkout)', value: 'block' },
                    { label: 'Allow order at retail price', value: 'allow_retail' }
                  ]}
                  value={failureAction}
                  onChange={setFailureAction}
                  helpText="What happens if the customer doesn't meet the requirements?"
                />

                <TextField
                  label="Customer Message"
                  value={customerMessage}
                  onChange={setCustomerMessage}
                  placeholder="You must order at least $100 to receive wholesale pricing."
                  multiline={3}
                  autoComplete="off"
                  helpText="Message shown to customers who don't meet the requirements"
                />
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Order Limits Guide</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  <strong>All Orders:</strong> Apply to every order
                </Text>
                <Text variant="bodySm">
                  <strong>First Only:</strong> Apply only to first purchase
                </Text>
                <Text variant="bodySm">
                  <strong>Separate:</strong> Different limits for first vs. repeat
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Examples</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  • Minimum $100 cart for wholesale pricing
                </Text>
                <Text variant="bodySm">
                  • Minimum 10 items per order
                </Text>
                <Text variant="bodySm">
                  • First order minimum $250
                </Text>
                <Text variant="bodySm">
                  • Between 5-50 items per order
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
