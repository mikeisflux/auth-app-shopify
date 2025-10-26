// Billing service - handles Shopify recurring app charges
import shopify from "../config/shopify.js";
import { ShopModel } from "../models/shop.server.js";

function resolveAppBaseUrl() {
  const rawUrl = process.env.SHOPIFY_APP_URL || process.env.HOST || "";

  if (!rawUrl) {
    throw new Error(
      "Missing SHOPIFY_APP_URL or HOST environment variable for billing callbacks"
    );
  }

  try {
    const url = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
      ? new URL(rawUrl)
      : new URL(`https://${rawUrl}`);

    return url;
  } catch (error) {
    throw new Error(`Invalid app URL configured for billing callbacks: ${rawUrl}`);
  }
}

function normalizeShopifyStatus(status) {
  if (!status) return "inactive";
  return status.toString().toLowerCase();
}

export const PLANS = {
  BASIC: {
    name: 'BASIC_9_99',
    price: 9.99,
    categoryLimit: 2,
    displayName: 'Basic Plan',
    description: 'Up to 2 categories'
  },
  PRO: {
    name: 'PRO_29_99',
    price: 29.99,
    categoryLimit: 5,
    displayName: 'Pro Plan',
    description: '3-5 categories'
  },
  PREMIUM: {
    name: 'PREMIUM_49_99',
    price: 49.99,
    categoryLimit: 999999,
    displayName: 'Premium Plan',
    description: '6+ categories (unlimited)'
  }
};

export class BillingService {
  constructor(session) {
    this.session = session;
    this.shop = session.shop;
  }

  // Create a recurring charge
  async createCharge(planName) {
    const plan = Object.values(PLANS).find(p => p.name === planName);
    
    if (!plan) {
      throw new Error('Invalid plan name');
    }

    const client = new shopify.api.clients.Graphql({ session: this.session });

    const mutation = `
      mutation CreateRecurringCharge($name: String!, $price: Decimal!, $returnUrl: URL!) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          lineItems: [{
            plan: {
              appRecurringPricingDetails: {
                price: { amount: $price, currencyCode: USD }
                interval: EVERY_30_DAYS
              }
            }
          }]
        ) {
          appSubscription {
            id
            status
          }
          confirmationUrl
          userErrors {
            field
            message
          }
        }
      }
    `;

    const baseUrl = resolveAppBaseUrl();
    const returnUrl = new URL("/api/billing/callback", baseUrl).toString();

    const response = await client.query({
      data: {
        query: mutation,
        variables: {
          name: plan.displayName,
          price: plan.price,
          returnUrl
        }
      }
    });

    const { appSubscription, confirmationUrl, userErrors } = 
      response.body.data.appSubscriptionCreate;

    if (userErrors && userErrors.length > 0) {
      throw new Error(userErrors[0].message);
    }

    // Store pending subscription info
    await ShopModel.updateSubscription(this.shop, {
      plan: planName,
      status: "pending",
      billingId: appSubscription.id,
      trialEndsAt: null
    });

    return {
      confirmationUrl,
      subscriptionId: appSubscription.id
    };
  }

  // Check subscription status
  async checkSubscription() {
    const subscription = await ShopModel.getSubscription(this.shop);

    if (!subscription) {
      return { hasActiveSubscription: false, plan: null, status: "none" };
    }

    const { subscription_plan, subscription_status, billing_id, trial_ends_at } = subscription;

    if (!billing_id) {
      return {
        hasActiveSubscription: false,
        plan: subscription_plan,
        status: subscription_status || "inactive",
        currentPeriodEnd: trial_ends_at,
      };
    }

    if (subscription_status === 'pending' || subscription_status === 'active') {
      try {
        const remoteSubscription = await this.fetchSubscriptionFromShopify(billing_id);

        const remotePeriodEnd = remoteSubscription?.currentPeriodEnd
          ? new Date(remoteSubscription.currentPeriodEnd).toISOString()
          : null;

        if (remoteSubscription && remoteSubscription.status === 'ACTIVE') {

          if (
            subscription_status !== 'active' ||
            (remotePeriodEnd && remotePeriodEnd !== trial_ends_at)
          ) {
            await ShopModel.updateSubscription(this.shop, {
              plan: subscription_plan,
              status: 'active',
              billingId: billing_id,
              trialEndsAt: remotePeriodEnd,
            });
          }

          return {
            hasActiveSubscription: true,
            plan: subscription_plan,
            status: 'active',
            currentPeriodEnd: remotePeriodEnd,
          };
        }

        const nextStatus = normalizeShopifyStatus(remoteSubscription?.status);

        if (nextStatus !== subscription_status) {
          await ShopModel.updateSubscription(this.shop, {
            plan: subscription_plan,
            status: nextStatus,
            billingId: remoteSubscription ? billing_id : null,
            trialEndsAt: remotePeriodEnd,
          });
        }

        return {
          hasActiveSubscription: false,
          plan: subscription_plan,
          status: nextStatus,
          currentPeriodEnd: remotePeriodEnd || trial_ends_at,
        };
      } catch (error) {
        console.error('Error verifying subscription:', error);
      }
    }

    return {
      hasActiveSubscription: subscription_status === 'active',
      plan: subscription_plan,
      status: subscription_status,
      currentPeriodEnd: trial_ends_at,
    };
  }

  async fetchSubscriptionFromShopify(subscriptionId) {
    if (!subscriptionId) return null;

    const client = new shopify.api.clients.Graphql({ session: this.session });

    const query = `
      query GetSubscription($id: ID!) {
        node(id: $id) {
          ... on AppSubscription {
            id
            status
            currentPeriodEnd
          }
        }
      }
    `;

    const response = await client.query({
      data: {
        query,
        variables: { id: subscriptionId }
      }
    });

    return response.body.data.node;
  }

  // Cancel subscription
  async cancelSubscription() {
    const subscription = await ShopModel.getSubscription(this.shop);
    
    if (!subscription || !subscription.billing_id) {
      throw new Error('No active subscription found');
    }

    const client = new shopify.api.clients.Graphql({ session: this.session });

    const mutation = `
      mutation CancelSubscription($id: ID!) {
        appSubscriptionCancel(id: $id) {
          appSubscription {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await client.query({
      data: {
        query: mutation,
        variables: { id: subscription.billing_id }
      }
    });

    const { userErrors } = response.body.data.appSubscriptionCancel;

    if (userErrors && userErrors.length > 0) {
      throw new Error(userErrors[0].message);
    }

    // Update local database
    await ShopModel.updateSubscription(this.shop, {
      plan: subscription.subscription_plan,
      status: "cancelled",
      billingId: null,
      trialEndsAt: subscription.trial_ends_at
    });

    return true;
  }

  // Get plan details
  static getPlanDetails(planName) {
    return Object.values(PLANS).find(p => p.name === planName) || null;
  }

  // Get all available plans
  static getAvailablePlans() {
    return Object.values(PLANS).map(plan => ({
      name: plan.name,
      displayName: plan.displayName,
      price: plan.price,
      description: plan.description,
      maxCategories: plan.categoryLimit,
      maxItems: 999999,
      features: []
    }));
  }

  // Get required plan for category count
  static getRequiredPlan(categoryCount) {
    if (categoryCount <= 2) return PLANS.BASIC;
    if (categoryCount <= 5) return PLANS.PRO;
    return PLANS.PREMIUM;
  }

  // Check if shop can create more categories
  async canCreateCategory() {
    const subscription = await this.checkSubscription();
    
    if (!subscription.hasActiveSubscription) {
      return false;
    }

    return await ShopModel.canCreateCategory(this.shop);
  }
}