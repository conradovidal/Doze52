import type { User } from "@supabase/supabase-js";

import { getSupabaseAdminClient } from "@/lib/supabase-server";
import {
  getStripe,
  getStripeProPriceId,
  type Stripe,
} from "@/lib/stripe";

export const PRO_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

export const isProSubscriptionStatus = (status: string | null | undefined) =>
  PRO_SUBSCRIPTION_STATUSES.some((proStatus) => proStatus === status);

export type BillingPlan = "free" | "pro";

export type BillingStatusPayload = {
  plan: BillingPlan;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canManageBilling: boolean;
};

export class BillingNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingNotFoundError";
  }
}

const toIsoFromUnixSeconds = (timestamp: number | null | undefined) => {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toISOString();
};

const getStripeObjectId = (
  value: string | { id?: string | null } | null | undefined
) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id ?? null;
};

const getUserDisplayName = (user: User) => {
  const metadata = user.user_metadata ?? {};
  const rawName =
    metadata.full_name ?? metadata.name ?? metadata.display_name ?? null;
  return typeof rawName === "string" && rawName.trim()
    ? rawName.trim()
    : undefined;
};

export const getAppBaseUrl = (requestUrl?: string) => {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const rawUrl = configuredUrl || (requestUrl ? new URL(requestUrl).origin : "");

  if (!rawUrl) {
    throw new Error("Missing NEXT_PUBLIC_APP_URL for Stripe redirects.");
  }

  const url = new URL(rawUrl);
  return url.origin.replace(/\/+$/, "");
};

export const getBillingCustomerId = async (userId: string) => {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data?.stripe_customer_id as string | undefined) ?? null;
};

export const getBillingStatusForUser = async (
  userId: string
): Promise<BillingStatusPayload> => {
  const supabase = getSupabaseAdminClient();
  const [customerResult, subscriptionResult] = await Promise.all([
    supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("billing_subscriptions")
      .select("status, current_period_end, cancel_at_period_end")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (customerResult.error) throw customerResult.error;
  if (subscriptionResult.error) throw subscriptionResult.error;

  const subscription = subscriptionResult.data as
    | {
        status?: string | null;
        current_period_end?: string | null;
        cancel_at_period_end?: boolean | null;
      }
    | null
    | undefined;
  const status = subscription?.status ?? null;

  return {
    plan: isProSubscriptionStatus(status) ? "pro" : "free",
    status,
    currentPeriodEnd: subscription?.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    canManageBilling: Boolean(customerResult.data?.stripe_customer_id),
  };
};

const upsertBillingCustomer = async (params: {
  userId: string;
  stripeCustomerId: string;
}) => {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("billing_customers").upsert(
    {
      user_id: params.userId,
      stripe_customer_id: params.stripeCustomerId,
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
};

export const getOrCreateBillingCustomer = async (user: User) => {
  const existingCustomerId = await getBillingCustomerId(user.id);
  if (existingCustomerId) return existingCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    name: getUserDisplayName(user),
    metadata: {
      user_id: user.id,
    },
  });

  await upsertBillingCustomer({
    userId: user.id,
    stripeCustomerId: customer.id,
  });

  return customer.id;
};

export const createCheckoutSession = async (params: {
  user: User;
  requestUrl: string;
}) => {
  const stripe = getStripe();
  const customerId = await getOrCreateBillingCustomer(params.user);
  const appUrl = getAppBaseUrl(params.requestUrl);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: params.user.id,
    line_items: [
      {
        price: getStripeProPriceId(),
        quantity: 1,
      },
    ],
    metadata: {
      user_id: params.user.id,
    },
    subscription_data: {
      metadata: {
        user_id: params.user.id,
      },
    },
    success_url: `${appUrl}/?billing=success`,
    cancel_url: `${appUrl}/?billing=cancelled`,
  });

  if (!session.url) {
    throw new Error("Stripe Checkout did not return a redirect URL.");
  }

  return session.url;
};

