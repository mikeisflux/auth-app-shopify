// Manage Net Terms for a Customer
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
  Text,
  Badge,
  DataTable,
  Divider
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { query } from "../db/connection.server";

export const loader = async ({ params, request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const { termId } = params;

  // Get net terms details
  const termResult = await query(
    `SELECT nt.*, wc.email as customer_email, wc.shopify_customer_id
     FROM net_terms nt
     INNER JOIN wholesale_customers wc ON nt.customer_id = wc.id
     INNER JOIN shops s ON nt.shop_id = s.id
     WHERE nt.id = $1 AND s.shop_domain = $2`,
    [termId, shopDomain]
  );

  if (termResult.rows.length === 0) {
    throw new Response("Net terms not found", { status: 404 });
  }

  const term = termResult.rows[0];

  // Get invoices for this term
  const invoicesResult = await query(
    `SELECT * FROM net_terms_invoices
     WHERE net_terms_id = $1
     ORDER BY due_date DESC`,
    [termId]
  );

  return json({
    term,
    invoices: invoicesResult.rows || []
  });
};

export const action = async ({ params, request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const { termId } = params;

  const formData = await request.formData();
  const actionType = formData.get('actionType');

  try {
    if (actionType === 'update') {
      const creditLimit = parseFloat(formData.get('creditLimit'));
      const netDays = parseInt(formData.get('netDays'));
      const status = formData.get('status');

      await query(
        `UPDATE net_terms
         SET credit_limit = $1,
             net_days = $2,
             status = $3,
             available_credit = $1 - current_balance
         FROM shops s
         WHERE net_terms.id = $4
           AND net_terms.shop_id = s.id
           AND s.shop_domain = $5`,
        [creditLimit, netDays, status, termId, shopDomain]
      );

      return json({ success: true, message: 'Net terms updated!' });
    }

    if (actionType === 'mark_paid') {
      const invoiceId = formData.get('invoiceId');
      await query(
        `UPDATE net_terms_invoices
         SET status = 'paid',
             paid_date = CURRENT_DATE
         WHERE id = $1`,
        [invoiceId]
      );

      return json({ success: true, message: 'Invoice marked as paid!' });
    }

    if (actionType === 'delete') {
      await query(
        `DELETE FROM net_terms nt
         USING shops s
         WHERE nt.id = $1 AND nt.shop_id = s.id AND s.shop_domain = $2`,
        [termId, shopDomain]
      );

      return redirect('/app/wholesale/net-terms');
    }

    return json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function NetTermsDetail() {
  const { term, invoices } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [creditLimit, setCreditLimit] = useState(term.credit_limit);
  const [netDays, setNetDays] = useState(term.net_days);
  const [status, setStatus] = useState(term.status);

  const handleUpdate = () => {
    const formData = new FormData();
    formData.append('actionType', 'update');
    formData.append('creditLimit', creditLimit);
    formData.append('netDays', netDays);
    formData.append('status', status);
    submit(formData, { method: 'post' });
  };

  const handleMarkPaid = (invoiceId) => {
    if (confirm('Mark this invoice as paid?')) {
      const formData = new FormData();
      formData.append('actionType', 'mark_paid');
      formData.append('invoiceId', invoiceId);
      submit(formData, { method: 'post' });
    }
  };

  const handleDelete = () => {
    if (confirm('Delete net terms for this customer? All invoices will be removed.')) {
      const formData = new FormData();
      formData.append('actionType', 'delete');
      submit(formData, { method: 'post' });
    }
  };

  const utilizationPercent = (parseFloat(term.current_balance) / parseFloat(term.credit_limit) * 100).toFixed(1);

  const invoiceRows = invoices.map(inv => [
    inv.invoice_number,
    `$${parseFloat(inv.amount).toFixed(2)}`,
    new Date(inv.due_date).toLocaleDateString(),
    inv.paid_date ? new Date(inv.paid_date).toLocaleDateString() : '-',
    <Badge key={inv.id} tone={
      inv.status === 'paid' ? 'success' :
      inv.status === 'overdue' ? 'critical' : 'warning'
    }>
      {inv.status}
    </Badge>,
    inv.status !== 'paid' ? (
      <Button
        key={inv.id}
        size="slim"
        onClick={() => handleMarkPaid(inv.id)}
      >
        Mark Paid
      </Button>
    ) : null
  ]);

  return (
    <Page
      title={term.customer_email}
      subtitle="Net terms management"
      backAction={{ onAction: () => navigate('/app/wholesale/net-terms') }}
      primaryAction={{
        content: 'Save Changes',
        onAction: handleUpdate
      }}
      secondaryActions={[
        {
          content: 'Delete Net Terms',
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

          {/* Account Summary */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Account Summary</Text>

              <InlineStack gap="400" wrap={false}>
                <Card>
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Credit Limit</Text>
                    <Text variant="heading2xl" as="p">
                      ${parseFloat(term.credit_limit).toFixed(2)}
                    </Text>
                  </BlockStack>
                </Card>
                <Card>
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Current Balance</Text>
                    <Text variant="heading2xl" as="p" tone={parseFloat(term.current_balance) > 0 ? 'critical' : 'subdued'}>
                      ${parseFloat(term.current_balance).toFixed(2)}
                    </Text>
                  </BlockStack>
                </Card>
                <Card>
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Available Credit</Text>
                    <Text variant="heading2xl" as="p" tone="success">
                      ${parseFloat(term.available_credit).toFixed(2)}
                    </Text>
                  </BlockStack>
                </Card>
                <Card>
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Credit Utilization</Text>
                    <Text variant="heading2xl" as="p" tone={utilizationPercent > 90 ? 'critical' : 'subdued'}>
                      {utilizationPercent}%
                    </Text>
                  </BlockStack>
                </Card>
              </InlineStack>

              <InlineStack gap="400" wrap={false}>
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="subdued">Payment Terms</Text>
                  <Text variant="bodyMd">Net {term.net_days} days</Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="subdued">Status</Text>
                  <Badge tone={
                    term.status === 'active' ? 'success' :
                    term.status === 'suspended' ? 'warning' : 'critical'
                  }>
                    {term.status}
                  </Badge>
                </BlockStack>
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="subdued">Account Created</Text>
                  <Text variant="bodyMd">{new Date(term.created_at).toLocaleDateString()}</Text>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </Card>

          {/* Edit Form */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Net Terms Settings</Text>

              <FormLayout>
                <TextField
                  label="Credit Limit"
                  type="number"
                  value={creditLimit}
                  onChange={setCreditLimit}
                  prefix="$"
                  autoComplete="off"
                  helpText="Maximum amount customer can owe at once"
                />

                <TextField
                  label="Payment Terms (Days)"
                  type="number"
                  value={netDays}
                  onChange={setNetDays}
                  autoComplete="off"
                  helpText="Number of days customer has to pay (e.g., 30 for Net 30)"
                />

                <Select
                  label="Status"
                  options={[
                    { label: 'Active', value: 'active' },
                    { label: 'Suspended', value: 'suspended' },
                    { label: 'Revoked', value: 'revoked' }
                  ]}
                  value={status}
                  onChange={setStatus}
                  helpText="Suspended accounts cannot place new orders"
                />
              </FormLayout>
            </BlockStack>
          </Card>

          {/* Invoices */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Invoices</Text>

              {invoices.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'numeric', 'text', 'text', 'text', 'text']}
                  headings={['Invoice #', 'Amount', 'Due Date', 'Paid Date', 'Status', 'Actions']}
                  rows={invoiceRows}
                />
              ) : (
                <Text tone="subdued">No invoices yet</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Customer Info</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  <strong>Email:</strong> {term.customer_email}
                </Text>
                <Text variant="bodySm">
                  <strong>Shopify ID:</strong> {term.shopify_customer_id}
                </Text>
              </BlockStack>
              <Divider />
              <Button
                fullWidth
                onClick={() => navigate(`/app/wholesale/customers/${term.customer_id}`)}
              >
                View Customer Details
              </Button>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Warning Signs</Text>
              {parseFloat(term.current_balance) > 0 && (
                <Banner status={utilizationPercent > 90 ? 'critical' : 'warning'}>
                  <p>Credit utilization: {utilizationPercent}%</p>
                </Banner>
              )}
              {invoices.some(i => i.status === 'overdue') && (
                <Banner status="critical">
                  <p>Has overdue invoices</p>
                </Banner>
              )}
              {term.status === 'suspended' && (
                <Banner status="warning">
                  <p>Account is suspended</p>
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
