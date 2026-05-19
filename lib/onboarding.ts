"use client";

export type ProductOnboardingState = "pending" | "dismissed" | "completed";
export type ProductOnboardingKey = "create-event";

type ProductOnboardingPayload = Partial<Record<ProductOnboardingKey, {
  dismissedAt?: string;
  completedAt?: string;
}>>;

export const PRODUCT_ONBOARDING_STORAGE_KEY = "doze52:onboarding:v1";
export const PRODUCT_ONBOARDING_RESET_EVENT = "doze52:onboarding-reset";

const readPayload = (): ProductOnboardingPayload => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PRODUCT_ONBOARDING_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProductOnboardingPayload;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
};

const writePayload = (payload: ProductOnboardingPayload) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PRODUCT_ONBOARDING_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch {
    // Ignore persistence issues; onboarding will simply not persist.
  }
};

export const readProductOnboardingState = (
  key: ProductOnboardingKey
): ProductOnboardingState => {
  const payload = readPayload();
  const entry = payload[key];
  if (entry?.completedAt) return "completed";
  if (entry?.dismissedAt) return "dismissed";
  return "pending";
};

export const setProductOnboardingState = (
  key: ProductOnboardingKey,
  state: Exclude<ProductOnboardingState, "pending">
) => {
  const payload = readPayload();
  const nowIso = new Date().toISOString();
  payload[key] =
    state === "completed" ? { completedAt: nowIso } : { dismissedAt: nowIso };
  writePayload(payload);
};

export const resetAllProductOnboarding = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PRODUCT_ONBOARDING_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
  window.dispatchEvent(new CustomEvent(PRODUCT_ONBOARDING_RESET_EVENT));
};
