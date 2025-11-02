// Individual Wholesale Pricing - Variant-Level Discount Management
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigate, useSubmit } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Button,
  BlockStack,
  InlineStack,
  TextField,
  Text,
  Badge,
  EmptyState,
  Thumbnail,
  Banner
} from "@shopify/polaris";
import { DeleteMinor, ImageMajor } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { query } from "../db/connection.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Get all individual variant pricing
  const result = await query(
    `SELECT ivp.*, s.shop_domain
     FROM individual_variant_pricing ivp
     INNER JOIN shops s ON ivp.shop_id = s.id
     WHERE s.shop_domain = $1
     ORDER BY ivp.created_at DESC`,
    [shopDomain]
  );

  return json({ variantPricing: result.rows || [] });
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const formData = await request.formData();
  const actionType = formData.get('actionType');

  try {
    if (actionType === 'add_variant') {
      const productId = formData.get('productId');
      const variantId = formData.get('variantId');
      const sku = formData.get('sku');
      const discountType = formData.get('discountType');
      const discountValue = parseFloat(formData.get('discountValue'));
      const customerTags = formData.get('customerTags');

      await query(
        `INSERT INTO individual_variant_pricing (
          shop_id, product_id, variant_id, sku, discount_type,
          discount_value, customer_tags
        )
        SELECT s.id, $2, $3, $4, $5, $6, $7
        FROM shops s
        WHERE s.shop_domain = $1
        ON CONFLICT (shop_id, variant_id) DO UPDATE
        SET discount_type = $5,
            discount_value = $6,
            customer_tags = $7,
            updated_at = CURRENT_TIMESTAMP`,
        [shopDomain, productId, variantId, sku, discountType, discountValue, customerTags]
      );

      return json({ success: true, message: 'Variant pricing added!' });
    }

    if (actionType === 'delete_variant') {
      const variantId = formData.get('variantId');

      await query(
        `DELETE FROM individual_variant_pricing ivp
         USING shops s
         WHERE ivp.shop_id = s.id
           AND s.shop_domain = $1
           AND ivp.variant_id = $2`,
        [shopDomain, variantId]
      );

      return json({ success: true, message: 'Variant pricing deleted!' });
    }

    if (actionType === 'copy_variant') {
      const sourceVariantId = formData.get('sourceVariantId');
      const targetVariantId = formData.get('targetVariantId');

      // Get source variant pricing
      const source = await query(
        `SELECT * FROM individual_variant_pricing ivp
         INNER JOIN shops s ON ivp.shop_id = s.id
         WHERE s.shop_domain = $1 AND ivp.variant_id = $2`,
        [shopDomain, sourceVariantId]
      );

      if (source.rows.length === 0) {
        return json({ error: 'Source variant not found' }, { status: 404 });
      }

      const sourceData = source.rows[0];

      // Copy to target variant
      await query(
        `INSERT INTO individual_variant_pricing (
          shop_id, product_id, variant_id, sku, discount_type,
          discount_value, customer_tags
        )
        SELECT s.id, $2, $3, $4, $5, $6, $7
        FROM shops s
        WHERE s.shop_domain = $1
        ON CONFLICT (shop_id, variant_id) DO UPDATE
        SET discount_type = $5,
            discount_value = $6,
            customer_tags = $7`,
        [shopDomain, sourceData.product_id, targetVariantId,
         formData.get('targetSku'), sourceData.discount_type,
         sourceData.discount_value, sourceData.customer_tags]
      );

      return json({ success: true, message: 'Settings copied to variant!' });
    }

    return json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function IndividualPricingIndex() {
  const { variantPricing } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [searchTerm, setSearchTerm] = useState('');
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [sku, setSku] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [customerTags, setCustomerTags] = useState('wholesale');

  const handleAddVariant = () => {
    if (!productId || !variantId || !discountValue) {
      alert('Please fill in all required fields');
      return;
    }

    const formData = new FormData();
    formData.append('actionType', 'add_variant');
    formData.append('productId', productId);
    formData.append('variantId', variantId);
    formData.append('sku', sku);
    formData.append('discountType', discountType);
    formData.append('discountValue', discountValue);
    formData.append('customerTags', customerTags);

    submit(formData, { method: 'post' });

    // Clear form
    setProductId('');
    setVariantId('');
    setSku('');
    setDiscountValue('');
  };

  const handleDelete = (variantId) => {
    if (!confirm('Delete this variant pricing?')) return;

    const formData = new FormData();
    formData.append('actionType', 'delete_variant');
    formData.append('variantId', variantId);
    submit(formData, { method: 'post' });
  };

  const filteredPricing = variantPricing.filter(item => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      item.sku?.toLowerCase().includes(search) ||
      item.product_id?.toString().includes(search) ||
      item.variant_id?.toString().includes(search)
    );
  });

  const rows = filteredPricing.map(item => [
    item.product_id || 'N/A',
    item.variant_id || 'N/A',
    item.sku || '-',
    <Badge key={item.id} tone="info">{item.customer_tags || 'All'}</Badge>,
    `${item.discount_value}${item.discount_type === 'percentage' ? '%' : item.discount_type === 'fixed_amount' ? ' off' : ' fixed'}`,
    item.discount_type,
    <Button
      key={item.id}
      size="slim"
      icon={DeleteMinor}
      onClick={() => handleDelete(item.variant_id)}
      destructive
    >
      Delete
    </Button>
  ]);

  return (
    <Page
      title="Individual Wholesale Pricing"
      subtitle="Set variant-level discounts for specific products"
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

          {/* Add New Variant Pricing */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Add Product Variant</Text>

              <InlineStack gap="300" wrap={false}>
                <TextField
                  label="Product ID"
                  value={productId}
                  onChange={setProductId}
                  placeholder="12345"
                  type="number"
                  autoComplete="off"
                />
                <TextField
                  label="Variant ID"
                  value={variantId}
                  onChange={setVariantId}
                  placeholder="67890"
                  type="number"
                  autoComplete="off"
                  requiredIndicator
                />
                <TextField
                  label="SKU (optional)"
                  value={sku}
                  onChange={setSku}
                  placeholder="COMIC-001"
                  autoComplete="off"
                />
              </InlineStack>

              <InlineStack gap="300" wrap={false}>
                <TextField
                  label="Discount Type"
                  value={discountType}
                  onChange={setDiscountType}
                  placeholder="percentage"
                  autoComplete="off"
                  helpText="percentage, fixed_amount, or fixed_price"
                />
                <TextField
                  label="Discount Value"
                  value={discountValue}
                  onChange={setDiscountValue}
                  placeholder="40"
                  type="number"
                  autoComplete="off"
                  requiredIndicator
                />
                <TextField
                  label="Customer Tags"
                  value={customerTags}
                  onChange={setCustomerTags}
                  placeholder="wholesale"
                  autoComplete="off"
                  helpText="Comma-separated tags"
                />
              </InlineStack>

              <Button variant="primary" onClick={handleAddVariant}>
                Add Variant Pricing
              </Button>
            </BlockStack>
          </Card>

          {/* Variant Pricing List */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">Variant Pricing Rules</Text>
                <TextField
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Search by SKU, Product ID, or Variant ID..."
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setSearchTerm('')}
                />
              </InlineStack>

              {filteredPricing.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'text']}
                  headings={[
                    'Product ID',
                    'Variant ID',
                    'SKU',
                    'Customer Tags',
                    'Discount',
                    'Type',
                    'Actions'
                  ]}
                  rows={rows}
                />
              ) : (
                <EmptyState
                  heading="No variant pricing configured"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Add specific variant-level pricing for individual products.</p>
                </EmptyState>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">How It Works</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  • Set custom pricing for specific variants
                </Text>
                <Text variant="bodySm">
                  • Different from common pricing rules
                </Text>
                <Text variant="bodySm">
                  • Overrides rule-based pricing
                </Text>
                <Text variant="bodySm">
                  • Copy settings between variants
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Discount Types</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  <strong>percentage:</strong> % off retail (e.g., 40)
                </Text>
                <Text variant="bodySm">
                  <strong>fixed_amount:</strong> $ off retail (e.g., 10)
                </Text>
                <Text variant="bodySm">
                  <strong>fixed_price:</strong> Set price (e.g., 50)
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Finding Product/Variant IDs</Text>
              <Text variant="bodySm">
                In Shopify Admin, go to the product page and check the URL:
              </Text>
              <Text variant="bodySm" tone="subdued">
                /products/<strong>[product_id]</strong>
              </Text>
              <Text variant="bodySm">
                For variants, click on a variant and check the URL:
              </Text>
              <Text variant="bodySm" tone="subdued">
                /variants/<strong>[variant_id]</strong>
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
