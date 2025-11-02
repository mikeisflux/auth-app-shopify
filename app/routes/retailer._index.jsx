// Retailer Portal Dashboard
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
  Box,
  Icon,
  Divider
} from "@shopify/polaris";
import {
  OrdersMajor,
  ProductsMajor,
  ProfileMajor,
  CirclePlusMajor,
  NoteMajor
} from "@shopify/polaris-icons";
import { RetailerAuth } from "../services/retailer-auth.server";
import { query } from "../db/connection.server";

export const loader = async ({ request }) => {
  const { customer, session } = await RetailerAuth.requireRetailer(request);
  const shopDomain = session.get("shopDomain");

  // Get retailer data with net terms
  const retailerData = await RetailerAuth.getRetailerData(customer.id, shopDomain);

  // Get recent orders
  const ordersResult = await query(
    `SELECT COUNT(*) as order_count, COALESCE(SUM(order_total), 0) as total_spent
     FROM wholesale_customers
     WHERE id = $1`,
    [customer.id]
  );

  // Get pricing rules applicable to this customer
  const customerTags = JSON.parse(retailerData.customer_tags || '[]');
  const pricingRulesResult = await query(
    `SELECT pr.*
     FROM pricing_rules pr
     INNER JOIN shops s ON pr.shop_id = s.id
     WHERE s.shop_domain = $1
       AND pr.status = 'published'
       AND (
         pr.customer_selection_type = 'all'
         OR (pr.customer_selection_type = 'tags' AND pr.customer_tags && $2::jsonb)
       )
     LIMIT 5`,
    [shopDomain, JSON.stringify(customerTags)]
  );

  return json({
    retailer: retailerData,
    stats: ordersResult.rows[0],
    pricingRules: pricingRulesResult.rows || []
  });
};

