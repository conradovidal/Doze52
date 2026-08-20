import { randomInt } from "node:crypto";
import type { User } from "@supabase/supabase-js";

import {
  resolveBillingPlan,
  type BillingPlan,
  type BillingStatusPayload,
} from "@/lib/entitlements";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import {
  getStripe,
  getStripeProPriceId,
  type Stripe,
} from "@/lib/stripe";

export type { BillingPlan, BillingStatusPayload };

export class BillingNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingNotFoundError";
  }
}

export class WebhookEventInProgressError extends Error {
  constructor() {
    super("Stripe webhook event is already being processed.");
    this.name = "WebhookEventInProgressError";
  }
}

export class WebhookLeaseLostError extends Error {
  constructor() {
    super("Stripe webhook event lease is no longer owned by this worker.");
    this.name = "WebhookLeaseLostError";
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
  const currentPeriodEnd = subscription?.current_period_end ?? null;

  return {
    plan: resolveBillingPlan({ status, currentPeriodEnd }),
    status,
    currentPeriodEnd,
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
    integration_identifier: createIntegrationIdentifier(),
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

const createIntegrationIdentifier = () => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const suffix = Array.from({ length: 8 }, () =>
    alphabet[randomInt(alphabet.length)]
  ).join("");
  return `doze52_${suffix}`;
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
  options: {
    eventId: string;
    eventCreated: number;
    fallbackUserId?: string | null;
    fallbackCustomerId?: string | null;
  }
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
  const { data, error } = await getSupabaseAdminClient().rpc(
    "apply_stripe_subscription_state",
    {
      p_user_id: userId,
      p_stripe_customer_id: stripeCustomerId,
      p_stripe_subscription_id: subscription.id,
      p_stripe_price_id: firstItem?.price.id ?? null,
      p_status: subscription.status,
      p_current_period_end: toIsoFromUnixSeconds(firstItem?.current_period_end),
      p_cancel_at_period_end: Boolean(
        subscription.cancel_at_period_end || subscription.cancel_at
      ),
      p_event_created_at: toIsoFromUnixSeconds(options.eventCreated),
      p_event_id: options.eventId,
    }
  );

  if (error) throw error;
  return Boolean(data);
};

type WebhookClaim = {
  outcome: "claimed" | "duplicate" | "processing";
  leaseToken: string | null;
  attemptCount: number;
};

const claimWebhookEvent = async (event: Stripe.Event) => {
  const { data, error } = await getSupabaseAdminClient().rpc(
    "claim_stripe_webhook_event",
    {
      p_event_id: event.id,
      p_event_type: event.type,
      p_lease_seconds: 60,
    }
  );
  if (error) throw error;

  const claim = data as Partial<WebhookClaim> | null;
  if (
    !claim ||
    !["claimed", "duplicate", "processing"].includes(claim.outcome ?? "") ||
    !Number.isInteger(claim.attemptCount)
  ) {
    throw new Error("Invalid Stripe webhook claim response.");
  }
  return claim as WebhookClaim;
};

const markWebhookEventProcessed = async (
  eventId: string,
  leaseToken: string
) => {
  const { data, error } = await getSupabaseAdminClient().rpc(
    "complete_stripe_webhook_event",
    {
      p_event_id: eventId,
      p_lease_token: leaseToken,
    }
  );

  if (error) throw error;
  if (!data) throw new WebhookLeaseLostError();
};

const getWebhookErrorCode = (error: unknown) => {
  if (error instanceof WebhookLeaseLostError) return "lease_lost";
  if (error instanceof Error && error.name) {
    const normalized = error.name
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .toLowerCase();
    if (/^[a-z0-9_.-]{1,64}$/.test(normalized)) return normalized;
  }
  return "processing_error";
};

const releaseWebhookEvent = async (
  eventId: string,
  leaseToken: string,
  error: unknown
) => {
  const { error: releaseError } = await getSupabaseAdminClient().rpc(
    "fail_stripe_webhook_event",
    {
      p_event_id: eventId,
      p_lease_token: leaseToken,
      p_error_code: getWebhookErrorCode(error),
    }
  );

  if (releaseError) throw releaseError;
};

const handleCheckoutSessionCompleted = async (
  event: Stripe.Event
) => {
  const session = event.data.object as Stripe.Checkout.Session;
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
    eventId: event.id,
    eventCreated: event.created,
    fallbackUserId,
    fallbackCustomerId,
  });
};

const handleSubscriptionEvent = async (event: Stripe.Event) => {
  const eventSubscription = event.data.object as Stripe.Subscription;
  const subscription = await getStripe().subscriptions.retrieve(
    eventSubscription.id
  );
  await syncStripeSubscription(subscription, {
    eventId: event.id,
    eventCreated: event.created,
  });
};

export const processStripeWebhookEvent = async (event: Stripe.Event) => {
  const claim = await claimWebhookEvent(event);
  if (claim.outcome === "duplicate") {
    return {
      duplicate: true,
      handled: false,
      attemptCount: claim.attemptCount,
    };
  }
  if (claim.outcome === "processing") throw new WebhookEventInProgressError();
  if (!claim.leaseToken) throw new WebhookLeaseLostError();

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionEvent(event);
        break;
      default:
        break;
    }

    await markWebhookEventProcessed(event.id, claim.leaseToken);
    return {
      duplicate: false,
      handled: true,
      attemptCount: claim.attemptCount,
    };
  } catch (error) {
    await releaseWebhookEvent(event.id, claim.leaseToken, error);
    throw error;
  }
};
