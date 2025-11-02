// Retailer Account Management
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  Divider,
  Box
} from "@shopify/polaris";
import { RetailerAuth } from "../services/retailer-auth.server";
import { query } from "../db/connection.server";

export const loader = async ({ request }) => {
  const { customer, session } = await RetailerAuth.requireRetailer(request);
  const shopDomain = session.get("shopDomain");

  // Get full retailer data
  const retailerData = await RetailerAuth.getRetailerData(customer.id, shopDomain);

  // Get order statistics
  const statsResult = await query(
    `SELECT
       COUNT(*) as total_orders,
       COALESCE(SUM(order_total), 0) as total_spent,
       COALESCE(AVG(order_total), 0) as average_order
     FROM wholesale_customers
     WHERE id = $1`,
    [customer.id]
  );

  return json({
    retailer: retailerData,
    stats: statsResult.rows[0]
  });
};

export default function RetailerAccount() {
  const { retailer, stats } = useLoaderData();
  const navigate = useNavigate();

  const customerTags = JSON.parse(retailer.customer_tags || '[]');
  const hasNetTerms = retailer.netTerms !== null;

  return (
    <Page
      title="My Account"
      subtitle="Manage your wholesale account settings"
      backAction={{ onAction: () => navigate('/retailer') }}
      secondaryActions={[
        {
          content: 'Logout',
          destructive: true,
          onAction: () => navigate('/retailer/logout')
        }
      ]}
    >
      <Layout>
        <Layout.Section>
          {/* Account Information */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Account Information</Text>

              <InlineStack gap="400" wrap={false}>
                <Box minWidth="50%">
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Email Address</Text>
                    <Text variant="bodyMd">{retailer.email}</Text>
                  </BlockStack>
                </Box>
                <Box minWidth="50%">
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Shopify Customer ID</Text>
                    <Text variant="bodyMd">{retailer.shopify_customer_id}</Text>
                  </BlockStack>
                </Box>
              </InlineStack>

              <InlineStack gap="400" wrap={false}>
                <Box minWidth="50%">
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Account Status</Text>
                    <Badge tone="success">Approved for Wholesale</Badge>
                  </BlockStack>
                </Box>
                <Box minWidth="50%">
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Member Since</Text>
                    <Text variant="bodyMd">
                      {new Date(retailer.created_at).toLocaleDateString()}
                    </Text>
                  </BlockStack>
                </Box>
              </InlineStack>

              {retailer.approval_date && (
                <InlineStack gap="400" wrap={false}>
                  <Box minWidth="50%">
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued">Approved Date</Text>
                      <Text variant="bodyMd">
                        {new Date(retailer.approval_date).toLocaleDateString()}
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineStack>
              )}
            </BlockStack>
          </Card>

          {/* Account Type / Tags */}
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Account Type</Text>
              <Text variant="bodySm" tone="subdued">
                Your account classification determines which pricing rules apply to you.
              </Text>
              <InlineStack gap="200">
                {customerTags.length > 0 ? (
                  customerTags.map(tag => (
                    <Badge key={tag} tone="info">{tag}</Badge>
                  ))
                ) : (
                  <Text tone="subdued">No special tags assigned</Text>
                )}
              </InlineStack>
            </BlockStack>
          </Card>

          {/* Order Statistics */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Your Statistics</Text>

              <Layout>
                <Layout.Section variant="oneThird">
                  <Card background="bg-surface-secondary">
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued">Total Orders</Text>
                      <Text variant="heading2xl" as="p">{stats.total_orders}</Text>
                    </BlockStack>
                  </Card>
                </Layout.Section>

                <Layout.Section variant="oneThird">
                  <Card background="bg-surface-secondary">
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued">Total Spent</Text>
                      <Text variant="heading2xl" as="p">
                        ${parseFloat(stats.total_spent).toFixed(2)}
                      </Text>
                    </BlockStack>
                  </Card>
                </Layout.Section>

                <Layout.Section variant="oneThird">
                  <Card background="bg-surface-secondary">
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued">Average Order</Text>
                      <Text variant="heading2xl" as="p">
                        ${parseFloat(stats.average_order).toFixed(2)}
                      </Text>
                    </BlockStack>
                  </Card>
                </Layout.Section>
              </Layout>
            </BlockStack>
          </Card>

          {/* Payment Terms */}
          {hasNetTerms && (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Payment Terms</Text>
                  <Badge tone={retailer.netTerms.status === 'active' ? 'success' : 'warning'}>
                    {retailer.netTerms.status}
                  </Badge>
                </InlineStack>

                <Divider />

                <Layout>
                  <Layout.Section variant="oneThird">
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued">Payment Terms</Text>
                      <Text variant="headingMd" as="p">Net {retailer.netTerms.net_days} days</Text>
                    </BlockStack>
                  </Layout.Section>

                  <Layout.Section variant="oneThird">
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued">Credit Limit</Text>
                      <Text variant="headingMd" as="p">
                        ${parseFloat(retailer.netTerms.credit_limit).toFixed(2)}
                      </Text>
                    </BlockStack>
                  </Layout.Section>

                  <Layout.Section variant="oneThird">
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued">Available Credit</Text>
                      <Text variant="headingMd" as="p" tone="success">
                        ${parseFloat(retailer.netTerms.available_credit).toFixed(2)}
                      </Text>
                    </BlockStack>
                  </Layout.Section>
                </Layout>

                {parseFloat(retailer.netTerms.current_balance) > 0 && (
                  <>
                    <Divider />
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued">Current Balance Due</Text>
                      <Text variant="headingLg" as="p" tone="critical">
                        ${parseFloat(retailer.netTerms.current_balance).toFixed(2)}
                      </Text>
                      <Text variant="bodySm" tone="subdued">
                        Please ensure payment is made within the agreed terms.
                      </Text>
                    </BlockStack>
                  </>
                )}
              </BlockStack>
            </Card>
          )}
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Quick Actions</Text>
              <Button fullWidth onClick={() => navigate('/retailer/new-order')}>
                Create New Order
              </Button>
              <Button fullWidth onClick={() => navigate('/retailer/orders')}>
                View Order History
              </Button>
              <Button fullWidth onClick={() => navigate('/retailer/catalog')}>
                Browse Catalog
              </Button>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Need Help?</Text>
              <Text variant="bodySm">
                For account changes, pricing questions, or support, please contact:
              </Text>
              <Text variant="bodySm">
                <strong>Email:</strong> support@{retailer.shop_domain}
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Session Information</Text>
              <Text variant="bodySm" tone="subdued">
                You are logged into {retailer.shop_domain}
              </Text>
              <Button fullWidth destructive onClick={() => navigate('/retailer/logout')}>
                Logout
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
