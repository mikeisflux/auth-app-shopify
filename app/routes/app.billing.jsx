import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Banner,
  Badge
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { BillingService, PLANS } from "../services/billing.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const billingService = new BillingService(session);
  const subscription = await billingService.checkSubscription();
  const url = new URL(request.url);

  return json({
    subscription,
    plans: Object.values(PLANS),
    cancelled: url.searchParams.get("cancelled") === "1",
    activated: url.searchParams.get("activated") === "1",
    callbackError: url.searchParams.get("error")
  });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const billingService = new BillingService(session);
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    if (intent === "subscribe") {
      const planName = formData.get("plan");
      if (!planName) {
        throw new Error("Please choose a plan to continue.");
      }

      const { confirmationUrl } = await billingService.createCharge(planName);
      return redirect(confirmationUrl);
    }

    if (intent === "cancel") {
      await billingService.cancelSubscription();
      return redirect("/app/billing?cancelled=1");
    }
  } catch (error) {
    console.error("Billing action failed:", error);
    return json({
      error: error.message || "Unable to process billing request."
    }, { status: 400 });
  }

  return json({ error: "Unsupported action." }, { status: 400 });
};

export default function Billing() {
  const { subscription, plans, cancelled, activated, callbackError } = useLoaderData();
  const actionData = useActionData();

  const hasActiveSubscription = subscription.hasActiveSubscription;
  const activePlan = hasActiveSubscription
    ? BillingService.getPlanDetails(subscription.plan)
    : null;

  return (
    <Page title="Manage Subscription">
      <BlockStack gap="500">
        {cancelled && (
          <Banner status="success">
            <p>Your subscription was cancelled successfully.</p>
          </Banner>
        )}

        {actionData?.error && (
          <Banner status="critical">
            <p>{actionData.error}</p>
          </Banner>
        )}

        {callbackError && (
          <Banner status="critical">
            <p>We couldn&apos;t finalize your subscription. Please try again.</p>
          </Banner>
        )}

        {activated && (
          <Banner status="success">
            <p>Your subscription is now active. Thank you!</p>
          </Banner>
        )}

        {hasActiveSubscription && activePlan && (
          <Banner status="success">
            <p>
              You are currently on the <strong>{activePlan.displayName}</strong> plan.
            </p>
          </Banner>
        )}

        <Layout>
          {plans.map((plan) => {
            const isActive = hasActiveSubscription && plan.name === subscription.plan;

            return (
              <Layout.Section key={plan.name} variant="oneThird">
                <Card>
                  <BlockStack gap="400">
                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="headingMd" as="h2">
                          {plan.displayName}
                        </Text>
                        {isActive && <Badge tone="success">Current Plan</Badge>}
                      </InlineStack>
                      <Text variant="headingXl" as="p">
                        ${plan.price.toFixed(2)} / month
                      </Text>
                      <Text tone="subdued">{plan.description}</Text>
                      <Text tone="subdued">
                        Includes up to {plan.categoryLimit === 999999 ? "unlimited" : plan.categoryLimit}{" "}
                        categories.
                      </Text>
                    </BlockStack>

                    <Form method="post">
                      <input type="hidden" name="intent" value="subscribe" />
                      <input type="hidden" name="plan" value={plan.name} />
                      <Button
                        submit
                        variant="primary"
                        disabled={isActive}
                      >
                        {isActive ? "Selected" : "Select Plan"}
                      </Button>
                    </Form>
                  </BlockStack>
                </Card>
              </Layout.Section>
            );
          })}
        </Layout>

        {hasActiveSubscription && (
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">
                Need to cancel?
              </Text>
              <Text tone="subdued">
                Cancelling will immediately disable category creation beyond the free tier limits.
              </Text>
              <Form method="post">
                <input type="hidden" name="intent" value="cancel" />
                <Button submit tone="critical">
                  Cancel Subscription
                </Button>
              </Form>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
