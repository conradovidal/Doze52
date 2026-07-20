"use client";

import type { CalendarEvent } from "@/lib/types";

export type ProductOnboardingState = "pending" | "dismissed" | "completed";
export type ProductOnboardingKey = "create-event";
export type OnboardingContext = "personal" | "work" | "custom";
export type GuidedCreationIntent =
  | "dated_item"
  | "period"
  | "additional_context";

export type GuidedOnboardingStep =
  | "context_selection"
  | "custom_profile"
  | "date_instruction"
  | "date_details"
  | "period_instruction"
  | "period_details"
  | "use_case_preview"
  | "save"
  | "completed"
  | "dismissed";

export type GuidedOnboardingState = {
  version: 3;
  step: GuidedOnboardingStep;
  context?: OnboardingContext;
  startedAt?: string;
  profileConfiguredAt?: string;
  dateItemsCreated?: number;
  periodItemsCreated?: number;
  firstDateCreatedAt?: string;
  firstPeriodCreatedAt?: string;
  completedAt?: string;
  dismissedAt?: string;
};

export type GuidedOnboardingAction =
  | { type: "start"; at?: string }
  | { type: "choose_context"; context: OnboardingContext; at?: string }
  | { type: "configure_profile"; context: OnboardingContext; at?: string }
  | { type: "select_date" }
  | { type: "cancel_date" }
  | { type: "date_saved"; at?: string }
  | { type: "continue_to_periods" }
  | { type: "select_period" }
  | { type: "cancel_period" }
  | { type: "period_saved"; at?: string }
  | { type: "continue_to_preview" }
  | { type: "continue_from_preview" }
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

type LegacyGuidedOnboardingState = {
  version?: number;
  step?: string;
  startedAt?: string;
  firstItemCreatedAt?: string;
  firstPeriodCreatedAt?: string;
  completedAt?: string;
  dismissedAt?: string;
};

export const PRODUCT_ONBOARDING_STORAGE_KEY = "doze52:onboarding:v1";
export const GUIDED_ONBOARDING_STORAGE_KEY = "doze52:onboarding:v2";
export const PRODUCT_ONBOARDING_RESET_EVENT = "doze52:onboarding-reset";
export const GUIDED_ONBOARDING_CHANGE_EVENT = "doze52:onboarding-change";

const initialGuidedState = (): GuidedOnboardingState => ({
  version: 3,
  step: "context_selection",
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
    // Onboarding remains available for the current session.
  }
};

const isGuidedStep = (value: unknown): value is GuidedOnboardingStep =>
  value === "context_selection" ||
  value === "custom_profile" ||
  value === "date_instruction" ||
  value === "date_details" ||
  value === "period_instruction" ||
  value === "period_details" ||
  value === "use_case_preview" ||
  value === "save" ||
  value === "completed" ||
  value === "dismissed";

const isContext = (value: unknown): value is OnboardingContext =>
  value === "personal" || value === "work" || value === "custom";

export const migrateGuidedOnboardingState = (
  value: unknown
): GuidedOnboardingState => {
  if (typeof value !== "object" || value === null) return initialGuidedState();
  const candidate = value as LegacyGuidedOnboardingState & {
    context?: unknown;
    profileConfiguredAt?: string;
    firstDateCreatedAt?: string;
    dateItemsCreated?: number;
    periodItemsCreated?: number;
  };

  if (candidate.version === 3 && isGuidedStep(candidate.step)) {
    return {
      version: 3,
      step:
        candidate.step === "save" ? "use_case_preview" : candidate.step,
      context: isContext(candidate.context) ? candidate.context : undefined,
      startedAt: candidate.startedAt,
      profileConfiguredAt: candidate.profileConfiguredAt,
      dateItemsCreated:
        typeof candidate.dateItemsCreated === "number"
          ? Math.max(0, candidate.dateItemsCreated)
          : candidate.firstDateCreatedAt
            ? 1
            : 0,
      periodItemsCreated:
        typeof candidate.periodItemsCreated === "number"
          ? Math.max(0, candidate.periodItemsCreated)
          : candidate.firstPeriodCreatedAt
            ? 1
            : 0,
      firstDateCreatedAt: candidate.firstDateCreatedAt,
      firstPeriodCreatedAt: candidate.firstPeriodCreatedAt,
      completedAt: candidate.completedAt,
      dismissedAt: candidate.dismissedAt,
    };
  }

  if (candidate.version === 2) {
    if (candidate.step === "completed" || candidate.step === "dismissed") {
      return {
        version: 3,
        step: candidate.step,
        startedAt: candidate.startedAt,
        firstDateCreatedAt: candidate.firstItemCreatedAt,
        dateItemsCreated: candidate.firstItemCreatedAt ? 1 : 0,
        periodItemsCreated: candidate.firstPeriodCreatedAt ? 1 : 0,
        firstPeriodCreatedAt: candidate.firstPeriodCreatedAt,
        completedAt: candidate.completedAt,
        dismissedAt: candidate.dismissedAt,
      };
    }
    const migratedStep = candidate.firstPeriodCreatedAt
      ? "use_case_preview"
      : candidate.firstItemCreatedAt
        ? "period_instruction"
        : "context_selection";
    return {
      version: 3,
      step: migratedStep,
      context: candidate.firstItemCreatedAt ? "personal" : undefined,
      startedAt: candidate.startedAt,
      profileConfiguredAt: candidate.firstItemCreatedAt
        ? candidate.startedAt ?? candidate.firstItemCreatedAt
        : undefined,
      firstDateCreatedAt: candidate.firstItemCreatedAt,
      firstPeriodCreatedAt: candidate.firstPeriodCreatedAt,
      dateItemsCreated: candidate.firstItemCreatedAt ? 1 : 0,
      periodItemsCreated: candidate.firstPeriodCreatedAt ? 1 : 0,
    };
  }

  return initialGuidedState();
};

