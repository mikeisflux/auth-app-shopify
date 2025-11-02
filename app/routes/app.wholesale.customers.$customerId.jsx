// View/Edit Wholesale Customer
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigate, useSubmit } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Checkbox,
  Button,
  BlockStack,
  InlineStack,
  Banner,
  Text,
  Badge,
  Box,
  Divider
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { WholesaleModel } from "../models/wholesale.server";
import { ShopifyAPIService } from "../services/shopify-api.server";

export const loader = async ({ params, request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const { customerId } = params;

  const customer = await WholesaleModel.getWholesaleCustomerById(customerId, shopDomain);

  if (!customer) {
    throw new Response("Customer not found", { status: 404 });
  }

  // Try to get Shopify customer data for additional info
  let shopifyCustomer = null;
  try {
    shopifyCustomer = await ShopifyAPIService.getCustomer(admin, customer.shopify_customer_id);
  } catch (error) {
    console.log('Could not fetch Shopify customer:', error.message);
  }

  return json({ customer, shopifyCustomer });
};

export const action = async ({ params, request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const { customerId } = params;

  const formData = await request.formData();
  const action = formData.get('_action');

  try {
    if (action === 'delete') {
      await WholesaleModel.deleteWholesaleCustomer(customerId, shopDomain);
      return redirect('/app/wholesale/customers');
    }

    if (action === 'sync_tags') {
      // Sync tags from Shopify
      const shopifyCustomerId = parseInt(formData.get('shopifyCustomerId'));
      const shopifyCustomer = await ShopifyAPIService.getCustomer(admin, shopifyCustomerId);

      await WholesaleModel.updateWholesaleCustomer(customerId, shopDomain, {
        customerTags: shopifyCustomer.tags
      });

      return json({ success: true, message: 'Tags synced from Shopify!' });
    }

    if (action === 'update_shopify_tags') {
      // Update tags in Shopify
      const shopifyCustomerId = parseInt(formData.get('shopifyCustomerId'));
      const tags = formData.get('customerTags')?.split(',').map(t => t.trim()).filter(Boolean) || [];

      await ShopifyAPIService.updateCustomerTags(admin, shopifyCustomerId, tags);

      await WholesaleModel.updateWholesaleCustomer(customerId, shopDomain, {
        customerTags: tags
      });

      return json({ success: true, message: 'Tags updated in Shopify!' });
    }

    // Regular update
    const wholesaleApproved = formData.get('wholesaleApproved') === 'true';
    const customerTags = formData.get('customerTags')?.split(',').map(t => t.trim()).filter(Boolean) || [];
    const notes = formData.get('notes');

    await WholesaleModel.updateWholesaleCustomer(customerId, shopDomain, {
      wholesaleApproved,
      approvedBy: wholesaleApproved ? session.shop : null,
      customerTags,
      notes
    });

    return json({ success: true, message: 'Customer updated successfully!' });
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function CustomerDetail() {
  const { customer, shopifyCustomer } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [wholesaleApproved, setWholesaleApproved] = useState(customer.wholesale_approved);
  const [customerTags, setCustomerTags] = useState(
    JSON.parse(customer.customer_tags || '[]').join(', ')
  );
  const [notes, setNotes] = useState(customer.notes || '');

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append('wholesaleApproved', wholesaleApproved);
    formData.append('customerTags', customerTags);
    formData.append('notes', notes);
    submit(formData, { method: 'post' });
  };

  const handleSyncTags = () => {
    const formData = new FormData();
    formData.append('_action', 'sync_tags');
    formData.append('shopifyCustomerId', customer.shopify_customer_id);
    submit(formData, { method: 'post' });
  };

  const handleUpdateShopifyTags = () => {
    if (confirm('This will update tags in Shopify. Continue?')) {
      const formData = new FormData();
      formData.append('_action', 'update_shopify_tags');
      formData.append('shopifyCustomerId', customer.shopify_customer_id);
      formData.append('customerTags', customerTags);
      submit(formData, { method: 'post' });
    }
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this customer? This cannot be undone.')) {
      const formData = new FormData();
      formData.append('_action', 'delete');
      submit(formData, { method: 'post' });
    }
  };

  return (
    <Page
      title={customer.email}
      subtitle="Wholesale customer details"
      backAction={{ onAction: () => navigate('/app/wholesale/customers') }}
      primaryAction={{
        content: 'Save Changes',
        onAction: handleSubmit
      }}
      secondaryActions={[
        {
          content: 'Sync Tags from Shopify',
          onAction: handleSyncTags
        },
        {
          content: 'Update Shopify Tags',
          onAction: handleUpdateShopifyTags
        },
        {
          content: 'Delete Customer',
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

          {/* Customer Info */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Customer Information</Text>

              <InlineStack gap="400" wrap={false}>
                <Box minWidth="50%">
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Email</Text>
                    <Text variant="bodyMd">{customer.email}</Text>
                  </BlockStack>
                </Box>
                <Box minWidth="50%">
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Shopify Customer ID</Text>
                    <Text variant="bodyMd">{customer.shopify_customer_id}</Text>
                  </BlockStack>
                </Box>
              </InlineStack>

              <InlineStack gap="400" wrap={false}>
                <Box minWidth="50%">
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Status</Text>
                    <Badge tone={customer.wholesale_approved ? 'success' : 'warning'}>
                      {customer.wholesale_approved ? 'Approved' : 'Pending Approval'}
                    </Badge>
                  </BlockStack>
                </Box>
                <Box minWidth="50%">
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Member Since</Text>
                    <Text variant="bodyMd">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </Text>
                  </BlockStack>
                </Box>
              </InlineStack>

              {customer.approval_date && (
                <InlineStack gap="400" wrap={false}>
                  <Box minWidth="50%">
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued">Approved Date</Text>
                      <Text variant="bodyMd">
                        {new Date(customer.approval_date).toLocaleDateString()}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box minWidth="50%">
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued">Approved By</Text>
                      <Text variant="bodyMd">{customer.approved_by || 'System'}</Text>
                    </BlockStack>
                  </Box>
                </InlineStack>
              )}
            </BlockStack>
          </Card>

          {/* Shopify Data */}
          {shopifyCustomer && (
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Shopify Account Data</Text>

                <InlineStack gap="400" wrap={false}>
                  <Box minWidth="50%">
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued">Name</Text>
                      <Text variant="bodyMd">
                        {shopifyCustomer.first_name} {shopifyCustomer.last_name}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box minWidth="50%">
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued">Total Orders</Text>
                      <Text variant="bodyMd">{shopifyCustomer.orders_count}</Text>
                    </BlockStack>
                  </Box>
                </InlineStack>

                <InlineStack gap="400" wrap={false}>
                  <Box minWidth="50%">
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued">Total Spent (Shopify)</Text>
                      <Text variant="bodyMd">
                        ${parseFloat(shopifyCustomer.total_spent).toFixed(2)}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box minWidth="50%">
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued">Shopify Tags</Text>
                      <Text variant="bodyMd">
                        {shopifyCustomer.tags.join(', ') || 'None'}
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineStack>
              </BlockStack>
            </Card>
          )}

          {/* Edit Form */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Wholesale Settings</Text>

              <FormLayout>
                <Checkbox
                  label="Approve for wholesale access"
                  checked={wholesaleApproved}
                  onChange={setWholesaleApproved}
                  helpText="Grant this customer wholesale pricing and access"
                />

                <TextField
                  label="Customer Tags"
                  value={customerTags}
                  onChange={setCustomerTags}
                  placeholder="wholesale, tier1, vip"
                  autoComplete="off"
                  helpText="Comma-separated tags. These determine which pricing rules apply."
                />

                <TextField
                  label="Internal Notes"
                  value={notes}
                  onChange={setNotes}
                  placeholder="Notes about this customer..."
                  multiline={4}
                  autoComplete="off"
                  helpText="Internal notes (not visible to customer)"
                />
              </FormLayout>
            </BlockStack>
          </Card>

          {/* Statistics */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Wholesale Statistics</Text>

              <InlineStack gap="400" wrap={false}>
                <Box minWidth="33%">
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Wholesale Orders</Text>
                    <Text variant="heading2xl" as="p">{customer.order_count}</Text>
                  </BlockStack>
                </Box>
                <Box minWidth="33%">
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Wholesale Revenue</Text>
                    <Text variant="heading2xl" as="p">
                      ${parseFloat(customer.total_spent).toFixed(2)}
                    </Text>
                  </BlockStack>
                </Box>
                <Box minWidth="33%">
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Average Order</Text>
                    <Text variant="heading2xl" as="p">
                      ${customer.order_count > 0
                        ? (parseFloat(customer.total_spent) / customer.order_count).toFixed(2)
                        : '0.00'
                      }
                    </Text>
                  </BlockStack>
                </Box>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Quick Actions</Text>
              <Button
                fullWidth
                onClick={() => navigate('/app/wholesale/eligibility-checker')}
              >
                Check Eligibility
              </Button>
              <Button
                fullWidth
                onClick={() => navigate('/app/wholesale/quick-order')}
              >
                Create Order
              </Button>
              <Button
                fullWidth
                url={`https://admin.shopify.com/store/${customer.email.split('@')[0]}/customers/${customer.shopify_customer_id}`}
                external
              >
                View in Shopify
              </Button>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Timeline</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  <strong>Created:</strong> {new Date(customer.created_at).toLocaleString()}
                </Text>
                <Text variant="bodySm">
                  <strong>Updated:</strong> {new Date(customer.updated_at).toLocaleString()}
                </Text>
                {customer.approval_date && (
                  <Text variant="bodySm">
                    <strong>Approved:</strong> {new Date(customer.approval_date).toLocaleString()}
                  </Text>
                )}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
