// Wholesale Pricing Rules Management
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
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

  const pricingRules = await WholesaleModel.getPricingRules(shopDomain);

  return json({ pricingRules });
};

export default function PricingRules() {
  const { pricingRules } = useLoaderData();
  const navigate = useNavigate();

  const rows = pricingRules.map((rule) => [
    rule.name,
    <Badge key={rule.id} tone={rule.status === 'published' ? 'success' : 'info'}>
      {rule.status}
    </Badge>,
    rule.rule_type,
    `${rule.discount_value}${rule.discount_type === 'percentage' ? '%' : ' off'}`,
    JSON.parse(rule.customer_tags || '[]').join(', ') || 'All',
    <Button
      key={`edit-${rule.id}`}
      size="slim"
      onClick={() => navigate(`/app/wholesale/pricing/${rule.id}`)}
    >
      Edit
    </Button>
  ]);

  return (
    <Page
      title="Pricing Rules"
      subtitle="Manage wholesale pricing rules and discounts"
      backAction={{ onAction: () => navigate('/app/wholesale') }}
      primaryAction={{
        content: 'Create Rule',
        onAction: () => navigate('/app/wholesale/pricing/new')
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            {pricingRules.length > 0 ? (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                headings={['Name', 'Status', 'Type', 'Discount', 'Tags', 'Actions']}
                rows={rows}
              />
            ) : (
              <EmptyState
                heading="No pricing rules yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Create your first pricing rule to start offering wholesale discounts</p>
                <Button
                  variant="primary"
                  onClick={() => navigate('/app/wholesale/pricing/new')}
                >
                  Create Pricing Rule
                </Button>
              </EmptyState>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
