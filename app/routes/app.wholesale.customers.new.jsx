// Add New Wholesale Customer
import { json, redirect } from "@remix-run/node";
import { useActionData, useNavigate, useSubmit } from "@remix-run/react";
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
  Banner
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { WholesaleModel } from "../models/wholesale.server";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const formData = await request.formData();
  const email = formData.get('email');
  const shopifyCustomerId = formData.get('shopifyCustomerId');
  const wholesaleApproved = formData.get('wholesaleApproved') === 'true';
  const customerTags = formData.get('customerTags')?.split(',').map(t => t.trim()).filter(Boolean) || [];
  const notes = formData.get('notes');

  try {
    await WholesaleModel.createWholesaleCustomer(shopDomain, {
      shopifyCustomerId: parseInt(shopifyCustomerId),
      email,
      wholesaleApproved,
      approvedBy: session.shop,
      customerTags,
      notes
    });

    return redirect('/app/wholesale/customers');
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function NewWholesaleCustomer() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const actionData = useActionData();

  const [email, setEmail] = useState('');
  const [shopifyCustomerId, setShopifyCustomerId] = useState('');
  const [wholesaleApproved, setWholesaleApproved] = useState(false);
  const [customerTags, setCustomerTags] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append('email', email);
    formData.append('shopifyCustomerId', shopifyCustomerId);
    formData.append('wholesaleApproved', wholesaleApproved);
    formData.append('customerTags', customerTags);
    formData.append('notes', notes);

    submit(formData, { method: 'post' });
  };

  return (
    <Page
      title="Add Wholesale Customer"
      backAction={{ onAction: () => navigate('/app/wholesale/customers') }}
      primaryAction={{
        content: 'Save',
        onAction: handleSubmit,
        disabled: !email || !shopifyCustomerId
      }}
    >
      <Layout>
        <Layout.Section>
          {actionData?.error && (
            <Banner status="critical">
              <p>{actionData.error}</p>
            </Banner>
          )}

          <Card>
            <FormLayout>
              <TextField
                label="Customer Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="customer@example.com"
                autoComplete="email"
                helpText="Email address of the wholesale customer"
              />

              <TextField
                label="Shopify Customer ID"
                type="number"
                value={shopifyCustomerId}
                onChange={setShopifyCustomerId}
                placeholder="123456789"
                autoComplete="off"
                helpText="The Shopify customer ID (found in Shopify admin)"
              />

              <Checkbox
                label="Approve for wholesale access"
                checked={wholesaleApproved}
                onChange={setWholesaleApproved}
                helpText="Grant immediate wholesale access to this customer"
              />

              <TextField
                label="Customer Tags"
                value={customerTags}
                onChange={setCustomerTags}
                placeholder="wholesale, tier1, vip"
                autoComplete="off"
                helpText="Comma-separated tags to match pricing rules"
              />

              <TextField
                label="Notes"
                value={notes}
                onChange={setNotes}
                placeholder="Internal notes about this customer..."
                multiline={4}
                autoComplete="off"
                helpText="Optional internal notes"
              />
            </FormLayout>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Important</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">• Customer must already exist in Shopify</Text>
                <Text variant="bodySm">• Use matching tags for pricing rules</Text>
                <Text variant="bodySm">• Approval can be changed later</Text>
                <Text variant="bodySm">• Tags are case-sensitive</Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