export const reduceGuidedOnboardingState = (
  state: GuidedOnboardingState,
  action: GuidedOnboardingAction
): GuidedOnboardingState => {
  switch (action.type) {
    case "start":
      return { ...state, startedAt: state.startedAt ?? action.at ?? nowIso() };
    case "choose_context":
      return state.step === "context_selection"
        ? {
            ...state,
            context: action.context,
            startedAt: state.startedAt ?? action.at ?? nowIso(),
            step: action.context === "custom" ? "custom_profile" : state.step,
          }
        : state;
    case "configure_profile":
      return state.step === "context_selection" || state.step === "custom_profile"
        ? {
            ...state,
            context: action.context,
            step: "date_instruction",
            startedAt: state.startedAt ?? action.at ?? nowIso(),
            profileConfiguredAt: action.at ?? nowIso(),
          }
        : state;
    case "select_date":
      return state.step === "date_instruction"
        ? { ...state, step: "date_details" }
        : state;
    case "cancel_date":
      return state.step === "date_details"
        ? { ...state, step: "date_instruction" }
        : state;
    case "date_saved":
      if (state.step !== "date_details") return state;
      const nextDateCount = (state.dateItemsCreated ?? 0) + 1;
      const dateTarget = state.context === "custom" ? 1 : 2;
      return {
        ...state,
        step: nextDateCount >= dateTarget ? "period_instruction" : "date_instruction",
        dateItemsCreated: nextDateCount,
        firstDateCreatedAt: state.firstDateCreatedAt ?? action.at ?? nowIso(),
      };
    case "continue_to_periods":
      return state.step === "date_instruction" && (state.dateItemsCreated ?? 0) > 0
        ? { ...state, step: "period_instruction" }
        : state;
    case "select_period":
      return state.step === "period_instruction"
        ? { ...state, step: "period_details" }
        : state;
    case "cancel_period":
      return state.step === "period_details"
        ? { ...state, step: "period_instruction" }
        : state;
    case "period_saved":
      if (state.step !== "period_details") return state;
      const nextPeriodCount = (state.periodItemsCreated ?? 0) + 1;
      const periodTarget = state.context === "custom" ? 1 : 2;
      return {
        ...state,
        step:
          nextPeriodCount >= periodTarget
            ? "use_case_preview"
            : "period_instruction",
        periodItemsCreated: nextPeriodCount,
        firstPeriodCreatedAt:
          state.firstPeriodCreatedAt ?? action.at ?? nowIso(),
      };
    case "continue_to_preview":
      return state.step === "period_instruction" &&
        (state.periodItemsCreated ?? 0) > 0
        ? { ...state, step: "use_case_preview" }
        : state;
    case "continue_from_preview":
      return state.step === "use_case_preview"
        ? { ...state, step: "save" }
        : state;
    case "complete":
      return {
        ...state,
        step: "completed",
        completedAt: action.at ?? nowIso(),
        dismissedAt: undefined,
      };
    case "dismiss":
      return {
        ...state,
        step: "dismissed",
        dismissedAt: action.at ?? nowIso(),
        completedAt: undefined,
      };
  }
};

export const readGuidedOnboardingState = (): GuidedOnboardingState => {
  if (typeof window === "undefined") return initialGuidedState();
  try {
    const raw = window.localStorage.getItem(GUIDED_ONBOARDING_STORAGE_KEY);
    return raw ? migrateGuidedOnboardingState(JSON.parse(raw) as unknown) : initialGuidedState();
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
    // The flow remains usable for the current session.
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
