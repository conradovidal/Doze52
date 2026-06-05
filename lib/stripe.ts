import Stripe from "stripe";

const STRIPE_API_VERSION = "2026-05-27.dahlia";

let stripeClient: Stripe | null = null;

const requireServerEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }
  return value;
};

export const getStripe = () => {
  if (!stripeClient) {
    stripeClient = new Stripe(requireServerEnv("STRIPE_SECRET_KEY"), {
      apiVersion: STRIPE_API_VERSION,
      appInfo: {
        name: "Doze52",
      },
    });
  }
  return stripeClient;
};

export const getStripeWebhookSecret = () =>
  requireServerEnv("STRIPE_WEBHOOK_SECRET");

export const getStripeProPriceId = () =>
  requireServerEnv("STRIPE_PRO_PRICE_ID");

export type { Stripe };
