import { redirect, json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { BillingService } from "../services/billing.server";

export const loader = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const billingService = new BillingService(session);
    await billingService.checkSubscription();
    return redirect("/app/billing?activated=1");
  } catch (error) {
    console.error("Failed to finalize billing callback:", error);
    return redirect("/app/billing?error=callback");
  }
};

export const action = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const billingService = new BillingService(session);
    await billingService.checkSubscription();
    return json({ success: true });
  } catch (error) {
    console.error("Failed to process billing callback action:", error);
    return json({ error: "Unable to finalize billing." }, { status: 400 });
  }
};
