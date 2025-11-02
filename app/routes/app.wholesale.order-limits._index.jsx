// Order Limits Management
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

  const orderLimits = await WholesaleModel.getOrderLimits(shopDomain);

  return json({ orderLimits });
};

export default function OrderLimits() {
  const { orderLimits } = useLoaderData();
  const navigate = useNavigate();

  const rows = (orderLimits || []).map((limit) => [
    limit.name,
    <Badge key={limit.id} tone={limit.status === 'active' ? 'success' : 'info'}>
      {limit.status}
    </Badge>,
    limit.scope,
    JSON.parse(limit.customer_tags || '[]').join(', ') || 'All',
    limit.failure_action,
    <Button
      key={`edit-${limit.id}`}
      size="slim"
      onClick={() => navigate(`/app/wholesale/order-limits/${limit.id}`)}
    >
      Edit
    </Button>
  ]);

  return (
    <Page
      title="Order Limits"
      subtitle="Set minimum order requirements for wholesale customers"
      backAction={{ onAction: () => navigate('/app/wholesale') }}
      primaryAction={{
        content: 'Create Limit',
        onAction: () => navigate('/app/wholesale/order-limits/new')
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            {orderLimits && orderLimits.length > 0 ? (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                headings={['Name', 'Status', 'Scope', 'Tags', 'Action', 'Options']}
                rows={rows}
              />
            ) : (
              <EmptyState
                heading="No order limits yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Set minimum order requirements to enforce wholesale minimums</p>
                <Button
                  variant="primary"
                  onClick={() => navigate('/app/wholesale/order-limits/new')}
                >
                  Create Order Limit
                </Button>
              </EmptyState>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
