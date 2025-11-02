// Admin Dashboard - Main Index Route
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
  Banner
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { CategoryModel } from "../models/category.server";
import { ItemModel } from "../models/item.server";
import { ShopModel } from "../models/shop.server";
import { BillingService } from "../services/billing.server";
import { WholesaleModel } from "../models/wholesale.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Get subscription status
  const subscription = await ShopModel.getSubscription(shopDomain);

  // Get plan details server-side
  const planDetails = subscription?.subscription_plan 
    ? BillingService.getPlanDetails(subscription.subscription_plan)
    : null;

  // Get statistics
  const categories = await CategoryModel.findAll(shopDomain);
  const itemStats = await ItemModel.findAll(shopDomain, { limit: 1 });

  // Get wholesale statistics
  const wholesaleStats = await WholesaleModel.getStatistics(shopDomain);

  const stats = {
    totalCategories: categories.length,
    totalItems: itemStats.total,
    activeCategories: categories.filter(c => c.is_active).length
  };

  return json({
    stats,
    wholesaleStats,
    subscription,
    planDetails,
    categories: categories.slice(0, 5), // Show only first 5 on dashboard
  });
};

export default function Index() {
  const { stats, wholesaleStats, subscription, planDetails, categories } = useLoaderData();
  const navigate = useNavigate();

  const hasActiveSubscription = subscription?.subscription_status === 'active';
  const currentPlan = hasActiveSubscription ? planDetails : null;

  return (
    <Page
      title="Collectible Tracker Dashboard"
      primaryAction={{
        content: 'View All Categories',
        onAction: () => navigate('/app/categories')
      }}
      secondaryActions={[
        {
          content: 'Manage Subscription',
          onAction: () => navigate('/app/billing')
        }
      ]}
    >
      <BlockStack gap="500">
        {!hasActiveSubscription && (
          <Banner
            title="Subscription Required"
            status="warning"
            action={{
              content: 'Choose Plan',
              onAction: () => navigate('/app/billing')
            }}
          >
            <p>
              Please select a subscription plan to start tracking your collectibles.
              Plans start at just $9.99/month for up to 2 categories.
            </p>
          </Banner>
        )}

        {hasActiveSubscription && (
          <Banner status="success">
            <p>
              <strong>{currentPlan?.displayName}</strong> - {currentPlan?.description}
            </p>
          </Banner>
        )}

        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">Categories</Text>
                <Text variant="heading2xl" as="p">{stats.totalCategories}</Text>
                <Text variant="bodySm" tone="subdued">
                  {stats.activeCategories} active
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">Total Items</Text>
                <Text variant="heading2xl" as="p">{stats.totalItems}</Text>
                <Text variant="bodySm" tone="subdued">
                  Collectibles tracked
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">Subscription</Text>
                <Text variant="heading2xl" as="p">
                  {hasActiveSubscription ? (
                    <Badge tone="success">Active</Badge>
                  ) : (
                    <Badge tone="warning">Inactive</Badge>
                  )}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  {currentPlan ? currentPlan.displayName : 'No plan selected'}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Wholesale Portal Tile */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Wholesale Portal</Text>
                <Text variant="bodyMd" tone="subdued">
                  Manage wholesale pricing, customers, and fulfillment for comic shops and online retailers.
                </Text>

                <Layout>
                  <Layout.Section variant="oneThird">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h2">Pricing Rules</Text>
                        <Text variant="heading2xl" as="p">{wholesaleStats?.active_pricing_rules || 0}</Text>
                        <Text variant="bodySm" tone="subdued">Active rules</Text>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneThird">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h2">Customers</Text>
                        <Text variant="heading2xl" as="p">{wholesaleStats?.approved_customers || 0}</Text>
                        <Text variant="bodySm" tone="subdued">
                          {wholesaleStats?.total_customers || 0} total
                        </Text>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneThird">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h2">Revenue</Text>
                        <Text variant="heading2xl" as="p">
                          ${parseFloat(wholesaleStats?.total_revenue || 0).toFixed(2)}
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                          {wholesaleStats?.total_orders || 0} orders
                        </Text>
                      </BlockStack>
                    </Card>
                  </Layout.Section>
                </Layout>

                <Button variant="primary" onClick={() => navigate('/app/wholesale')}>
                  Open Wholesale Portal
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h2">Recent Categories</Text>
                  <Button onClick={() => navigate('/app/categories')}>
                    View All
                  </Button>
                </InlineStack>

                {categories.length > 0 ? (
                  <BlockStack gap="300">
                    {categories.map((category) => (
                      <Card key={category.id}>
                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="100">
                            <Text variant="headingSm" as="h3">
                              {category.name}
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                              {category.item_count} items
                            </Text>
                          </BlockStack>
                          <Button
                            onClick={() => navigate(`/app/categories/${category.id}/items`)}
                          >
                            View Items
                          </Button>
                        </InlineStack>
                      </Card>
                    ))}
                  </BlockStack>
                ) : (
                  <BlockStack gap="300">
                    <Text tone="subdued">
                      No categories yet. Create your first category to get started!
                    </Text>
                    {hasActiveSubscription && (
                      <Button
                        variant="primary"
                        onClick={() => navigate('/app/categories/new')}
                      >
                        Create Category
                      </Button>
                    )}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">Quick Start Guide</Text>
                <BlockStack gap="200">
                  <Text>1. Choose a subscription plan based on your needs</Text>
                  <Text>2. Create categories for your collectibles</Text>
                  <Text>3. Add items with unique serial numbers and images</Text>
                  <Text>4. Add the verification widget to your storefront</Text>
                  <Text>5. Customers can verify their collectibles using serial numbers</Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
