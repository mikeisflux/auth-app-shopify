// Wholesale Portal - Main Dashboard
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
  Banner,
  Icon,
  Box
} from "@shopify/polaris";
import {
  PriceListMajor,
  CustomersMajor,
  DeliveryMajor,
  SettingsMajor,
  OrdersMajor,
  CircleInformationMajor
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { WholesaleModel } from "../models/wholesale.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Get wholesale statistics
  const stats = await WholesaleModel.getStatistics(shopDomain);

  // Get wholesale settings
  const settings = await WholesaleModel.getSettings(shopDomain);

  // Get recent pricing rules (top 3)
  const recentRules = await WholesaleModel.getPricingRules(shopDomain, { limit: 3 });

  // Get recent customers (top 3)
  const recentCustomers = await WholesaleModel.getWholesaleCustomers(shopDomain, { limit: 3 });

  return json({
    stats,
    settings,
    recentRules,
    recentCustomers
  });
};

export default function WholesalePortal() {
  const { stats, settings, recentRules, recentCustomers } = useLoaderData();
  const navigate = useNavigate();

  const isTestMode = settings?.app_mode === 'test';

  return (
    <Page
      title="Wholesale Portal"
      subtitle="Manage wholesale pricing, customers, and shipping rules"
      backAction={{ onAction: () => navigate('/app') }}
      primaryAction={{
        content: 'Settings',
        icon: SettingsMajor,
        onAction: () => navigate('/app/wholesale/settings')
      }}
    >
      <BlockStack gap="500">
        {isTestMode && (
          <Banner
            title="Test Mode Active"
            status="info"
            action={{
              content: 'Go to Settings',
              onAction: () => navigate('/app/wholesale/settings')
            }}
          >
            <p>
              Wholesale features are currently in test mode and not visible to customers.
              Switch to Live Mode when ready to deploy.
            </p>
          </Banner>
        )}

        {/* Statistics Cards */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Pricing Rules</Text>
                  <Icon source={PriceListMajor} tone="base" />
                </InlineStack>
                <Text variant="heading2xl" as="p">{stats.active_pricing_rules || 0}</Text>
                <Text variant="bodySm" tone="subdued">
                  Active rules
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Customers</Text>
                  <Icon source={CustomersMajor} tone="base" />
                </InlineStack>
                <Text variant="heading2xl" as="p">{stats.approved_customers || 0}</Text>
                <Text variant="bodySm" tone="subdued">
                  {stats.total_customers || 0} total, {stats.total_customers - stats.approved_customers || 0} pending
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Revenue</Text>
                  <Icon source={OrdersMajor} tone="base" />
                </InlineStack>
                <Text variant="heading2xl" as="p">
                  ${parseFloat(stats.total_revenue || 0).toFixed(2)}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  {stats.total_orders || 0} orders
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Quick Actions */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Quick Actions</Text>

                <Layout>
                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <InlineStack align="space-between" blockAlign="center">
                          <Icon source={PriceListMajor} tone="base" />
                        </InlineStack>
                        <Text variant="headingMd" as="h3">Pricing Rules</Text>
                        <Text variant="bodySm" tone="subdued">
                          Create and manage wholesale pricing rules with tiered discounts
                        </Text>
                        <InlineStack gap="200">
                          <Button
                            variant="primary"
                            onClick={() => navigate('/app/wholesale/pricing/new')}
                          >
                            Create Rule
                          </Button>
                          <Button
                            onClick={() => navigate('/app/wholesale/pricing')}
                          >
                            View All
                          </Button>
                        </InlineStack>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <InlineStack align="space-between" blockAlign="center">
                          <Icon source={CustomersMajor} tone="base" />
                        </InlineStack>
                        <Text variant="headingMd" as="h3">Wholesale Customers</Text>
                        <Text variant="bodySm" tone="subdued">
                          Manage customer tags, approvals, and wholesale access
                        </Text>
                        <InlineStack gap="200">
                          <Button
                            variant="primary"
                            onClick={() => navigate('/app/wholesale/customers/new')}
                          >
                            Add Customer
                          </Button>
                          <Button
                            onClick={() => navigate('/app/wholesale/customers')}
                          >
                            View All
                          </Button>
                        </InlineStack>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <InlineStack align="space-between" blockAlign="center">
                          <Icon source={DeliveryMajor} tone="base" />
                        </InlineStack>
                        <Text variant="headingMd" as="h3">Shipping Rules</Text>
                        <Text variant="bodySm" tone="subdued">
                          Configure custom shipping rates for wholesale orders
                        </Text>
                        <InlineStack gap="200">
                          <Button
                            variant="primary"
                            onClick={() => navigate('/app/wholesale/shipping/new')}
                          >
                            Create Rule
                          </Button>
                          <Button
                            onClick={() => navigate('/app/wholesale/shipping')}
                          >
                            View All
                          </Button>
                        </InlineStack>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <InlineStack align="space-between" blockAlign="center">
                          <Icon source={SettingsMajor} tone="base" />
                        </InlineStack>
                        <Text variant="headingMd" as="h3">Settings</Text>
                        <Text variant="bodySm" tone="subdued">
                          Configure wholesale portal settings and display options
                        </Text>
                        <Button
                          onClick={() => navigate('/app/wholesale/settings')}
                        >
                          Configure Settings
                        </Button>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">Order Limits</Text>
                        <Text variant="bodySm" tone="subdued">
                          Set minimum order requirements for wholesale customers
                        </Text>
                        <InlineStack gap="200">
                          <Button
                            variant="primary"
                            onClick={() => navigate('/app/wholesale/order-limits/new')}
                          >
                            Create Limit
                          </Button>
                          <Button
                            onClick={() => navigate('/app/wholesale/order-limits')}
                          >
                            View All
                          </Button>
                        </InlineStack>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">Quick Order Form</Text>
                        <Text variant="bodySm" tone="subdued">
                          Create orders quickly using SKUs for phone/email orders
                        </Text>
                        <Button
                          onClick={() => navigate('/app/wholesale/quick-order')}
                        >
                          Create Order
                        </Button>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">Import / Export</Text>
                        <Text variant="bodySm" tone="subdued">
                          Bulk manage customers and pricing rules via CSV
                        </Text>
                        <Button
                          onClick={() => navigate('/app/wholesale/import-export')}
                        >
                          Manage Data
                        </Button>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">Eligibility Checker</Text>
                        <Text variant="bodySm" tone="subdued">
                          Verify customer eligibility for pricing rules
                        </Text>
                        <Button
                          onClick={() => navigate('/app/wholesale/eligibility-checker')}
                        >
                          Check Customer
                        </Button>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">Net Terms (Pay Later)</Text>
                        <Text variant="bodySm" tone="subdued">
                          Manage credit limits and payment terms for retailers
                        </Text>
                        <InlineStack gap="200">
                          <Button
                            variant="primary"
                            onClick={() => navigate('/app/wholesale/net-terms')}
                          >
                            Manage Net Terms
                          </Button>
                        </InlineStack>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">Approval Requests</Text>
                        <Text variant="bodySm" tone="subdued">
                          Review and approve wholesale retailer applications
                        </Text>
                        <Button
                          onClick={() => navigate('/app/wholesale/approvals')}
                        >
                          Review Approvals
                        </Button>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">Product Visibility</Text>
                        <Text variant="bodySm" tone="subdued">
                          Control which products retailers can see and order
                        </Text>
                        <Button
                          onClick={() => navigate('/app/wholesale/product-visibility')}
                        >
                          Manage Visibility
                        </Button>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">Individual Variant Pricing</Text>
                        <Text variant="bodySm" tone="subdued">
                          Set custom pricing for specific product variants
                        </Text>
                        <Button
                          onClick={() => navigate('/app/wholesale/individual-pricing')}
                        >
                          Manage Variants
                        </Button>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">Login to View Prices</Text>
                        <Text variant="bodySm" tone="subdued">
                          Hide pricing from non-logged-in customers
                        </Text>
                        <Button
                          onClick={() => navigate('/app/wholesale/hide-prices')}
                        >
                          Configure
                        </Button>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">Additional Fees</Text>
                        <Text variant="bodySm" tone="subdued">
                          Add processing or handling fees to wholesale orders
                        </Text>
                        <Button
                          onClick={() => navigate('/app/wholesale/additional-fees')}
                        >
                          Manage Fees
                        </Button>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">Sale Clock</Text>
                        <Text variant="bodySm" tone="subdued">
                          Display countdown timer on product pages
                        </Text>
                        <Button
                          onClick={() => navigate('/app/wholesale/sale-clock')}
                        >
                          Configure Timer
                        </Button>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">Analytics & Reports</Text>
                        <Text variant="bodySm" tone="subdued">
                          View wholesale performance and customer insights
                        </Text>
                        <Button
                          onClick={() => navigate('/app/wholesale/analytics')}
                        >
                          View Analytics
                        </Button>
                      </BlockStack>
                    </Card>
                  </Layout.Section>
                </Layout>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Recent Activity */}
        <Layout>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h2">Recent Pricing Rules</Text>
                  <Button
                    plain
                    onClick={() => navigate('/app/wholesale/pricing')}
                  >
                    View all
                  </Button>
                </InlineStack>

                {recentRules.length > 0 ? (
                  <BlockStack gap="300">
                    {recentRules.map((rule) => (
                      <Box
                        key={rule.id}
                        padding="300"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="100">
                            <InlineStack gap="200" blockAlign="center">
                              <Text variant="headingSm" as="h3">
                                {rule.name}
                              </Text>
                              <Badge tone={rule.status === 'published' ? 'success' : 'info'}>
                                {rule.status}
                              </Badge>
                            </InlineStack>
                            <Text variant="bodySm" tone="subdued">
                              {rule.discount_value}% off • {rule.rule_type}
                            </Text>
                          </BlockStack>
                          <Button
                            size="slim"
                            onClick={() => navigate(`/app/wholesale/pricing/${rule.id}`)}
                          >
                            Edit
                          </Button>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                ) : (
                  <Box padding="400">
                    <BlockStack gap="300" inlineAlign="center">
                      <Icon source={CircleInformationMajor} tone="subdued" />
                      <Text tone="subdued" alignment="center">
                        No pricing rules yet. Create your first rule to get started!
                      </Text>
                      <Button
                        variant="primary"
                        onClick={() => navigate('/app/wholesale/pricing/new')}
                      >
                        Create Pricing Rule
                      </Button>
                    </BlockStack>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h2">Recent Customers</Text>
                  <Button
                    plain
                    onClick={() => navigate('/app/wholesale/customers')}
                  >
                    View all
                  </Button>
                </InlineStack>

                {recentCustomers.length > 0 ? (
                  <BlockStack gap="300">
                    {recentCustomers.map((customer) => (
                      <Box
                        key={customer.id}
                        padding="300"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="100">
                            <InlineStack gap="200" blockAlign="center">
                              <Text variant="headingSm" as="h3">
                                {customer.email}
                              </Text>
                              <Badge tone={customer.wholesale_approved ? 'success' : 'warning'}>
                                {customer.wholesale_approved ? 'Approved' : 'Pending'}
                              </Badge>
                            </InlineStack>
                            <Text variant="bodySm" tone="subdued">
                              {customer.order_count} orders • ${parseFloat(customer.total_spent).toFixed(2)}
                            </Text>
                          </BlockStack>
                          <Button
                            size="slim"
                            onClick={() => navigate(`/app/wholesale/customers/${customer.id}`)}
                          >
                            View
                          </Button>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                ) : (
                  <Box padding="400">
                    <BlockStack gap="300" inlineAlign="center">
                      <Icon source={CircleInformationMajor} tone="subdued" />
                      <Text tone="subdued" alignment="center">
                        No wholesale customers yet. Add customers to start managing wholesale access!
                      </Text>
                      <Button
                        variant="primary"
                        onClick={() => navigate('/app/wholesale/customers/new')}
                      >
                        Add Customer
                      </Button>
                    </BlockStack>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Getting Started Guide */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">Getting Started with Wholesale</Text>
                <BlockStack gap="200">
                  <Text>1. Create pricing rules to define wholesale discounts</Text>
                  <Text>2. Add or import wholesale customers with appropriate tags</Text>
                  <Text>3. Configure shipping rules for wholesale orders</Text>
                  <Text>4. Test in Test Mode before switching to Live Mode</Text>
                  <Text>5. Monitor customer orders and adjust rules as needed</Text>
                </BlockStack>
                <InlineStack gap="200">
                  <Button
                    onClick={() => navigate('/app/wholesale/pricing/new')}
                  >
                    Create First Rule
                  </Button>
                  <Button
                    plain
                    onClick={() => window.open('https://docs.shopify.com', '_blank')}
                  >
                    View Documentation
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
