// Billing service - handles Shopify recurring app charges
import { shopifyApi } from "@shopify/shopify-api";
import { ShopModel } from '../models/shop.server.js';

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

    const client = new shopifyApi.clients.Graphql({ session: this.session });

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

    const returnUrl = `https://${process.env.HOST}/api/billing/callback`;

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
      status: 'pending',
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
      return { hasActiveSubscription: false, plan: null };
    }

    // If status is active, verify with Shopify
    if (subscription.subscription_status === 'active') {
      try {
        const isValid = await this.verifyActiveSubscription(subscription.billing_id);
        
        if (!isValid) {
          // Update status to inactive
          await ShopModel.updateSubscription(this.shop, {
            ...subscription,
            status: 'inactive'
          });
          return { hasActiveSubscription: false, plan: null };
        }
      } catch (error) {
        console.error('Error verifying subscription:', error);
      }
    }

    return {
      hasActiveSubscription: subscription.subscription_status === 'active',
      plan: subscription.subscription_plan,
      status: subscription.subscription_status
    };
  }

  // Verify active subscription with Shopify
  async verifyActiveSubscription(subscriptionId) {
    const client = new shopifyApi.clients.Graphql({ session: this.session });

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

    try {
      const response = await client.query({
        data: {
          query,
          variables: { id: subscriptionId }
        }
      });

      const subscription = response.body.data.node;
      return subscription && subscription.status === 'ACTIVE';
    } catch (error) {
      console.error('Error checking subscription:', error);
      return false;
    }
  }

  // Cancel subscription
  async cancelSubscription() {
    const subscription = await ShopModel.getSubscription(this.shop);
    
    if (!subscription || !subscription.billing_id) {
      throw new Error('No active subscription found');
    }

    const client = new shopifyApi.clients.Graphql({ session: this.session });

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
      ...subscription,
      status: 'cancelled'
    });

    return true;
  }

  // Get plan details
  static getPlanDetails(planName) {
    return Object.values(PLANS).find(p => p.name === planName) || null;
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