export const createCustomerPortalSession = async (params: {
  userId: string;
  requestUrl: string;
}) => {
  const customerId = await getBillingCustomerId(params.userId);
  if (!customerId) {
    throw new BillingNotFoundError("No billing customer found for this user.");
  }

  const stripe = getStripe();
  const appUrl = getAppBaseUrl(params.requestUrl);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/?billing=portal`,
  });

  return session.url;
};

const resolveSubscriptionUserId = async (
  subscription: Stripe.Subscription,
  fallbackUserId?: string | null
) => {
  if (fallbackUserId) return fallbackUserId;

  const metadataUserId = subscription.metadata?.user_id;
  if (metadataUserId) return metadataUserId;

  const stripeCustomerId = getStripeObjectId(subscription.customer);
  if (!stripeCustomerId) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("billing_customers")
    .select("user_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error) throw error;
  return (data?.user_id as string | undefined) ?? null;
};

export const syncStripeSubscription = async (
  subscription: Stripe.Subscription,
  options: { fallbackUserId?: string | null; fallbackCustomerId?: string | null } = {}
) => {
  const userId = await resolveSubscriptionUserId(
    subscription,
    options.fallbackUserId
  );
  const stripeCustomerId =
    getStripeObjectId(subscription.customer) ?? options.fallbackCustomerId;

  if (!userId || !stripeCustomerId) {
    throw new Error(
      `Unable to resolve billing owner for Stripe subscription ${subscription.id}.`
    );
  }

  await upsertBillingCustomer({ userId, stripeCustomerId });

  const firstItem = subscription.items.data[0];
  const { error } = await getSupabaseAdminClient()
    .from("billing_subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        stripe_price_id: firstItem?.price.id ?? null,
        status: subscription.status,
        current_period_end: toIsoFromUnixSeconds(firstItem?.current_period_end),
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
      { onConflict: "user_id" }
    );

  if (error) throw error;
};

const isUniqueViolation = (error: unknown) => {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return String((error as { code?: string }).code) === "23505";
};

const claimWebhookEvent = async (event: Stripe.Event) => {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    type: event.type,
  });

  if (!error) return true;
  if (isUniqueViolation(error)) {
    const { data, error: selectError } = await supabase
      .from("stripe_webhook_events")
      .select("processed_at")
      .eq("stripe_event_id", event.id)
      .maybeSingle();

    if (selectError) throw selectError;
    return !data?.processed_at;
  }
  throw error;
};

const markWebhookEventProcessed = async (eventId: string) => {
  const { error } = await getSupabaseAdminClient()
    .from("stripe_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("stripe_event_id", eventId);

  if (error) throw error;
};

const releaseWebhookEvent = async (eventId: string) => {
  const { error } = await getSupabaseAdminClient()
    .from("stripe_webhook_events")
    .delete()
    .eq("stripe_event_id", eventId)
    .is("processed_at", null);

  if (error) throw error;
};

const handleCheckoutSessionCompleted = async (
  session: Stripe.Checkout.Session
) => {
  const subscriptionId = getStripeObjectId(session.subscription);
  if (!subscriptionId) return;

  const fallbackUserId = session.metadata?.user_id ?? session.client_reference_id;
  const fallbackCustomerId = getStripeObjectId(session.customer);

  if (fallbackUserId && fallbackCustomerId) {
    await upsertBillingCustomer({
      userId: fallbackUserId,
      stripeCustomerId: fallbackCustomerId,
    });
  }

  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  await syncStripeSubscription(subscription, {
    fallbackUserId,
    fallbackCustomerId,
  });
};

const handleSubscriptionEvent = async (subscription: Stripe.Subscription) => {
  await syncStripeSubscription(subscription);
};

export const processStripeWebhookEvent = async (event: Stripe.Event) => {
  const claimed = await claimWebhookEvent(event);
  if (!claimed) {
    return { duplicate: true, handled: false };
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }

    await markWebhookEventProcessed(event.id);
    return { duplicate: false, handled: true };
  } catch (error) {
    await releaseWebhookEvent(event.id);
    throw error;
  }
};
