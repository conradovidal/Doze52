export type BillingPlan = "free" | "pro";

export type BillingStatusPayload = {
  plan: BillingPlan;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canManageBilling: boolean;
};

export type PlanLimits = {
  maxProfiles: number | null;
  maxCategories: number | null;
  maxCalendarSubscriptions: number | null;
};

export type ProUpgradeReason =
  | "profiles"
  | "categories"
  | "calendar-subscriptions"
  | "generic";

export const PRO_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

export const PLAN_LIMITS: Record<BillingPlan, PlanLimits> = {
  free: {
    maxProfiles: 1,
    maxCategories: 3,
    maxCalendarSubscriptions: 1,
  },
  pro: {
    maxProfiles: null,
    maxCategories: null,
    maxCalendarSubscriptions: null,
  },
};

export const FOUNDER_PRICE_LABEL = "R$ 12,52/mês";

export const PRO_UPGRADE_COPY: Record<
  ProUpgradeReason,
  { title: string; description: string; cta: string }
> = {
  profiles: {
    title: "Perfis múltiplos fazem parte do Doze52 Pro.",
    description:
      "No plano gratuito, você pode usar 1 perfil. O Pro libera mais espaços para organizar trabalho, vida pessoal, viagens e família.",
    cta: `Assinar Pro por ${FOUNDER_PRICE_LABEL}`,
  },
  categories: {
    title: "Mais categorias fazem parte do Doze52 Pro.",
    description:
      "No plano gratuito, você pode usar até 3 categorias. O Pro libera mais organização para o seu ano.",
    cta: `Assinar Pro por ${FOUNDER_PRICE_LABEL}`,
  },
  "calendar-subscriptions": {
    title: "Mais calendários fazem parte do Doze52 Pro.",
    description:
      "No plano gratuito, você pode usar 1 calendário. O Pro libera mais calendários para acompanhar datas importantes no seu ano.",
    cta: `Assinar Pro por ${FOUNDER_PRICE_LABEL}`,
  },
  generic: {
    title: "Doze52 Pro",
    description: "Organize mais partes do seu ano.",
    cta: "Assinar Pro",
  },
};

export const isProSubscriptionStatus = (status: string | null | undefined) =>
  PRO_SUBSCRIPTION_STATUSES.some((proStatus) => proStatus === status);

export const isProPlan = (plan: BillingPlan) => plan === "pro";

export const getPlanLimits = (plan: BillingPlan) => PLAN_LIMITS[plan];

export const isLimitReached = (count: number, limit: number | null) =>
  typeof limit === "number" && count >= limit;

export const resolveBillingPlan = (input: {
  status: string | null | undefined;
  currentPeriodEnd?: string | null;
}): BillingPlan => {
  if (!isProSubscriptionStatus(input.status)) return "free";
  if (!input.currentPeriodEnd) return "pro";

  const currentPeriodEndTime = Date.parse(input.currentPeriodEnd);
  if (Number.isNaN(currentPeriodEndTime)) return "pro";

  return currentPeriodEndTime > Date.now() ? "pro" : "free";
};
