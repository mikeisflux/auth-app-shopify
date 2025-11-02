// Wholesale Analytics Dashboard
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  DataTable,
  Select
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { query } from "../db/connection.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Get comprehensive analytics
  const analyticsResult = await query(
    `SELECT
      -- Customer stats
      (SELECT COUNT(*) FROM wholesale_customers wc
       INNER JOIN shops s ON wc.shop_id = s.id
       WHERE s.shop_domain = $1) as total_customers,
      (SELECT COUNT(*) FROM wholesale_customers wc
       INNER JOIN shops s ON wc.shop_id = s.id
       WHERE s.shop_domain = $1 AND wc.wholesale_approved = true) as approved_customers,
      (SELECT COUNT(*) FROM wholesale_customers wc
       INNER JOIN shops s ON wc.shop_id = s.id
       WHERE s.shop_domain = $1 AND wc.wholesale_approved = false) as pending_customers,

      -- Revenue stats
      (SELECT COALESCE(SUM(wc.total_spent), 0) FROM wholesale_customers wc
       INNER JOIN shops s ON wc.shop_id = s.id
       WHERE s.shop_domain = $1) as total_revenue,
      (SELECT COALESCE(SUM(wc.order_count), 0) FROM wholesale_customers wc
       INNER JOIN shops s ON wc.shop_id = s.id
       WHERE s.shop_domain = $1) as total_orders,

      -- Rules stats
      (SELECT COUNT(*) FROM pricing_rules pr
       INNER JOIN shops s ON pr.shop_id = s.id
       WHERE s.shop_domain = $1) as total_rules,
      (SELECT COUNT(*) FROM pricing_rules pr
       INNER JOIN shops s ON pr.shop_id = s.id
       WHERE s.shop_domain = $1 AND pr.status = 'published') as active_rules,

      -- Order limits
      (SELECT COUNT(*) FROM order_limit_rules olr
       INNER JOIN shops s ON olr.shop_id = s.id
       WHERE s.shop_domain = $1 AND olr.status = 'active') as active_order_limits,

      -- Shipping rules
      (SELECT COUNT(*) FROM shipping_rules sr
       INNER JOIN shops s ON sr.shop_id = s.id
       WHERE s.shop_domain = $1 AND sr.status = 'active') as active_shipping_rules`,
    [shopDomain]
  );

  const analytics = analyticsResult.rows[0];

  // Top customers by revenue
  const topCustomersResult = await query(
    `SELECT wc.email, wc.order_count, wc.total_spent, wc.wholesale_approved,
            wc.customer_tags
     FROM wholesale_customers wc
     INNER JOIN shops s ON wc.shop_id = s.id
     WHERE s.shop_domain = $1
     ORDER BY wc.total_spent DESC
     LIMIT 10`,
    [shopDomain]
  );

  // Pricing rule usage
  const ruleUsageResult = await query(
    `SELECT pr.name, pr.rule_type, pr.discount_value, pr.discount_type,
            pr.status, pr.customer_tags,
            COUNT(DISTINCT ec.email) as eligibility_checks
     FROM pricing_rules pr
     INNER JOIN shops s ON pr.shop_id = s.id
     LEFT JOIN eligibility_checks ec ON pr.id = ec.pricing_rule_id
     WHERE s.shop_domain = $1
     GROUP BY pr.id, pr.name, pr.rule_type, pr.discount_value,
              pr.discount_type, pr.status, pr.customer_tags
     ORDER BY eligibility_checks DESC
     LIMIT 10`,
    [shopDomain]
  );

  // Recent activity (eligibility checks)
  const recentActivityResult = await query(
    `SELECT ec.email, pr.name as rule_name, ec.eligible, ec.reason, ec.checked_at
     FROM eligibility_checks ec
     INNER JOIN shops s ON ec.shop_id = s.id
     LEFT JOIN pricing_rules pr ON ec.pricing_rule_id = pr.id
     WHERE s.shop_domain = $1
     ORDER BY ec.checked_at DESC
     LIMIT 20`,
    [shopDomain]
  );

  // Customer tag distribution
  const tagDistributionResult = await query(
    `SELECT
      jsonb_array_elements_text(customer_tags) as tag,
      COUNT(*) as customer_count
     FROM wholesale_customers wc
     INNER JOIN shops s ON wc.shop_id = s.id
     WHERE s.shop_domain = $1
     GROUP BY tag
     ORDER BY customer_count DESC
     LIMIT 10`,
    [shopDomain]
  );

  return json({
    analytics,
    topCustomers: topCustomersResult.rows,
    ruleUsage: ruleUsageResult.rows,
    recentActivity: recentActivityResult.rows,
    tagDistribution: tagDistributionResult.rows
  });
};

