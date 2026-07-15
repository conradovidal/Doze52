import type { BillingStatusPayload } from "@/lib/entitlements";

export type BillingTestPlan =
  | "free"
  | "pro"
  | "loading"
  | "error"
  | "canceled_active"
  | "expired";

export type BillingTestModeConfig = {
  plan: BillingTestPlan;
  label: string;
};

export const BILLING_TEST_PLAN_LABELS: Record<BillingTestPlan, string> = {
  free: "Free",
  pro: "Pro",
  loading: "Loading",
  error: "Error",
  canceled_active: "Canceled active",
  expired: "Expired",
};

const BILLING_TEST_PLANS = new Set<string>([
  "free",
  "pro",
  "loading",
  "error",
  "canceled_active",
  "expired",
]);

const DAY_MS = 24 * 60 * 60 * 1000;

const toBillingTestPlan = (
  value: string | undefined
): BillingTestPlan | null => {
  if (!value || !BILLING_TEST_PLANS.has(value)) return null;
  return value as BillingTestPlan;
};

export const getBillingTestMode = (): BillingTestModeConfig | null => {
  if (process.env.NODE_ENV !== "development") return null;
  if (process.env.NEXT_PUBLIC_BILLING_TEST_MODE !== "true") return null;

  const plan =
    toBillingTestPlan(process.env.NEXT_PUBLIC_BILLING_TEST_PLAN) ?? "free";

  return {
    plan,
    label: BILLING_TEST_PLAN_LABELS[plan],
  };
};

export const getBillingTestStatus = (
  plan: BillingTestPlan
): BillingStatusPayload => {
  const futurePeriodEnd = new Date(Date.now() + 30 * DAY_MS).toISOString();
  const pastPeriodEnd = new Date(Date.now() - DAY_MS).toISOString();

  switch (plan) {
    case "pro":
      return {
        plan: "pro",
        status: "active",
        currentPeriodEnd: futurePeriodEnd,
        cancelAtPeriodEnd: false,
        canManageBilling: false,
      };
    case "canceled_active":
      return {
        plan: "pro",
        status: "active",
        currentPeriodEnd: futurePeriodEnd,
        cancelAtPeriodEnd: true,
        canManageBilling: false,
      };
    case "expired":
      return {
        plan: "free",
        status: "expired",
        currentPeriodEnd: pastPeriodEnd,
        cancelAtPeriodEnd: false,
        canManageBilling: false,
      };
    case "free":
    case "loading":
    case "error":
    default:
      return {
        plan: "free",
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        canManageBilling: false,
      };
  }
};

export const getBillingTestError = (plan: BillingTestPlan) =>
  plan === "error"
    ? new Error("Billing test mode simulated a billing status failure.")
    : null;
