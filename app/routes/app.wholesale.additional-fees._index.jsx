// Additional Fees - Charge Processing/Handling Fees on Wholesale Orders
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  EmptyState,
  Banner
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { query } from "../db/connection.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Get all fee rules
  const result = await query(
    `SELECT afr.*
     FROM additional_fee_rules afr
     INNER JOIN shops s ON afr.shop_id = s.id
     WHERE s.shop_domain = $1
     ORDER BY afr.created_at DESC`,
    [shopDomain]
  );

  return json({ feeRules: result.rows || [] });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const formData = await request.formData();
  const actionType = formData.get('actionType');

  try {
    if (actionType === 'delete') {
      const feeId = formData.get('feeId');

      await query(
        `DELETE FROM additional_fee_rules afr
         USING shops s
         WHERE afr.shop_id = s.id
           AND s.shop_domain = $1
           AND afr.id = $2`,
        [shopDomain, feeId]
      );

      return json({ success: true, message: 'Fee rule deleted!' });
    }

    if (actionType === 'toggle_status') {
      const feeId = formData.get('feeId');
      const newStatus = formData.get('newStatus');

      await query(
        `UPDATE additional_fee_rules afr
         SET status = $3,
             updated_at = CURRENT_TIMESTAMP
         FROM shops s
         WHERE afr.shop_id = s.id
           AND s.shop_domain = $1
           AND afr.id = $2`,
        [shopDomain, feeId, newStatus]
      );

      return json({ success: true, message: 'Status updated!' });
    }

    return json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function AdditionalFeesIndex() {
  const { feeRules } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const submit = useSubmit();

  const handleDelete = (feeId) => {
    if (!confirm('Delete this fee rule?')) return;

    const formData = new FormData();
    formData.append('actionType', 'delete');
    formData.append('feeId', feeId);
    submit(formData, { method: 'post' });
  };

  const handleToggleStatus = (feeId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    const formData = new FormData();
    formData.append('actionType', 'toggle_status');
    formData.append('feeId', feeId);
    formData.append('newStatus', newStatus);
    submit(formData, { method: 'post' });
  };

  const rows = feeRules.map(fee => [
    fee.name,
    fee.description || '-',
    `${fee.fee_value}${fee.fee_type === 'percentage' ? '%' : ' USD'}`,
    fee.fee_type,
    fee.customer_tags || 'All',
    fee.applies_to,
    <Badge key={fee.id} tone={fee.status === 'active' ? 'success' : 'info'}>
      {fee.status}
    </Badge>,
    <InlineStack gap="200" key={fee.id}>
      <Button
        size="slim"
        onClick={() => navigate(`/app/wholesale/additional-fees/${fee.id}`)}
      >
        Edit
      </Button>
      <Button
        size="slim"
        onClick={() => handleToggleStatus(fee.id, fee.status)}
      >
        {fee.status === 'active' ? 'Deactivate' : 'Activate'}
      </Button>
      <Button
        size="slim"
        destructive
        onClick={() => handleDelete(fee.id)}
      >
        Delete
      </Button>
    </InlineStack>
  ]);

  return (
    <Page
      title="Additional Fees"
      subtitle="Charge processing or handling fees on wholesale orders"
      backAction={{ onAction: () => navigate('/app/wholesale') }}
      primaryAction={{
        content: 'Create Fee Rule',
        onAction: () => navigate('/app/wholesale/additional-fees/new')
      }}
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

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Fee Rules</Text>

              {feeRules.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'text', 'text']}
                  headings={[
                    'Name',
                    'Description',
                    'Fee Amount',
                    'Type',
                    'Customer Tags',
                    'Applies To',
                    'Status',
                    'Actions'
                  ]}
                  rows={rows}
                />
              ) : (
                <EmptyState
                  heading="No fee rules configured"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Create fee rules to charge processing or handling fees on wholesale orders.</p>
                  <Button onClick={() => navigate('/app/wholesale/additional-fees/new')}>
                    Create Fee Rule
                  </Button>
                </EmptyState>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">How Additional Fees Work</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  • Add processing fees to wholesale orders
                </Text>
                <Text variant="bodySm">
                  • Charge credit card fees
                </Text>
                <Text variant="bodySm">
                  • Add handling or packaging charges
                </Text>
                <Text variant="bodySm">
                  • Target specific customer groups with tags
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Fee Types</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  <strong>Percentage:</strong> % of order subtotal
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Example: 3% credit card fee
                </Text>
                <Text variant="bodySm">
                  <strong>Fixed Amount:</strong> Flat fee per order
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Example: $5 handling fee
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Use Cases</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  • Offset credit card processing costs
                </Text>
                <Text variant="bodySm">
                  • Cover packaging materials
                </Text>
                <Text variant="bodySm">
                  • Charge rush order fees
                </Text>
                <Text variant="bodySm">
                  • Add fuel surcharges
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Important Notes</Text>
              <Banner status="warning">
                <BlockStack gap="100">
                  <Text variant="bodySm">
                    • Fees are added at checkout via Draft Order API
                  </Text>
                  <Text variant="bodySm">
                    • Clearly communicate fees to customers
                  </Text>
                  <Text variant="bodySm">
                    • Ensure fees comply with local regulations
                  </Text>
                </BlockStack>
              </Banner>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
