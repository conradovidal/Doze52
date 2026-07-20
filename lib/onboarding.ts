"use client";

import type { CalendarEvent } from "@/lib/types";

export type ProductOnboardingState = "pending" | "dismissed" | "completed";
export type ProductOnboardingKey = "create-event";

export type GuidedOnboardingStep =
  | "intro"
  | "period_prompt"
  | "context_prompt"
  | "reflection"
  | "save"
  | "completed"
  | "dismissed";

export type GuidedReflection =
  | "busy_period"
  | "missing_priority"
  | "needs_context"
  | "too_early";

export type GuidedCreationIntent =
  | "dated_item"
  | "period"
  | "additional_context";

export type GuidedOnboardingState = {
  version: 2;
  step: GuidedOnboardingStep;
  startedAt?: string;
  firstItemCreatedAt?: string;
  firstPeriodCreatedAt?: string;
  reflection?: GuidedReflection;
  completedAt?: string;
  dismissedAt?: string;
};

export type GuidedOnboardingAction =
  | { type: "start"; at?: string }
  | { type: "item_created"; isPeriod: boolean; at?: string }
  | { type: "skip_period" }
  | { type: "continue_to_reflection" }
  | { type: "set_reflection"; reflection: GuidedReflection }
  | { type: "continue_reflection" }
  | { type: "skip_reflection" }
  | { type: "complete"; at?: string }
  | { type: "dismiss"; at?: string };

type ProductOnboardingPayload = Partial<
  Record<
    ProductOnboardingKey,
    {
      dismissedAt?: string;
      completedAt?: string;
    }
  >
>;

export const PRODUCT_ONBOARDING_STORAGE_KEY = "doze52:onboarding:v1";
export const GUIDED_ONBOARDING_STORAGE_KEY = "doze52:onboarding:v2";
export const PRODUCT_ONBOARDING_RESET_EVENT = "doze52:onboarding-reset";
export const GUIDED_ONBOARDING_CHANGE_EVENT = "doze52:onboarding-change";

const initialGuidedState = (): GuidedOnboardingState => ({
  version: 2,
  step: "intro",
});

const nowIso = () => new Date().toISOString();

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

const isGuidedStep = (value: unknown): value is GuidedOnboardingStep =>
  value === "intro" ||
  value === "period_prompt" ||
  value === "context_prompt" ||
  value === "reflection" ||
  value === "save" ||
  value === "completed" ||
  value === "dismissed";

const isGuidedReflection = (value: unknown): value is GuidedReflection =>
  value === "busy_period" ||
  value === "missing_priority" ||
  value === "needs_context" ||
  value === "too_early";

const normalizeGuidedState = (value: unknown): GuidedOnboardingState => {
  if (typeof value !== "object" || value === null) return initialGuidedState();
  const candidate = value as Partial<GuidedOnboardingState>;
  if (candidate.version !== 2 || !isGuidedStep(candidate.step)) {
    return initialGuidedState();
  }

  return {
    version: 2,
    step: candidate.step,
    startedAt:
      typeof candidate.startedAt === "string" ? candidate.startedAt : undefined,
    firstItemCreatedAt:
      typeof candidate.firstItemCreatedAt === "string"
        ? candidate.firstItemCreatedAt
        : undefined,
    firstPeriodCreatedAt:
      typeof candidate.firstPeriodCreatedAt === "string"
        ? candidate.firstPeriodCreatedAt
        : undefined,
    reflection: isGuidedReflection(candidate.reflection)
      ? candidate.reflection
      : undefined,
    completedAt:
      typeof candidate.completedAt === "string" ? candidate.completedAt : undefined,
    dismissedAt:
      typeof candidate.dismissedAt === "string" ? candidate.dismissedAt : undefined,
  };
};