export default function RetailerPortal() {
  const { retailer, stats, pricingRules } = useLoaderData();
  const navigate = useNavigate();

  const hasNetTerms = retailer.netTerms !== null;
  const creditUtilization = hasNetTerms
    ? (parseFloat(retailer.netTerms.current_balance) / parseFloat(retailer.netTerms.credit_limit) * 100).toFixed(1)
    : 0;

  return (
    <Page
      title={`Welcome, ${retailer.email.split('@')[0]}`}
      subtitle="Your Wholesale Portal"
      secondaryActions={[
        {
          content: 'My Account',
          icon: ProfileMajor,
          onAction: () => navigate('/retailer/account')
        },
        {
          content: 'Logout',
          onAction: () => navigate('/retailer/logout')
        }
      ]}
    >
      <BlockStack gap="500">
        {/* Account Status Banner */}
        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Text variant="headingMd" as="h2">Account Status</Text>
                <Badge tone="success">Approved</Badge>
              </InlineStack>
              <Text variant="bodySm" tone="subdued">
                Email: {retailer.email}
              </Text>
            </BlockStack>
            <Button variant="primary" icon={CirclePlusMajor} onClick={() => navigate('/retailer/new-order')}>
              Create New Order
            </Button>
          </InlineStack>
        </Card>

        {/* Statistics Cards */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Total Orders</Text>
                  <Icon source={OrdersMajor} tone="base" />
                </InlineStack>
                <Text variant="heading2xl" as="p">{stats.order_count || 0}</Text>
                <Text variant="bodySm" tone="subdued">Lifetime orders</Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Total Spent</Text>
                  <Icon source={ProductsMajor} tone="base" />
                </InlineStack>
                <Text variant="heading2xl" as="p">
                  ${parseFloat(stats.total_spent || 0).toFixed(2)}
                </Text>
                <Text variant="bodySm" tone="subdued">Lifetime value</Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Average Order</Text>
                  <Icon source={NoteMajor} tone="base" />
                </InlineStack>
                <Text variant="heading2xl" as="p">
                  ${stats.order_count > 0
                    ? (parseFloat(stats.total_spent) / parseInt(stats.order_count)).toFixed(2)
                    : '0.00'}
                </Text>
                <Text variant="bodySm" tone="subdued">Per order</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Net Terms Card (if applicable) */}
        {hasNetTerms && (
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">Payment Terms</Text>
                <Badge tone={retailer.netTerms.status === 'active' ? 'success' : 'warning'}>
                  {retailer.netTerms.status}
                </Badge>
              </InlineStack>

              <Layout>
                <Layout.Section variant="oneThird">
                  <Card background="bg-surface-secondary">
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued">Credit Limit</Text>
                      <Text variant="headingLg" as="p">
                        ${parseFloat(retailer.netTerms.credit_limit).toFixed(2)}
                      </Text>
                    </BlockStack>
                  </Card>
                </Layout.Section>

                <Layout.Section variant="oneThird">
                  <Card background="bg-surface-secondary">
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued">Available Credit</Text>
                      <Text variant="headingLg" as="p" tone="success">
                        ${parseFloat(retailer.netTerms.available_credit).toFixed(2)}
                      </Text>
                    </BlockStack>
                  </Card>
                </Layout.Section>

                <Layout.Section variant="oneThird">
                  <Card background="bg-surface-secondary">
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued">Current Balance</Text>
                      <Text variant="headingLg" as="p" tone={parseFloat(retailer.netTerms.current_balance) > 0 ? 'critical' : 'subdued'}>
                        ${parseFloat(retailer.netTerms.current_balance).toFixed(2)}
                      </Text>
                    </BlockStack>
                  </Card>
                </Layout.Section>
              </Layout>

              <Box>
                <Text variant="bodySm">
                  Payment Terms: <strong>Net {retailer.netTerms.net_days} days</strong>
                  {creditUtilization > 0 && ` • Credit Utilization: ${creditUtilization}%`}
                </Text>
              </Box>
            </BlockStack>
          </Card>
        )}

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
                        <Icon source={CirclePlusMajor} tone="base" />
                        <Text variant="headingMd" as="h3">Place New Order</Text>
                        <Text variant="bodySm" tone="subdued">
                          Browse products and create a new wholesale order with your pricing
                        </Text>
                        <Button
                          variant="primary"
                          fullWidth
                          onClick={() => navigate('/retailer/new-order')}
                        >
                          Create Order
                        </Button>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <Icon source={OrdersMajor} tone="base" />
                        <Text variant="headingMd" as="h3">Order History</Text>
                        <Text variant="bodySm" tone="subdued">
                          View your past orders, invoices, and order status
                        </Text>
                        <Button
                          fullWidth
                          onClick={() => navigate('/retailer/orders')}
                        >
                          View Orders
                        </Button>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <Icon source={ProductsMajor} tone="base" />
                        <Text variant="headingMd" as="h3">Browse Catalog</Text>
                        <Text variant="bodySm" tone="subdued">
                          View available products with your wholesale pricing
                        </Text>
                        <Button
                          fullWidth
                          onClick={() => navigate('/retailer/catalog')}
                        >
                          View Catalog
                        </Button>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <Icon source={ProfileMajor} tone="base" />
                        <Text variant="headingMd" as="h3">Account Settings</Text>
                        <Text variant="bodySm" tone="subdued">
                          Update your account information and preferences
                        </Text>
                        <Button
                          fullWidth
                          onClick={() => navigate('/retailer/account')}
                        >
                          Manage Account
                        </Button>
                      </BlockStack>
                    </Card>
                  </Layout.Section>
                </Layout>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Your Pricing Rules */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">Your Wholesale Pricing</Text>

            {pricingRules.length > 0 ? (
              <BlockStack gap="300">
                {pricingRules.map((rule) => (
                  <Box
                    key={rule.id}
                    padding="300"
                    background="bg-surface-secondary"
                    borderRadius="200"
                  >
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text variant="headingSm" as="h3">{rule.name}</Text>
                        <Text variant="bodySm" tone="subdued">
                          {rule.discount_value}% discount • {rule.rule_type === 'global' ? 'All products' : 'Selected products'}
                        </Text>
                      </BlockStack>
                      <Badge tone="success">Active</Badge>
                    </InlineStack>
                  </Box>
                ))}
              </BlockStack>
            ) : (
              <Text tone="subdued">No special pricing rules currently active for your account.</Text>
            )}
          </BlockStack>
        </Card>

        {/* Customer Tags */}
        {retailer.customer_tags && JSON.parse(retailer.customer_tags).length > 0 && (
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Your Account Type</Text>
              <InlineStack gap="200">
                {JSON.parse(retailer.customer_tags).map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </InlineStack>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
