// Quick Order Form for Wholesale
import { json } from "@remix-run/node";
import { useActionData, useNavigate, useSubmit, useLoaderData } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  BlockStack,
  InlineStack,
  Banner,
  Text,
  DataTable,
  Select,
  Box
} from "@shopify/polaris";
import { DeleteMinor, PlusMinor } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { ShopifyAPIService } from "../services/shopify-api.server";
import { PricingEngine } from "../services/pricing-engine.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return json({ shop: session.shop });
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const formData = await request.formData();
  const actionType = formData.get('actionType');

  try {
    if (actionType === 'create_order') {
      const customerId = parseInt(formData.get('customerId'));
      const items = JSON.parse(formData.get('items'));

      // Get customer for tags
      const customer = await ShopifyAPIService.getCustomer(admin, customerId);

      // Calculate pricing for each item
      const lineItems = await Promise.all(items.map(async (item) => {
        const pricing = await PricingEngine.calculatePrice({
          shopDomain,
          retailPrice: parseFloat(item.price),
          productId: parseInt(item.product_id),
          variantId: parseInt(item.variant_id),
          customerTags: customer.tags,
          quantity: parseInt(item.quantity)
        });

        return {
          variant_id: parseInt(item.variant_id),
          quantity: parseInt(item.quantity),
          price: pricing.finalPrice,
          discount: pricing.discount,
          discount_percentage: pricing.discountPercentage,
          discount_title: 'Wholesale Discount'
        };
      }));

      // Create draft order
      const draftOrder = await ShopifyAPIService.createDraftOrder(admin, {
        customerId,
        lineItems,
        note: 'Created via Quick Order Form',
        tags: ['wholesale', 'quick-order']
      });

      return json({
        success: true,
        message: `Draft order ${draftOrder.name} created successfully!`,
        draftOrder
      });
    }

    return json({ error: 'Unknown action type' }, { status: 400 });
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function QuickOrder() {
  const { shop } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [customerId, setCustomerId] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [orderLines, setOrderLines] = useState([
    { sku: '', variant_id: '', product_id: '', quantity: '', price: '' }
  ]);

  const addLine = useCallback(() => {
    setOrderLines([
      ...orderLines,
      { sku: '', variant_id: '', product_id: '', quantity: '', price: '' }
    ]);
  }, [orderLines]);

  const removeLine = useCallback((index) => {
    setOrderLines(orderLines.filter((_, i) => i !== index));
  }, [orderLines]);

  const updateLine = useCallback((index, field, value) => {
    const newLines = [...orderLines];
    newLines[index] = { ...newLines[index], [field]: value };
    setOrderLines(newLines);
  }, [orderLines]);

  const handleSubmit = () => {
    if (!customerId || orderLines.length === 0) {
      return;
    }

    // Validate all lines have required fields
    const validLines = orderLines.filter(line =>
      line.variant_id && line.quantity && line.price
    );

    if (validLines.length === 0) {
      return;
    }

    const formData = new FormData();
    formData.append('actionType', 'create_order');
    formData.append('customerId', customerId);
    formData.append('items', JSON.stringify(validLines));

    submit(formData, { method: 'post' });
  };

  return (
    <Page
      title="Quick Order Form"
      subtitle="Create wholesale orders using SKU or product IDs"
      backAction={{ onAction: () => navigate('/app/wholesale') }}
      primaryAction={{
        content: 'Create Draft Order',
        onAction: handleSubmit,
        disabled: !customerId || orderLines.length === 0
      }}
    >
      <Layout>
        <Layout.Section>
          {actionData?.success && (
            <Banner status="success">
              <p>{actionData.message}</p>
              {actionData.draftOrder && (
                <p>
                  <a href={actionData.draftOrder.invoice_url} target="_blank" rel="noopener noreferrer">
                    View Draft Order Invoice
                  </a>
                </p>
              )}
            </Banner>
          )}

          {actionData?.error && (
            <Banner status="critical">
              <p>{actionData.error}</p>
            </Banner>
          )}

          {/* Customer Selection */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Customer</Text>
              <FormLayout>
                <TextField
                  label="Customer ID"
                  type="number"
                  value={customerId}
                  onChange={setCustomerId}
                  placeholder="123456789"
                  autoComplete="off"
                  helpText="Shopify customer ID"
                />

                <TextField
                  label="Customer Email (for reference)"
                  type="email"
                  value={customerEmail}
                  onChange={setCustomerEmail}
                  placeholder="customer@example.com"
                  autoComplete="off"
                />
              </FormLayout>
            </BlockStack>
          </Card>

          {/* Order Lines */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">Order Lines</Text>
                <Button onClick={addLine} icon={PlusMinor}>
                  Add Line
                </Button>
              </InlineStack>

              <BlockStack gap="300">
                {orderLines.map((line, index) => (
                  <Box
                    key={index}
                    padding="400"
                    background="bg-surface-secondary"
                    borderRadius="200"
                  >
                    <BlockStack gap="300">
                      <InlineStack align="space-between">
                        <Text variant="headingSm" as="h3">Line {index + 1}</Text>
                        {orderLines.length > 1 && (
                          <Button
                            icon={DeleteMinor}
                            onClick={() => removeLine(index)}
                            destructive
                            plain
                          />
                        )}
                      </InlineStack>

                      <InlineStack gap="200">
                        <Box minWidth="20%">
                          <TextField
                            label="SKU"
                            value={line.sku}
                            onChange={(value) => updateLine(index, 'sku', value)}
                            placeholder="PROD-001"
                            autoComplete="off"
                          />
                        </Box>

                        <Box minWidth="20%">
                          <TextField
                            label="Variant ID"
                            type="number"
                            value={line.variant_id}
                            onChange={(value) => updateLine(index, 'variant_id', value)}
                            placeholder="987654321"
                            autoComplete="off"
                          />
                        </Box>

                        <Box minWidth="20%">
                          <TextField
                            label="Product ID"
                            type="number"
                            value={line.product_id}
                            onChange={(value) => updateLine(index, 'product_id', value)}
                            placeholder="123456789"
                            autoComplete="off"
                          />
                        </Box>

                        <Box minWidth="15%">
                          <TextField
                            label="Quantity"
                            type="number"
                            value={line.quantity}
                            onChange={(value) => updateLine(index, 'quantity', value)}
                            placeholder="1"
                            autoComplete="off"
                          />
                        </Box>

                        <Box minWidth="20%">
                          <TextField
                            label="Price"
                            type="number"
                            value={line.price}
                            onChange={(value) => updateLine(index, 'price', value)}
                            placeholder="29.99"
                            prefix="$"
                            autoComplete="off"
                          />
                        </Box>
                      </InlineStack>
                    </BlockStack>
                  </Box>
                ))}
              </BlockStack>

              <Text variant="bodySm" tone="subdued">
                Wholesale pricing will be applied automatically based on customer tags
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">How It Works</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">1. Enter customer ID</Text>
                <Text variant="bodySm">2. Add product lines with variant IDs</Text>
                <Text variant="bodySm">3. System applies wholesale pricing</Text>
                <Text variant="bodySm">4. Draft order created in Shopify</Text>
                <Text variant="bodySm">5. Send invoice link to customer</Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Tips</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">• Use for phone/email orders</Text>
                <Text variant="bodySm">• Variant ID is required</Text>
                <Text variant="bodySm">• Pricing auto-calculates</Text>
                <Text variant="bodySm">• Draft orders need payment</Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