export const reduceGuidedOnboardingState = (
  state: GuidedOnboardingState,
  action: GuidedOnboardingAction
): GuidedOnboardingState => {
  switch (action.type) {
    case "start":
      return {
        ...state,
        startedAt: state.startedAt ?? action.at ?? nowIso(),
      };
    case "item_created": {
      const createdAt = action.at ?? nowIso();
      const nextStep =
        state.step === "intro"
          ? action.isPeriod
            ? "context_prompt"
            : "period_prompt"
          : state.step === "period_prompt" && action.isPeriod
            ? "context_prompt"
            : state.step === "context_prompt"
              ? "reflection"
              : state.step;

      return {
        ...state,
        step: nextStep,
        startedAt: state.startedAt ?? createdAt,
        firstItemCreatedAt: state.firstItemCreatedAt ?? createdAt,
        firstPeriodCreatedAt:
          state.firstPeriodCreatedAt ?? (action.isPeriod ? createdAt : undefined),
      };
    }
    case "skip_period":
      return state.step === "period_prompt"
        ? { ...state, step: "context_prompt" }
        : state;
    case "continue_to_reflection":
      return state.step === "context_prompt"
        ? { ...state, step: "reflection" }
        : state;
    case "set_reflection":
      return state.step === "reflection"
        ? { ...state, reflection: action.reflection }
        : state;
    case "continue_reflection":
    case "skip_reflection":
      return state.step === "reflection" ? { ...state, step: "save" } : state;
    case "complete": {
      const completedAt = action.at ?? nowIso();
      return {
        ...state,
        step: "completed",
        completedAt,
        dismissedAt: undefined,
      };
    }
    case "dismiss": {
      const dismissedAt = action.at ?? nowIso();
      return {
        ...state,
        step: "dismissed",
        dismissedAt,
        completedAt: undefined,
      };
    }
  }
};

export const readGuidedOnboardingState = (): GuidedOnboardingState => {
  if (typeof window === "undefined") return initialGuidedState();
  try {
    const raw = window.localStorage.getItem(GUIDED_ONBOARDING_STORAGE_KEY);
    if (!raw) return initialGuidedState();
    return normalizeGuidedState(JSON.parse(raw) as unknown);
  } catch {
    return initialGuidedState();
  }
};

const writeGuidedOnboardingState = (state: GuidedOnboardingState) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      GUIDED_ONBOARDING_STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch {
    // The flow remains usable for the current session when storage is unavailable.
  }
};

export const dispatchGuidedOnboarding = (
  action: GuidedOnboardingAction
): GuidedOnboardingState => {
  const next = reduceGuidedOnboardingState(readGuidedOnboardingState(), action);
  writeGuidedOnboardingState(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<GuidedOnboardingState>(GUIDED_ONBOARDING_CHANGE_EVENT, {
        detail: next,
      })
    );
  }
  return next;
};

export const isGuidedOnboardingInProgress = (state: GuidedOnboardingState) =>
  Boolean(state.startedAt) &&
  state.step !== "completed" &&
  state.step !== "dismissed";

export const hasAuthorCalendarEvents = (
  events: Array<Pick<CalendarEvent, "calendarPackGroupId">>
) => events.some((event) => !event.calendarPackGroupId);

export const shouldShowGuidedOnboarding = (input: {
  state: GuidedOnboardingState;
  legacyState: ProductOnboardingState;
  hasAuthorEvents: boolean;
  authLoading: boolean;
  isAuthenticated: boolean;
  remoteReady: boolean;
}) => {
  if (input.state.step === "completed" || input.state.step === "dismissed") {
    return false;
  }

  const inProgress = isGuidedOnboardingInProgress(input.state);
  if (!inProgress && input.legacyState !== "pending") return false;
  if (!inProgress && input.hasAuthorEvents) return false;
  if (input.authLoading) return false;
  if (input.isAuthenticated && !input.remoteReady) return false;
  return true;
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
  const timestamp = nowIso();
  payload[key] =
    state === "completed"
      ? { completedAt: timestamp }
      : { dismissedAt: timestamp };
  writePayload(payload);
};

export const resetAllProductOnboarding = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PRODUCT_ONBOARDING_STORAGE_KEY);
    window.localStorage.removeItem(GUIDED_ONBOARDING_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
  window.dispatchEvent(new CustomEvent(PRODUCT_ONBOARDING_RESET_EVENT));
};
