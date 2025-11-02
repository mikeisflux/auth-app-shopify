// Retailer Login - Magic Link Authentication
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useSearchParams } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Button,
  BlockStack,
  Text,
  Banner,
  InlineStack,
  Box
} from "@shopify/polaris";
import { RetailerAuth } from "../services/retailer-auth.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const shop = url.searchParams.get('shop');

  // If token is provided, attempt to login
  if (token && shop) {
    try {
      const customer = await RetailerAuth.validateLoginToken(token, shop);
      if (customer) {
        return await RetailerAuth.createRetailerSession(customer, shop);
      }
    } catch (error) {
      return json({ error: 'Invalid or expired login link' });
    }
  }

  // Check if already logged in
  try {
    const { customer } = await RetailerAuth.requireRetailer(request, null);
    if (customer) {
      return redirect('/retailer');
    }
  } catch {
    // Not logged in, continue to login page
  }

  return json({ shop: shop || '' });
};

export const action = async ({ request }) => {
  const formData = await request.formData();
  const email = formData.get('email');
  const shop = formData.get('shop');

  if (!email || !shop) {
    return json({ error: 'Email and shop domain are required' }, { status: 400 });
  }

  try {
    const { customer, token } = await RetailerAuth.loginWithEmail(email, shop);

    // In production, send this link via email
    // For now, return the link directly
    const loginLink = `https://${shop}/apps/retailer/login?token=${token}&shop=${shop}`;

    return json({
      success: true,
      message: 'Login link generated! Check your email.',
      loginLink, // Remove this in production - only send via email
      email: customer.email
    });
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function RetailerLogin() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [shop, setShop] = useState(loaderData?.shop || searchParams.get('shop') || '');

  return (
    <Page narrowWidth>
      <Box paddingBlockStart="800">
        <BlockStack gap="800">
          <BlockStack gap="400" inlineAlign="center">
            <Text variant="heading2xl" as="h1">Retailer Portal</Text>
            <Text variant="bodyLg" tone="subdued" alignment="center">
              Sign in to access your wholesale account
            </Text>
          </BlockStack>

          <Card>
            <BlockStack gap="400">
              {loaderData?.error && (
                <Banner status="critical">
                  <p>{loaderData.error}</p>
                </Banner>
              )}

              {actionData?.error && (
                <Banner status="critical">
                  <p>{actionData.error}</p>
                </Banner>
              )}

              {actionData?.success && (
                <Banner status="success">
                  <BlockStack gap="200">
                    <p>{actionData.message}</p>
                    {actionData.loginLink && (
                      <>
                        <Text variant="bodySm" tone="subdued">
                          Development mode - Click the link below to login:
                        </Text>
                        <Button
                          url={actionData.loginLink}
                          variant="primary"
                        >
                          Login to Portal
                        </Button>
                      </>
                    )}
                  </BlockStack>
                </Banner>
              )}

              {!actionData?.success && (
                <Form method="post">
                  <FormLayout>
                    <TextField
                      label="Email Address"
                      type="email"
                      name="email"
                      value={email}
                      onChange={setEmail}
                      placeholder="your@email.com"
                      autoComplete="email"
                      requiredIndicator
                    />

                    <TextField
                      label="Store Domain"
                      type="text"
                      name="shop"
                      value={shop}
                      onChange={setShop}
                      placeholder="store.myshopify.com"
                      helpText="Your store's Shopify domain"
                      requiredIndicator
                    />

                    <Button
                      variant="primary"
                      submit
                      fullWidth
                      disabled={!email || !shop}
                    >
                      Send Login Link
                    </Button>
                  </FormLayout>
                </Form>
              )}
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">How it works</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  1. Enter your email address and store domain
                </Text>
                <Text variant="bodySm">
                  2. We'll send you a secure login link
                </Text>
                <Text variant="bodySm">
                  3. Click the link to access your wholesale portal
                </Text>
                <Text variant="bodySm">
                  4. No password required - secure and simple
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Need Help?</Text>
              <Text variant="bodySm">
                If you don't have a wholesale account yet, please contact the store owner to request access.
              </Text>
              <Text variant="bodySm">
                For technical support, email support@{shop || 'yourstore.com'}
              </Text>
            </BlockStack>
          </Card>
        </BlockStack>
      </Box>
    </Page>
  );
}
