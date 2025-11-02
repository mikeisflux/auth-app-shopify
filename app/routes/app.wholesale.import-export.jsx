// Import/Export for Wholesale Data
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigate, useSubmit } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  Button,
  BlockStack,
  InlineStack,
  Banner,
  Text,
  DropZone,
  Select,
  LegacyStack
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { WholesaleModel } from "../models/wholesale.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return json({ shop: session.shop });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const formData = await request.formData();
  const actionType = formData.get('actionType');

  try {
    if (actionType === 'export_customers') {
      const customers = await WholesaleModel.getWholesaleCustomers(shopDomain, { limit: 10000 });

      // Generate CSV
      const csv = generateCustomerCSV(customers);

      return json({
        success: true,
        download: {
          filename: `wholesale-customers-${Date.now()}.csv`,
          content: csv,
          type: 'text/csv'
        }
      });
    }

    if (actionType === 'export_pricing') {
      const rules = await WholesaleModel.getPricingRules(shopDomain);

      // Generate CSV
      const csv = generatePricingCSV(rules);

      return json({
        success: true,
        download: {
          filename: `pricing-rules-${Date.now()}.csv`,
          content: csv,
          type: 'text/csv'
        }
      });
    }

    if (actionType === 'import_customers') {
      const csvData = formData.get('csvData');
      const result = await importCustomers(shopDomain, csvData);

      return json({
        success: true,
        message: `Imported ${result.success} customers successfully. ${result.failed} failed.`,
        details: result
      });
    }

    return json({ error: 'Unknown action type' }, { status: 400 });
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

function generateCustomerCSV(customers) {
  const headers = ['Email', 'Shopify Customer ID', 'Approved', 'Tags', 'Order Count', 'Total Spent', 'Notes'];
  const rows = customers.map(c => [
    c.email,
    c.shopify_customer_id,
    c.wholesale_approved ? 'Yes' : 'No',
    JSON.parse(c.customer_tags || '[]').join(';'),
    c.order_count,
    c.total_spent,
    (c.notes || '').replace(/,/g, ';')
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

function generatePricingCSV(rules) {
  const headers = ['Name', 'Type', 'Status', 'Discount Type', 'Discount Value', 'Customer Tags', 'Product Scope'];
  const rows = rules.map(r => [
    r.name,
    r.rule_type,
    r.status,
    r.discount_type,
    r.discount_value,
    JSON.parse(r.customer_tags || '[]').join(';'),
    r.product_scope
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

async function importCustomers(shopDomain, csvData) {
  const lines = csvData.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',');

  let success = 0;
  let failed = 0;
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = lines[i].split(',');
      const customer = {
        email: values[0],
        shopifyCustomerId: parseInt(values[1]),
        wholesaleApproved: values[2].toLowerCase() === 'yes',
        customerTags: values[3] ? values[3].split(';') : [],
        notes: values[6] || ''
      };

      await WholesaleModel.createWholesaleCustomer(shopDomain, customer);
      success++;
    } catch (error) {
      failed++;
      errors.push(`Line ${i + 1}: ${error.message}`);
    }
  }

  return { success, failed, errors };
}

export default function ImportExport() {
  const { shop } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [importType, setImportType] = useState('customers');
  const [file, setFile] = useState(null);

  const handleFileDrop = useCallback((_dropFiles, acceptedFiles) => {
    setFile(acceptedFiles[0]);
  }, []);

  const handleExport = (type) => {
    const formData = new FormData();
    formData.append('actionType', type);
    submit(formData, { method: 'post' });
  };

  const handleImport = async () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const formData = new FormData();
      formData.append('actionType', `import_${importType}`);
      formData.append('csvData', e.target.result);
      submit(formData, { method: 'post' });
    };
    reader.readAsText(file);
  };

  // Trigger download if export successful
  if (actionData?.success && actionData?.download) {
    const blob = new Blob([actionData.download.content], { type: actionData.download.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = actionData.download.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Page
      title="Import / Export"
      subtitle="Bulk manage wholesale customers and pricing rules"
      backAction={{ onAction: () => navigate('/app/wholesale') }}
    >
      <Layout>
        <Layout.Section>
          {actionData?.success && actionData?.message && (
            <Banner status="success">
              <p>{actionData.message}</p>
            </Banner>
          )}

          {actionData?.error && (
            <Banner status="critical">
              <p>{actionData.error}</p>
            </Banner>
          )}

          {/* Export Section */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Export Data</Text>

              <Text variant="bodySm" tone="subdued">
                Download your wholesale data as CSV files for backup or editing
              </Text>

              <InlineStack gap="200">
                <Button
                  onClick={() => handleExport('export_customers')}
                >
                  Export Customers
                </Button>
                <Button
                  onClick={() => handleExport('export_pricing')}
                >
                  Export Pricing Rules
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>

          {/* Import Section */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Import Data</Text>

              <FormLayout>
                <Select
                  label="Import Type"
                  options={[
                    { label: 'Wholesale Customers', value: 'customers' }
                  ]}
                  value={importType}
                  onChange={setImportType}
                />

                <DropZone onDrop={handleFileDrop} accept=".csv">
                  <DropZone.FileUpload />
                </DropZone>

                {file && (
                  <LegacyStack vertical>
                    <Text variant="bodySm">
                      Selected file: {file.name}
                    </Text>
                    <Button
                      variant="primary"
                      onClick={handleImport}
                    >
                      Import File
                    </Button>
                  </LegacyStack>
                )}
              </FormLayout>
            </BlockStack>
          </Card>

          {/* CSV Format Guide */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">CSV Format Guide</Text>

              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Customers CSV Format:</Text>
                <Box
                  padding="300"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <Text variant="bodySm" as="code">
                    Email,Shopify Customer ID,Approved,Tags,Order Count,Total Spent,Notes
                    <br />
                    customer@example.com,123456789,Yes,wholesale;vip,5,500.00,Good customer
                  </Text>
                </Box>

                <Text variant="bodySm" tone="subdued">
                  • Use semicolons to separate multiple tags
                  <br />
                  • Approved should be 'Yes' or 'No'
                  <br />
                  • Shopify Customer ID must be valid
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Important Notes</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">• Exports include all data</Text>
                <Text variant="bodySm">• Imports append to existing data</Text>
                <Text variant="bodySm">• Duplicate emails will be skipped</Text>
                <Text variant="bodySm">• Invalid data will be reported</Text>
                <Text variant="bodySm">• Always backup before importing</Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