export default function Analytics() {
  const { analytics, topCustomers, ruleUsage, recentActivity, tagDistribution } = useLoaderData();
  const navigate = useNavigate();

  const [timePeriod, setTimePeriod] = useState('all');

  const avgOrderValue = analytics.total_orders > 0
    ? (parseFloat(analytics.total_revenue) / analytics.total_orders).toFixed(2)
    : '0.00';

  const approvalRate = analytics.total_customers > 0
    ? ((analytics.approved_customers / analytics.total_customers) * 100).toFixed(1)
    : '0';

  const topCustomerRows = topCustomers.map(c => [
    c.email,
    <Badge key={c.email} tone={c.wholesale_approved ? 'success' : 'warning'}>
      {c.wholesale_approved ? 'Approved' : 'Pending'}
    </Badge>,
    c.order_count,
    `$${parseFloat(c.total_spent).toFixed(2)}`,
    JSON.parse(c.customer_tags || '[]').join(', ') || 'None'
  ]);

  const ruleUsageRows = ruleUsage.map(r => [
    r.name,
    r.rule_type,
    `${r.discount_value}${r.discount_type === 'percentage' ? '%' : ''}`,
    <Badge key={r.name} tone={r.status === 'published' ? 'success' : 'info'}>
      {r.status}
    </Badge>,
    r.eligibility_checks
  ]);

  const recentActivityRows = recentActivity.map(a => [
    a.email,
    a.rule_name || 'N/A',
    <Badge key={a.email + a.checked_at} tone={a.eligible ? 'success' : 'critical'}>
      {a.eligible ? 'Eligible' : 'Not Eligible'}
    </Badge>,
    a.reason || '',
    new Date(a.checked_at).toLocaleDateString()
  ]);

  const tagDistributionRows = tagDistribution.map(t => [
    t.tag,
    t.customer_count,
    `${((t.customer_count / analytics.total_customers) * 100).toFixed(1)}%`
  ]);

  return (
    <Page
      title="Analytics & Reporting"
      subtitle="Wholesale performance metrics and insights"
      backAction={{ onAction: () => navigate('/app/wholesale') }}
    >
      <Layout>
        <Layout.Section>
          {/* Key Metrics */}
          <Layout>
            <Layout.Section variant="oneThird">
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2">Total Revenue</Text>
                  <Text variant="heading2xl" as="p">
                    ${parseFloat(analytics.total_revenue).toFixed(2)}
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    From {analytics.total_orders} orders
                  </Text>
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section variant="oneThird">
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2">Average Order Value</Text>
                  <Text variant="heading2xl" as="p">${avgOrderValue}</Text>
                  <Text variant="bodySm" tone="subdued">
                    Per wholesale order
                  </Text>
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section variant="oneThird">
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2">Approval Rate</Text>
                  <Text variant="heading2xl" as="p">{approvalRate}%</Text>
                  <Text variant="bodySm" tone="subdued">
                    {analytics.approved_customers} of {analytics.total_customers} customers
                  </Text>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>

          {/* Secondary Metrics */}
          <Layout>
            <Layout.Section variant="oneHalf">
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2">Customer Status</Text>
                  <InlineStack gap="400">
                    <BlockStack gap="100">
                      <Text variant="bodySm" tone="subdued">Total</Text>
                      <Text variant="headingLg">{analytics.total_customers}</Text>
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text variant="bodySm" tone="subdued">Approved</Text>
                      <Text variant="headingLg">{analytics.approved_customers}</Text>
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text variant="bodySm" tone="subdued">Pending</Text>
                      <Text variant="headingLg">{analytics.pending_customers}</Text>
                    </BlockStack>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section variant="oneHalf">
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2">Active Rules</Text>
                  <InlineStack gap="400">
                    <BlockStack gap="100">
                      <Text variant="bodySm" tone="subdued">Pricing Rules</Text>
                      <Text variant="headingLg">{analytics.active_rules}</Text>
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text variant="bodySm" tone="subdued">Order Limits</Text>
                      <Text variant="headingLg">{analytics.active_order_limits}</Text>
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text variant="bodySm" tone="subdued">Shipping Rules</Text>
                      <Text variant="headingLg">{analytics.active_shipping_rules}</Text>
                    </BlockStack>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>

          {/* Top Customers */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Top Customers by Revenue</Text>
              {topCustomers.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'text', 'numeric', 'numeric', 'text']}
                  headings={['Email', 'Status', 'Orders', 'Revenue', 'Tags']}
                  rows={topCustomerRows}
                />
              ) : (
                <Text tone="subdued">No customer data yet</Text>
              )}
            </BlockStack>
          </Card>

          {/* Pricing Rule Usage */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Pricing Rule Usage</Text>
              {ruleUsage.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'numeric']}
                  headings={['Rule Name', 'Type', 'Discount', 'Status', 'Eligibility Checks']}
                  rows={ruleUsageRows}
                />
              ) : (
                <Text tone="subdued">No pricing rules yet</Text>
              )}
            </BlockStack>
          </Card>

          {/* Tag Distribution */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Customer Tag Distribution</Text>
              {tagDistribution.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'numeric', 'text']}
                  headings={['Tag', 'Customers', 'Percentage']}
                  rows={tagDistributionRows}
                />
              ) : (
                <Text tone="subdued">No tags data yet</Text>
              )}
            </BlockStack>
          </Card>

          {/* Recent Activity */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Recent Eligibility Checks</Text>
              {recentActivity.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                  headings={['Customer', 'Rule', 'Result', 'Reason', 'Date']}
                  rows={recentActivityRows}
                />
              ) : (
                <Text tone="subdued">No activity yet</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
