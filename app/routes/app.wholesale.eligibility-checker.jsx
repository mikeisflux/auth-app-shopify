// Customer Eligibility Checker
import { json } from "@remix-run/node";
import { useActionData, useNavigate, useSubmit } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  BlockStack,
  Banner,
  Text,
  Box,
  Badge,
  InlineStack
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { WholesaleModel } from "../models/wholesale.server";
import { query } from "../db/connection.server";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const formData = await request.formData();
  const email = formData.get('email');

  try {
    // Get all pricing rules
    const rules = await WholesaleModel.getPricingRules(shopDomain, {
      status: 'published'
    });

    // Check if customer exists in wholesale system
    const existingCustomer = await query(
      `SELECT wc.*
       FROM wholesale_customers wc
       INNER JOIN shops s ON wc.shop_id = s.id
       WHERE s.shop_domain = $1 AND wc.email = $2`,
      [shopDomain, email]
    );

    const customer = existingCustomer.rows[0];
    const eligibilityResults = [];

    if (customer) {
      const customerTags = JSON.parse(customer.customer_tags || '[]');

      for (const rule of rules) {
        const ruleTags = JSON.parse(rule.customer_tags || '[]');
        let eligible = false;
        let reason = '';

        if (rule.customer_selection === 'all_customers') {
          eligible = true;
          reason = 'Rule applies to all customers';
        } else if (rule.customer_selection === 'all_logged_in') {
          eligible = true;
          reason = 'Rule applies to all logged-in customers';
        } else if (rule.customer_selection === 'tagged') {
          const hasMatchingTag = customerTags.some(tag => ruleTags.includes(tag));
          eligible = hasMatchingTag;
          reason = hasMatchingTag
            ? `Customer has matching tag(s): ${customerTags.filter(t => ruleTags.includes(t)).join(', ')}`
            : 'Customer does not have required tags';
        }

        eligibilityResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: rule.rule_type,
          discount: `${rule.discount_value}${rule.discount_type === 'percentage' ? '%' : ''}`,
          eligible,
          reason
        });

        // Log eligibility check
        await query(
          `INSERT INTO eligibility_checks
           (shop_id, email, pricing_rule_id, eligible, reason)
           SELECT s.id, $2, $3, $4, $5
           FROM shops s
           WHERE s.shop_domain = $1`,
          [shopDomain, email, rule.id, eligible, reason]
        );
      }

      return json({
        success: true,
        customer: {
          email: customer.email,
          approved: customer.wholesale_approved,
          tags: customerTags,
          orderCount: customer.order_count,
          totalSpent: customer.total_spent
        },
        eligibilityResults
      });
    } else {
      return json({
        success: true,
        customer: null,
        message: 'Customer not found in wholesale system'
      });
    }
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
};

export default function EligibilityChecker() {
  const actionData = useActionData();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [email, setEmail] = useState('');

  const handleCheck = () => {
    const formData = new FormData();
    formData.append('email', email);
    submit(formData, { method: 'post' });
  };

  return (
    <Page
      title="Eligibility Checker"
      subtitle="Check customer eligibility for pricing rules"
      backAction={{ onAction: () => navigate('/app/wholesale') }}
    >
      <Layout>
        <Layout.Section>
          {actionData?.error && (
            <Banner status="critical">
              <p>{actionData.error}</p>
            </Banner>
          )}

          {/* Search Form */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Check Customer</Text>
              <FormLayout>
                <TextField
                  label="Customer Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="customer@example.com"
                  autoComplete="off"
                  helpText="Enter customer email to check their eligibility"
                />

                <Button
                  variant="primary"
                  onClick={handleCheck}
                  disabled={!email}
                >
                  Check Eligibility
                </Button>
              </FormLayout>
            </BlockStack>
          </Card>

          {/* Customer Info */}
          {actionData?.success && actionData?.customer && (
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Customer Information</Text>

                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="bodySm"><strong>Email:</strong></Text>
                    <Text variant="bodySm">{actionData.customer.email}</Text>
                  </InlineStack>

                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="bodySm"><strong>Status:</strong></Text>
                    <Badge tone={actionData.customer.approved ? 'success' : 'warning'}>
                      {actionData.customer.approved ? 'Approved' : 'Pending'}
                    </Badge>
                  </InlineStack>

                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="bodySm"><strong>Tags:</strong></Text>
                    <Text variant="bodySm">
                      {actionData.customer.tags.join(', ') || 'None'}
                    </Text>
                  </InlineStack>

                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="bodySm"><strong>Orders:</strong></Text>
                    <Text variant="bodySm">{actionData.customer.orderCount}</Text>
                  </InlineStack>

                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="bodySm"><strong>Total Spent:</strong></Text>
                    <Text variant="bodySm">
                      ${parseFloat(actionData.customer.totalSpent).toFixed(2)}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>
          )}

          {/* Eligibility Results */}
          {actionData?.success && actionData?.eligibilityResults && (
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Pricing Rule Eligibility</Text>

                {actionData.eligibilityResults.length > 0 ? (
                  <BlockStack gap="300">
                    {actionData.eligibilityResults.map((result, index) => (
                      <Box
                        key={index}
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <BlockStack gap="200">
                          <InlineStack align="space-between" blockAlign="center">
                            <Text variant="headingSm" as="h3">
                              {result.ruleName}
                            </Text>
                            <Badge tone={result.eligible ? 'success' : 'critical'}>
                              {result.eligible ? 'Eligible' : 'Not Eligible'}
                            </Badge>
                          </InlineStack>

                          <InlineStack gap="400">
                            <Text variant="bodySm">
                              <strong>Type:</strong> {result.ruleType}
                            </Text>
                            <Text variant="bodySm">
                              <strong>Discount:</strong> {result.discount}
                            </Text>
                          </InlineStack>

                          <Text variant="bodySm" tone="subdued">
                            {result.reason}
                          </Text>
                        </BlockStack>
                      </Box>
                    ))}
                  </BlockStack>
                ) : (
                  <Text tone="subdued">
                    No active pricing rules found
                  </Text>
                )}
              </BlockStack>
            </Card>
          )}

          {/* Not Found */}
          {actionData?.success && !actionData?.customer && (
            <Banner status="info">
              <p>{actionData.message}</p>
              <p>
                This customer is not in your wholesale system yet. You can add them manually.
              </p>
            </Banner>
          )}
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">About This Tool</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  The eligibility checker helps you quickly verify if a customer qualifies for your wholesale pricing rules.
                </Text>
                <Text variant="bodySm">
                  Results are logged for audit purposes.
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Common Reasons</Text>
              <BlockStack gap="100">
                <Text variant="bodySm">
                  <strong>Eligible:</strong>
                </Text>
                <Text variant="bodySm">• Customer has matching tags</Text>
                <Text variant="bodySm">• Rule applies to all customers</Text>
                <Text variant="bodySm">• Rule applies to logged-in users</Text>

                <Text variant="bodySm">
                  <strong>Not Eligible:</strong>
                </Text>
                <Text variant="bodySm">• Missing required tags</Text>
                <Text variant="bodySm">• Not in wholesale system</Text>
                <Text variant="bodySm">• Not approved yet</Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
