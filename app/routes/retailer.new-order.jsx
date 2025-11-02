// Retailer Order Placement - Create New Wholesale Order
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigate, useSubmit } from "@remix-run/react";
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
  Box,
  Badge
} from "@shopify/polaris";
import { DeleteMinor } from "@shopify/polaris-icons";
import { RetailerAuth } from "../services/retailer-auth.server";
import { PricingEngine } from "../services/pricing-engine.server";
import { ShopifyAPIService } from "../services/shopify-api.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { customer, session } = await RetailerAuth.requireRetailer(request);
  const shopDomain = session.get("shopDomain");

  // Get retailer data
  const retailerData = await RetailerAuth.getRetailerData(customer.id, shopDomain);

  return json({
    retailer: retailerData,
    shopDomain
  });
};

export const action = async ({ request }) => {
  const { customer, session } = await RetailerAuth.requireRetailer(request);
  const shopDomain = session.get("shopDomain");

  const formData = await request.formData();
  const actionType = formData.get('actionType');

  try {
    if (actionType === 'calculate_price') {
      // Calculate wholesale price for a product
      const productId = formData.get('productId');
      const variantId = formData.get('variantId');
      const retailPrice = parseFloat(formData.get('retailPrice'));
      const quantity = parseInt(formData.get('quantity'));
      const customerTags = JSON.parse(formData.get('customerTags') || '[]');

      const pricing = await PricingEngine.calculatePrice({
        shopDomain,
        retailPrice,
        productId: parseInt(productId),
        variantId: parseInt(variantId),
        customerTags,
        quantity,
        collectionIds: []
      });

      return json({ pricing });
    }

    if (actionType === 'create_order') {
      // Create draft order via Shopify API
      const lineItemsJson = formData.get('lineItems');
      const lineItems = JSON.parse(lineItemsJson);
      const notes = formData.get('notes');

      // Get admin API access
      const { admin } = await authenticate.admin(request);

      // Create draft order
      const draftOrder = await ShopifyAPIService.createDraftOrder(admin, {
        customerId: customer.shopify_customer_id,
        lineItems,
        note: notes || 'Retailer portal order',
        tags: ['wholesale', 'retailer-portal']
      });

      return json({
        success: true,
        message: 'Order created successfully!',
        draftOrder
      });
    }

    return json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function RetailerNewOrder() {
  const { retailer, shopDomain } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const submit = useSubmit();

  const customerTags = JSON.parse(retailer.customer_tags || '[]');

  const [lineItems, setLineItems] = useState([
    { sku: '', quantity: '', retailPrice: '', wholesalePrice: '', productId: '', variantId: '' }
  ]);
  const [notes, setNotes] = useState('');
  const [calculating, setCalculating] = useState(false);

  const addLineItem = useCallback(() => {
    setLineItems([...lineItems, { sku: '', quantity: '', retailPrice: '', wholesalePrice: '', productId: '', variantId: '' }]);
  }, [lineItems]);

  const removeLineItem = useCallback((index) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  }, [lineItems]);

  const updateLineItem = useCallback((index, field, value) => {
    const newItems = [...lineItems];
    newItems[index][field] = value;
    setLineItems(newItems);
  }, [lineItems]);

  const calculatePrice = async (index) => {
    const item = lineItems[index];
    if (!item.productId || !item.variantId || !item.retailPrice || !item.quantity) {
      return;
    }

    setCalculating(true);

    const formData = new FormData();
    formData.append('actionType', 'calculate_price');
    formData.append('productId', item.productId);
    formData.append('variantId', item.variantId);
    formData.append('retailPrice', item.retailPrice);
    formData.append('quantity', item.quantity);
    formData.append('customerTags', JSON.stringify(customerTags));

    try {
      const response = await fetch(window.location.pathname, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (data.pricing) {
        updateLineItem(index, 'wholesalePrice', data.pricing.finalPrice.toFixed(2));
      }
    } catch (error) {
      console.error('Price calculation failed:', error);
    } finally {
      setCalculating(false);
    }
  };

  const handleCreateOrder = () => {
    const validItems = lineItems.filter(item =>
      item.variantId && item.quantity && item.wholesalePrice
    );

    if (validItems.length === 0) {
      alert('Please add at least one valid line item');
      return;
    }

    const formattedItems = validItems.map(item => ({
      variant_id: parseInt(item.variantId),
      quantity: parseInt(item.quantity),
      applied_discount: {
        value_type: 'fixed_amount',
        value: (parseFloat(item.retailPrice) - parseFloat(item.wholesalePrice)) * parseInt(item.quantity),
        description: 'Wholesale Pricing'
      }
    }));

    const formData = new FormData();
    formData.append('actionType', 'create_order');
    formData.append('lineItems', JSON.stringify(formattedItems));
    formData.append('notes', notes);

    submit(formData, { method: 'post' });
  };

  const subtotal = lineItems.reduce((sum, item) => {
    const price = parseFloat(item.wholesalePrice || 0);
    const qty = parseInt(item.quantity || 0);
    return sum + (price * qty);
  }, 0);

  const rows = lineItems.map((item, index) => [
    <TextField
      key={`sku-${index}`}
      value={item.sku}
      onChange={(value) => updateLineItem(index, 'sku', value)}
      placeholder="SKU / Product ID"
      autoComplete="off"
    />,
    <TextField
      key={`product-${index}`}
      value={item.productId}
      onChange={(value) => updateLineItem(index, 'productId', value)}
      placeholder="Product ID"
      type="number"
      autoComplete="off"
    />,
    <TextField
      key={`variant-${index}`}
      value={item.variantId}
      onChange={(value) => updateLineItem(index, 'variantId', value)}
      placeholder="Variant ID"
      type="number"
      autoComplete="off"
    />,
    <TextField
      key={`retail-${index}`}
      value={item.retailPrice}
      onChange={(value) => updateLineItem(index, 'retailPrice', value)}
      placeholder="0.00"
      type="number"
      prefix="$"
      autoComplete="off"
    />,
    <TextField
      key={`qty-${index}`}
      value={item.quantity}
      onChange={(value) => updateLineItem(index, 'quantity', value)}
      placeholder="1"
      type="number"
      autoComplete="off"
    />,
    <InlineStack gap="200" key={`price-${index}`} blockAlign="center">
      <Text variant="bodyMd" fontWeight="bold">
        ${item.wholesalePrice || '0.00'}
      </Text>
      <Button
        size="slim"
        onClick={() => calculatePrice(index)}
        disabled={calculating}
      >
        Calculate
      </Button>
    </InlineStack>,
    <Text key={`total-${index}`} variant="bodyMd">
      ${((parseFloat(item.wholesalePrice || 0) * parseInt(item.quantity || 0))).toFixed(2)}
    </Text>,
    <Button
      key={`delete-${index}`}
      icon={DeleteMinor}
      size="slim"
      onClick={() => removeLineItem(index)}
      accessibilityLabel="Remove line item"
    />
  ]);

  return (
    <Page
      title="Create New Order"
      subtitle="Place a wholesale order with your pricing"
      backAction={{ onAction: () => navigate('/retailer') }}
      primaryAction={{
        content: 'Create Order',
        onAction: handleCreateOrder,
        disabled: lineItems.every(item => !item.wholesalePrice)
      }}
    >
      <Layout>
        <Layout.Section>
          {actionData?.success && (
            <Banner status="success" onDismiss={() => {}}>
              <BlockStack gap="200">
                <p>{actionData.message}</p>
                {actionData.draftOrder && (
                  <Text variant="bodySm">
                    Draft Order ID: {actionData.draftOrder.id}
                  </Text>
                )}
              </BlockStack>
            </Banner>
          )}

          {actionData?.error && (
            <Banner status="critical">
              <p>{actionData.error}</p>
            </Banner>
          )}

          {/* Order Line Items */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Order Items</Text>

              <DataTable
                columnContentTypes={['text', 'text', 'text', 'numeric', 'numeric', 'numeric', 'numeric', 'text']}
                headings={[
                  'SKU',
                  'Product ID',
                  'Variant ID',
                  'Retail Price',
                  'Quantity',
                  'Your Price',
                  'Line Total',
                  ''
                ]}
                rows={rows}
              />

              <InlineStack gap="200">
                <Button onClick={addLineItem}>Add Line Item</Button>
                <Text variant="bodySm" tone="subdued">
                  Add products to your order. Calculate pricing will apply your wholesale discounts.
                </Text>
              </InlineStack>
            </BlockStack>
          </Card>

          {/* Order Summary */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Order Summary</Text>

              <Box>
                <InlineStack align="space-between">
                  <Text variant="bodyLg">Subtotal:</Text>
                  <Text variant="headingLg" as="p">${subtotal.toFixed(2)}</Text>
                </InlineStack>
              </Box>

              <FormLayout>
                <TextField
                  label="Order Notes"
                  value={notes}
                  onChange={setNotes}
                  multiline={3}
                  placeholder="Add any special instructions or notes..."
                  autoComplete="off"
                />
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Your Account</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  <strong>Email:</strong> {retailer.email}
                </Text>
                <Text variant="bodySm">
                  <strong>Account Type:</strong>
                </Text>
                <InlineStack gap="100">
                  {customerTags.map(tag => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>

          {retailer.netTerms && (
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">Payment Terms</Text>
                <Text variant="bodySm">
                  Net {retailer.netTerms.net_days} days
                </Text>
                <Text variant="bodySm">
                  Available Credit: ${parseFloat(retailer.netTerms.available_credit).toFixed(2)}
                </Text>
              </BlockStack>
            </Card>
          )}

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">How to Order</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  1. Enter product and variant IDs
                </Text>
                <Text variant="bodySm">
                  2. Enter retail price and quantity
                </Text>
                <Text variant="bodySm">
                  3. Click "Calculate" to get your wholesale price
                </Text>
                <Text variant="bodySm">
                  4. Review and click "Create Order"
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Need Help?</Text>
              <Text variant="bodySm">
                Contact the store for product IDs and availability.
              </Text>
              <Button fullWidth onClick={() => navigate('/retailer/catalog')}>
                Browse Catalog
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
