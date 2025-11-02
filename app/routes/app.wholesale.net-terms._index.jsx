// Net Terms Management - Pay Later for Wholesale Customers
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
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
  EmptyState
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { query } from "../db/connection.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Get net terms summary from view
  const result = await query(
    `SELECT nts.*
     FROM net_terms_summary nts
     INNER JOIN shops s ON nts.shop_id = s.id
     WHERE s.shop_domain = $1
     ORDER BY nts.current_balance DESC`,
    [shopDomain]
  );

  return json({ netTerms: result.rows || [] });
};

export default function NetTermsIndex() {
  const { netTerms } = useLoaderData();
  const navigate = useNavigate();

  const rows = netTerms.map(term => [
    term.customer_email,
    `$${parseFloat(term.credit_limit).toFixed(2)}`,
    `$${parseFloat(term.current_balance).toFixed(2)}`,
    `$${parseFloat(term.available_credit).toFixed(2)}`,
    term.net_days + ' days',
    <Badge key={term.id} tone={
      term.status === 'active' ? 'success' :
      term.status === 'suspended' ? 'warning' : 'critical'
    }>
      {term.status}
    </Badge>,
    <InlineStack gap="200" key={term.id}>
      <Text variant="bodySm" tone={term.overdue_invoices > 0 ? 'critical' : 'subdued'}>
        {term.pending_invoices} pending
      </Text>
      {term.overdue_invoices > 0 && (
        <Text variant="bodySm" tone="critical">
          {term.overdue_invoices} overdue
        </Text>
      )}
    </InlineStack>,
    <Button
      key={term.id}
      size="slim"
      onClick={() => navigate(`/app/wholesale/net-terms/${term.id}`)}
    >
      Manage
    </Button>
  ]);

  return (
    <Page
      title="Net Terms (Pay Later)"
      subtitle="Manage credit limits and payment terms for wholesale customers"
      backAction={{ onAction: () => navigate('/app/wholesale') }}
      primaryAction={{
        content: 'Add Net Terms',
        onAction: () => navigate('/app/wholesale/net-terms/new')
      }}
    >
      <Layout>
        <Layout.Section>
          {/* Summary Cards */}
          <InlineStack gap="400" wrap={false}>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued">Total Credit Extended</Text>
                <Text variant="heading2xl" as="p">
                  ${netTerms.reduce((sum, t) => sum + parseFloat(t.credit_limit), 0).toFixed(2)}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued">Outstanding Balance</Text>
                <Text variant="heading2xl" as="p">
                  ${netTerms.reduce((sum, t) => sum + parseFloat(t.current_balance), 0).toFixed(2)}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued">Available Credit</Text>
                <Text variant="heading2xl" as="p">
                  ${netTerms.reduce((sum, t) => sum + parseFloat(t.available_credit), 0).toFixed(2)}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued">Overdue Invoices</Text>
                <Text variant="heading2xl" as="p" tone="critical">
                  {netTerms.reduce((sum, t) => sum + parseInt(t.overdue_invoices), 0)}
                </Text>
              </BlockStack>
            </Card>
          </InlineStack>

          {/* Net Terms List */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Customer Net Terms</Text>

              {netTerms.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'numeric', 'numeric', 'numeric', 'text', 'text', 'text', 'text']}
                  headings={[
                    'Customer',
                    'Credit Limit',
                    'Current Balance',
                    'Available',
                    'Terms',
                    'Status',
                    'Invoices',
                    'Actions'
                  ]}
                  rows={rows}
                />
              ) : (
                <EmptyState
                  heading="No net terms configured"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Offer pay-later terms to your wholesale customers.</p>
                  <Button onClick={() => navigate('/app/wholesale/net-terms/new')}>
                    Add Net Terms
                  </Button>
                </EmptyState>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">How Net Terms Work</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  • Set credit limits for customers
                </Text>
                <Text variant="bodySm">
                  • Define payment terms (e.g., Net 30)
                </Text>
                <Text variant="bodySm">
                  • Track invoices and balances
                </Text>
                <Text variant="bodySm">
                  • Suspend accounts for non-payment
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Quick Actions</Text>
              <Button fullWidth onClick={() => navigate('/app/wholesale/net-terms/invoices')}>
                View All Invoices
              </Button>
              <Button fullWidth onClick={() => navigate('/app/wholesale/net-terms/overdue')}>
                Overdue Invoices
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
