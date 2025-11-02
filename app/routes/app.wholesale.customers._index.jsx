// Wholesale Customers Management
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
  EmptyState,
  Filters
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import { WholesaleModel } from "../models/wholesale.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const approved = url.searchParams.get('approved');

  const filters = {};
  if (search) filters.search = search;
  if (approved !== null && approved !== '') filters.approved = approved === 'true';

  const customers = await WholesaleModel.getWholesaleCustomers(shopDomain, filters);

  return json({ customers });
};

export default function WholesaleCustomers() {
  const { customers } = useLoaderData();
  const navigate = useNavigate();

  const [searchValue, setSearchValue] = useState('');

  const handleSearchChange = useCallback((value) => {
    setSearchValue(value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchValue('');
  }, []);

  const rows = customers.map((customer) => [
    customer.email,
    <Badge key={customer.id} tone={customer.wholesale_approved ? 'success' : 'warning'}>
      {customer.wholesale_approved ? 'Approved' : 'Pending'}
    </Badge>,
    JSON.parse(customer.customer_tags || '[]').join(', ') || 'None',
    customer.order_count,
    `$${parseFloat(customer.total_spent).toFixed(2)}`,
    <Button
      key={`view-${customer.id}`}
      size="slim"
      onClick={() => navigate(`/app/wholesale/customers/${customer.id}`)}
    >
      View
    </Button>
  ]);

  return (
    <Page
      title="Wholesale Customers"
      subtitle="Manage customer approvals and wholesale access"
      backAction={{ onAction: () => navigate('/app/wholesale') }}
      primaryAction={{
        content: 'Add Customer',
        onAction: () => navigate('/app/wholesale/customers/new')
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            {customers.length > 0 ? (
              <>
                <BlockStack gap="400">
                  <Filters
                    queryValue={searchValue}
                    onQueryChange={handleSearchChange}
                    onQueryClear={handleClearSearch}
                    filters={[]}
                  />
                  <DataTable
                    columnContentTypes={['text', 'text', 'text', 'numeric', 'numeric', 'text']}
                    headings={['Email', 'Status', 'Tags', 'Orders', 'Total Spent', 'Actions']}
                    rows={rows}
                  />
                </BlockStack>
              </>
            ) : (
              <EmptyState
                heading="No wholesale customers yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Add customers to grant them wholesale access and pricing</p>
                <Button
                  variant="primary"
                  onClick={() => navigate('/app/wholesale/customers/new')}
                >
                  Add Customer
                </Button>
              </EmptyState>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
