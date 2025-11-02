// Wholesale Shipping Rules Management
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  Badge,
  DataTable,
  EmptyState
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { WholesaleModel } from "../models/wholesale.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const shippingRules = await WholesaleModel.getShippingRules(shopDomain);

  return json({ shippingRules });
};

export default function ShippingRules() {
  const { shippingRules } = useLoaderData();
  const navigate = useNavigate();

  const rows = shippingRules.map((rule) => [
    rule.title,
    <Badge key={rule.id} tone={rule.status === 'active' ? 'success' : 'info'}>
      {rule.status}
    </Badge>,
    rule.rate_type,
    `$${parseFloat(rule.shipping_charge).toFixed(2)}`,
    JSON.parse(rule.customer_tags || '[]').join(', ') || 'All',
    <Button
      key={`edit-${rule.id}`}
      size="slim"
      onClick={() => navigate(`/app/wholesale/shipping/${rule.id}`)}
    >
      Edit
    </Button>
  ]);

  return (
    <Page
      title="Shipping Rules"
      subtitle="Manage custom shipping rates for wholesale orders"
      backAction={{ onAction: () => navigate('/app/wholesale') }}
      primaryAction={{
        content: 'Create Rule',
        onAction: () => navigate('/app/wholesale/shipping/new')
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            {shippingRules.length > 0 ? (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'numeric', 'text', 'text']}
                headings={['Title', 'Status', 'Rate Type', 'Charge', 'Tags', 'Actions']}
                rows={rows}
              />
            ) : (
              <EmptyState
                heading="No shipping rules yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Create custom shipping rules for your wholesale customers</p>
                <Button
                  variant="primary"
                  onClick={() => navigate('/app/wholesale/shipping/new')}
                >
                  Create Shipping Rule
                </Button>
              </EmptyState>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
