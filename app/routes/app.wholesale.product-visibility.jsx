// Product Visibility Controls - Show/Hide Products
import { json } from "@remix-run/node";
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
  Text,
  DataTable,
  Box
} from "@shopify/polaris";
import { DeleteMinor, PlusMinor } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { query } from "../db/connection.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Get all visibility rules
  const result = await query(
    `SELECT vr.*
     FROM product_visibility_rules vr
     INNER JOIN shops s ON vr.shop_id = s.id
     WHERE s.shop_domain = $1
     ORDER BY vr.created_at DESC`,
    [shopDomain]
  );

  return json({ rules: result.rows || [] });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const formData = await request.formData();
  const actionType = formData.get('actionType');

  try {
    if (actionType === 'create') {
      const ruleName = formData.get('ruleName');
      const visibilityType = formData.get('visibilityType');
      const customerTags = formData.get('customerTags')?.split(',').map(t => t.trim()).filter(Boolean) || [];
      const productIds = formData.get('productIds')?.split(',').map(t => t.trim()).filter(Boolean) || [];
      const collectionIds = formData.get('collectionIds')?.split(',').map(t => t.trim()).filter(Boolean) || [];
      const status = formData.get('status');

      await query(
        `INSERT INTO product_visibility_rules
         (shop_id, rule_name, visibility_type, customer_tags, product_ids, collection_ids, status)
         SELECT s.id, $2, $3, $4, $5, $6, $7
         FROM shops s
         WHERE s.shop_domain = $1`,
        [
          shopDomain, ruleName, visibilityType,
          JSON.stringify(customerTags),
          JSON.stringify(productIds),
          JSON.stringify(collectionIds),
          status || 'active'
        ]
      );

      return json({ success: true, message: 'Visibility rule created!' });
    }

    if (actionType === 'delete') {
      const ruleId = formData.get('ruleId');
      await query(
        `DELETE FROM product_visibility_rules vr
         USING shops s
         WHERE vr.id = $1 AND vr.shop_id = s.id AND s.shop_domain = $2`,
        [ruleId, shopDomain]
      );

      return json({ success: true, message: 'Rule deleted!' });
    }

    return json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function ProductVisibility() {
  const { rules } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [ruleName, setRuleName] = useState('');
  const [visibilityType, setVisibilityType] = useState('show');
  const [customerTags, setCustomerTags] = useState('');
  const [productIds, setProductIds] = useState('');
  const [collectionIds, setCollectionIds] = useState('');
  const [status, setStatus] = useState('active');

  const handleCreate = () => {
    const formData = new FormData();
    formData.append('actionType', 'create');
    formData.append('ruleName', ruleName);
    formData.append('visibilityType', visibilityType);
    formData.append('customerTags', customerTags);
    formData.append('productIds', productIds);
    formData.append('collectionIds', collectionIds);
    formData.append('status', status);

    submit(formData, { method: 'post' });

    // Reset form
    setRuleName('');
    setCustomerTags('');
    setProductIds('');
    setCollectionIds('');
  };

  const handleDelete = (ruleId) => {
    if (confirm('Delete this visibility rule?')) {
      const formData = new FormData();
      formData.append('actionType', 'delete');
      formData.append('ruleId', ruleId);
      submit(formData, { method: 'post' });
    }
  };

  const rows = rules.map(rule => [
    rule.rule_name,
    rule.visibility_type === 'show' ? 'Show Only To' : 'Hide From',
    JSON.parse(rule.customer_tags || '[]').join(', ') || 'All',
    `${JSON.parse(rule.product_ids || '[]').length} products, ${JSON.parse(rule.collection_ids || '[]').length} collections`,
    rule.status,
    <Button
      key={rule.id}
      size="slim"
      destructive
      onClick={() => handleDelete(rule.id)}
    >
      Delete
    </Button>
  ]);

  return (
    <Page
      title="Product Visibility"
      subtitle="Control which products are visible to specific customer groups"
      backAction={{ onAction: () => navigate('/app/wholesale') }}
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

          {/* Create New Rule */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Create Visibility Rule</Text>

              <FormLayout>
                <TextField
                  label="Rule Name"
                  value={ruleName}
                  onChange={setRuleName}
                  placeholder="e.g., Wholesale Only Products"
                  autoComplete="off"
                />

                <Select
                  label="Visibility Type"
                  options={[
                    { label: 'Show products only to customers with tags', value: 'show' },
                    { label: 'Hide products from customers with tags', value: 'hide' }
                  ]}
                  value={visibilityType}
                  onChange={setVisibilityType}
                  helpText="Choose how to control product visibility"
                />

                <TextField
                  label="Customer Tags"
                  value={customerTags}
                  onChange={setCustomerTags}
                  placeholder="wholesale, vip"
                  autoComplete="off"
                  helpText="Comma-separated tags"
                />

                <TextField
                  label="Product IDs"
                  value={productIds}
                  onChange={setProductIds}
                  placeholder="123456, 234567"
                  autoComplete="off"
                  helpText="Shopify product IDs (comma-separated)"
                />

                <TextField
                  label="Collection IDs"
                  value={collectionIds}
                  onChange={setCollectionIds}
                  placeholder="123456, 234567"
                  autoComplete="off"
                  helpText="Shopify collection IDs (comma-separated)"
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

                <Button
                  variant="primary"
                  onClick={handleCreate}
                  disabled={!ruleName || (!productIds && !collectionIds)}
                >
                  Create Rule
                </Button>
              </FormLayout>
            </BlockStack>
          </Card>

          {/* Existing Rules */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Existing Visibility Rules</Text>

              {rules.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                  headings={['Name', 'Type', 'Customer Tags', 'Products/Collections', 'Status', 'Actions']}
                  rows={rows}
                />
              ) : (
                <Text tone="subdued">No visibility rules yet. Create one above.</Text>
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
                  <strong>Show Only:</strong> Products are visible only to customers with specified tags
                </Text>
                <Text variant="bodySm">
                  <strong>Hide From:</strong> Products are hidden from customers with specified tags
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Use Cases</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">• Wholesale-only products</Text>
                <Text variant="bodySm">• VIP exclusive items</Text>
                <Text variant="bodySm">• Hide retail products from wholesalers</Text>
                <Text variant="bodySm">• Create customer-specific catalogs</Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Important</Text>
              <BlockStack gap="100">
                <Text variant="bodySm" tone="critical">
                  ⚠️ Requires storefront integration to work. Products will still appear in Shopify admin.
                </Text>
                <Text variant="bodySm">
                  Use the API endpoint to check visibility on your storefront theme.
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
