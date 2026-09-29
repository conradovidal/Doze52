export type BillingPlan = "free" | "pro";

export type BillingStatusPayload = {
  plan: BillingPlan;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canManageBilling: boolean;
};

export const FREE_BILLING_STATUS: BillingStatusPayload = {
  plan: "free",
  status: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  canManageBilling: false,
};

export type PlanLimits = {
  maxProfiles: number | null;
  maxCategories: number | null;
  maxCalendarSubscriptions: number | null;
  maxHabits: number | null;
  maxHabitContexts: number | null;
};

export type ProUpgradeReason =
  | "profiles"
  | "categories"
  | "calendar-subscriptions"
  | "calendar-import-export"
  | "habits"
  | "habit-contexts"
  | "generic";

export const PRO_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

export const PLAN_LIMITS: Record<BillingPlan, PlanLimits> = {
  free: {
    maxProfiles: 1,
    maxCategories: 3,
    maxCalendarSubscriptions: 1,
    maxHabits: 1,
    maxHabitContexts: 1,
  },
  pro: {
    maxProfiles: null,
    maxCategories: null,
    maxCalendarSubscriptions: null,
    // Ilimitado para a pessoa; o servidor ainda guarda um teto técnico contra
    // abuso (ver continuity_plan_ceilings), como já faz com contextos e
    // categorias dos Eventos.
    maxHabits: null,
    maxHabitContexts: null,
  },
};

export const FOUNDER_PRICE_LABEL = "R$ 12,52/mês";

export const PRO_UPGRADE_COPY: Record<
  ProUpgradeReason,
  { title: string; description: string; cta: string }
> = {
  profiles: {
    title: "Cada parte da vida no seu lugar",
    description:
      "No plano gratuito você usa 1 contexto. Com o Pro, trabalho, casa, viagens e família ganham o espaço de cada um.",
    cta: "Assinar Pro",
  },
  categories: {
    title: "Dê nome a tudo que importa",
    description:
      "No plano gratuito são 3 categorias. Com o Pro, seu ano ganha todas as cores que precisar.",
    cta: "Assinar Pro",
  },
  "calendar-subscriptions": {
    title: "Todas as datas importantes, sem esforço",
    description:
      "No plano gratuito você assina 1 calendário pronto. Com o Pro, quantos quiser, sempre atualizados.",
    cta: "Assinar Pro",
  },
  "calendar-import-export": {
    title: "Traga seu ano de uma planilha",
    description:
      "Com o Pro você baixa o modelo, exporta o calendário e importa eventos em lote, com pré-visualização.",
    cta: "Assinar Pro",
  },
  habits: {
    title: "Acompanhe todas as suas rotinas",
    description:
      "No plano gratuito você acompanha 1 hábito. Com o Pro, quantos hábitos quiser no mesmo ano.",
    cta: "Assinar Pro",
  },
  "habit-contexts": {
    title: "Cada rotina no seu lugar",
    description:
      "No plano gratuito seus hábitos ficam em 1 contexto. Com o Pro, saúde, estudos e casa ganham o espaço de cada um.",
    cta: "Assinar Pro",
  },
  generic: {
    title: "Seu ano inteiro, sem limites",
    description:
      "Mais contextos, categorias, calendários e hábitos para organizar o que importa.",
    cta: "Assinar Pro",
  },
};

export const isProSubscriptionStatus = (status: string | null | undefined) =>
  PRO_SUBSCRIPTION_STATUSES.some((proStatus) => proStatus === status);

export const isProPlan = (plan: BillingPlan) => plan === "pro";

export const isCalendarSpreadsheetProGateEnabled = (input?: {
  nodeEnv?: string;
  deploymentEnv?: string;
}) => {
  const nodeEnv = input?.nodeEnv ?? process.env.NODE_ENV;
  const deploymentEnv =
    input?.deploymentEnv ?? process.env.NEXT_PUBLIC_VERCEL_ENV;
  return deploymentEnv ? deploymentEnv === "production" : nodeEnv === "production";
};

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
