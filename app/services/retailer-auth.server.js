// Retailer Authentication Service
// Handles retailer login, session management, and authorization
import { createCookieSessionStorage, redirect } from "@remix-run/node";
import { query } from "../db/connection.server";
import crypto from "crypto";

// Session storage for retailer logins
const { getSession, commitSession, destroySession } = createCookieSessionStorage({
  cookie: {
    name: "__retailer_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET || "default-secret-change-in-production"],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30 // 30 days
  }
});

export const RetailerAuth = {
  /**
   * Generate a secure login token for a retailer
   * This token can be sent via email or used for passwordless login
   */
  async generateLoginToken(customerId, shopDomain) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await query(
      `INSERT INTO retailer_login_tokens (customer_id, token, expires_at, shop_domain)
       SELECT wc.id, $2, $3, $4
       FROM wholesale_customers wc
       INNER JOIN shops s ON wc.shop_id = s.id
       WHERE wc.shopify_customer_id = $1 AND s.shop_domain = $4`,
      [customerId, token, expiresAt, shopDomain]
    );

    return token;
  },

  /**
   * Validate a login token and return customer data
   */
  async validateLoginToken(token, shopDomain) {
    const result = await query(
      `SELECT wc.*
       FROM retailer_login_tokens rlt
       INNER JOIN wholesale_customers wc ON rlt.customer_id = wc.id
       INNER JOIN shops s ON wc.shop_id = s.id
       WHERE rlt.token = $1
         AND rlt.shop_domain = $2
         AND rlt.expires_at > NOW()
         AND rlt.used_at IS NULL
         AND s.shop_domain = $2`,
      [token, shopDomain]
    );

    if (result.rows.length === 0) {
      return null;
    }

    // Mark token as used
    await query(
      `UPDATE retailer_login_tokens
       SET used_at = NOW()
       WHERE token = $1`,
      [token]
    );

    return result.rows[0];
  },

  /**
   * Login with email and verify they're a wholesale customer
   * For now, this uses magic link approach
   */
  async loginWithEmail(email, shopDomain) {
    const result = await query(
      `SELECT wc.*
       FROM wholesale_customers wc
       INNER JOIN shops s ON wc.shop_id = s.id
       WHERE wc.email = $1
         AND s.shop_domain = $2
         AND wc.wholesale_approved = true`,
      [email, shopDomain]
    );

    if (result.rows.length === 0) {
      throw new Error('No approved wholesale account found for this email');
    }

    const customer = result.rows[0];

    // Generate login token
    const token = await this.generateLoginToken(customer.shopify_customer_id, shopDomain);

    return { customer, token };
  },

  /**
   * Get retailer session from request
   */
  async getRetailerSession(request) {
    const session = await getSession(request.headers.get("Cookie"));
    return session;
  },

  /**
   * Require authenticated retailer or redirect to login
   */
  async requireRetailer(request, redirectTo = "/retailer/login") {
    const session = await this.getRetailerSession(request);
    const customerId = session.get("customerId");
    const shopDomain = session.get("shopDomain");

    if (!customerId || !shopDomain) {
      const searchParams = new URLSearchParams([["redirectTo", new URL(request.url).pathname]]);
      throw redirect(`${redirectTo}?${searchParams}`);
    }

    // Verify customer still exists and is approved
    const result = await query(
      `SELECT wc.*
       FROM wholesale_customers wc
       INNER JOIN shops s ON wc.shop_id = s.id
       WHERE wc.id = $1
         AND s.shop_domain = $2
         AND wc.wholesale_approved = true`,
      [customerId, shopDomain]
    );

    if (result.rows.length === 0) {
      throw redirect(redirectTo);
    }

    return {
      customer: result.rows[0],
      session
    };
  },

  /**
   * Create retailer session
   */
  async createRetailerSession(customer, shopDomain, redirectTo = "/retailer") {
    const session = await getSession();
    session.set("customerId", customer.id);
    session.set("shopDomain", shopDomain);
    session.set("email", customer.email);

    return redirect(redirectTo, {
      headers: {
        "Set-Cookie": await commitSession(session)
      }
    });
  },

  /**
   * Logout retailer
   */
  async logout(request) {
    const session = await this.getRetailerSession(request);
    return redirect("/retailer/login", {
      headers: {
        "Set-Cookie": await destroySession(session)
      }
    });
  },

  /**
   * Get retailer customer data
   */
  async getRetailerData(customerId, shopDomain) {
    const result = await query(
      `SELECT wc.*, s.shop_domain
       FROM wholesale_customers wc
       INNER JOIN shops s ON wc.shop_id = s.id
       WHERE wc.id = $1 AND s.shop_domain = $2`,
      [customerId, shopDomain]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const customer = result.rows[0];

    // Get net terms if available
    const netTermsResult = await query(
      `SELECT * FROM net_terms WHERE customer_id = $1`,
      [customerId]
    );

    customer.netTerms = netTermsResult.rows[0] || null;

    return customer;
  }
};

// Export session helpers
export { getSession, commitSession, destroySession };
