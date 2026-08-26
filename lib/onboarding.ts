"use client";

import type { CalendarEvent } from "@/lib/types";

export type ProductOnboardingState = "pending" | "dismissed" | "completed";
export type ProductOnboardingKey = "create-event";
export type OnboardingContext = "personal" | "work";
export type OnboardingCategoryChoice = "specific" | "generic";
export type OnboardingFocusTarget =
  | { kind: "profile"; id: string }
  | { kind: "category"; id: string; effect?: "focus" | "reveal" }
  | null;
export type GuidedCreationIntent =
  | "dated_item"
  | "period"
  | "additional_context";

export type GuidedOnboardingStep =
  | "context_selection"
  | "date_category_selection"
  | "date_category_reveal"
  | "date_instruction"
  | "date_details"
  | "period_category_selection"
  | "period_category_reveal"
  | "period_instruction"
  | "period_details"
  | "edit_instruction"
  | "edit_preview"
  | "calendar_instruction"
  | "calendar_selection"
  | "year_instruction"
  | "period_navigation_instruction"
  | "habit_surface_instruction"
  | "habit_instruction"
  | "habit_created_confirmation"
  | "profile_instruction"
  | "appearance_instruction"
  | "theme_instruction"
  | "demo_exploration"
  | "dismissed_preserved"
  | "completed"
  | "dismissed";

export type GuidedOnboardingState = {
  version: 13;
  step: GuidedOnboardingStep;
  context?: OnboardingContext;
  startedAt?: string;
  profileConfiguredAt?: string;
  dateCategoryId?: string;
  periodCategoryId?: string;
  categoryRevealStartedAt?: string;
  dateItemsCreated?: number;
  periodItemsCreated?: number;
  firstDateCreatedAt?: string;
  firstPeriodCreatedAt?: string;
  themeConfirmedAt?: string;
  firstHabitCreatedAt?: string;
  periodNavigationInteractedAt?: string;
  profileOpenedAt?: string;
  appearanceOpenedAt?: string;
  holidayUf?: string;
  holidayCalendarAddedAt?: string;
  postOnboardingEventsCreated?: number;
  postOnboardingCategoriesCreated?: number;
  accountNudgeShownAt?: string;
  demoExplorationStartedAt?: string;
  demoInteractionKeys?: string[];
  demoInviteEligibleAt?: string;
  postExitCreationKeys?: string[];
  exitConfirmedAt?: string;
  completedAt?: string;
  dismissedAt?: string;
};

export type GuidedOnboardingAction =
  | { type: "start"; at?: string }
  | { type: "configure_profile"; context: OnboardingContext; at?: string }
  | { type: "choose_date_category"; categoryId: string; at?: string }
  | { type: "finish_category_reveal" }
  | { type: "select_date" }
  | { type: "date_saved"; at?: string }
  | { type: "choose_period_category"; categoryId: string; at?: string }
  | { type: "select_period" }
  | { type: "period_saved"; at?: string }
  | { type: "open_edit_preview" }
  | { type: "finish_edit_preview" }
  | { type: "open_calendar" }
  | { type: "close_calendar" }
  | { type: "calendar_added"; uf?: string; at?: string }
  | { type: "continue_from_year"; showPeriodNavigation?: boolean; at?: string }
  | { type: "continue_from_period_navigation"; showHabit?: boolean; at?: string }
  | { type: "interact_with_period_navigation"; at?: string }
  | { type: "open_habits_surface"; at?: string }
  | { type: "habit_saved"; at?: string }
  | { type: "return_to_year"; at?: string }
  | { type: "open_profile"; at?: string }
  | { type: "open_appearance"; at?: string }
  | { type: "confirm_theme"; complete?: boolean; at?: string }
  | { type: "complete"; at?: string }
  | { type: "record_post_onboarding_event"; at?: string }
  | { type: "enter_demo_exploration"; at?: string }
  | { type: "record_demo_interaction"; key: string; at?: string }
  | { type: "restart_from_demo" }
  | { type: "dismiss_preserving"; at?: string }
  | { type: "record_post_exit_creation"; key: string; at?: string }
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
  context?: unknown;
  startedAt?: string;
  profileConfiguredAt?: string;
  firstItemCreatedAt?: string;
  firstDateCreatedAt?: string;
  firstPeriodCreatedAt?: string;
  categoryRevealStartedAt?: string;
  themeConfirmedAt?: string;
  firstHabitCreatedAt?: string;
  periodNavigationInteractedAt?: string;
  profileOpenedAt?: string;
  appearanceOpenedAt?: string;
  holidayUf?: string;
  holidayCalendarAddedAt?: string;
  dateItemsCreated?: number;
  periodItemsCreated?: number;
  demoExplorationStartedAt?: string;
  demoInteractionKeys?: unknown;
  demoInviteEligibleAt?: string;
  postExitCreationKeys?: unknown;
  exitConfirmedAt?: string;
  completedAt?: string;
  dismissedAt?: string;
};

export const PRODUCT_ONBOARDING_STORAGE_KEY = "doze52:onboarding:v1";
export const GUIDED_ONBOARDING_STORAGE_KEY = "doze52:onboarding:v2";
export const PRODUCT_ONBOARDING_RESET_EVENT = "doze52:onboarding-reset";
export const GUIDED_ONBOARDING_CHANGE_EVENT = "doze52:onboarding-change";
export const GUIDED_CATEGORY_REVEAL_MS = 1_800;
export const GUIDED_DEMO_INTERACTION_THRESHOLD = 5;

export const getGuidedCategoryRevealRemainingMs = (
  startedAt: string | undefined,
  now = Date.now()
) => {
  const parsedStartedAt = Date.parse(startedAt ?? "");
  if (!Number.isFinite(parsedStartedAt)) return GUIDED_CATEGORY_REVEAL_MS;
  return Math.max(
    0,
    GUIDED_CATEGORY_REVEAL_MS - Math.max(0, now - parsedStartedAt)
  );
};

const initialGuidedState = (): GuidedOnboardingState => ({
  version: 13,
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
  value === "date_category_selection" ||
  value === "date_category_reveal" ||
  value === "date_instruction" ||
  value === "date_details" ||
  value === "period_category_selection" ||
  value === "period_category_reveal" ||
  value === "period_instruction" ||
  value === "period_details" ||
  value === "edit_instruction" ||
  value === "edit_preview" ||
  value === "calendar_instruction" ||
  value === "calendar_selection" ||
  value === "year_instruction" ||
  value === "period_navigation_instruction" ||
  value === "habit_surface_instruction" ||
  value === "habit_instruction" ||
  value === "habit_created_confirmation" ||
  value === "profile_instruction" ||
  value === "appearance_instruction" ||
  value === "theme_instruction" ||
  value === "demo_exploration" ||
  value === "dismissed_preserved" ||
  value === "completed" ||
  value === "dismissed";

const isContext = (value: unknown): value is OnboardingContext =>
  value === "personal" || value === "work";

const hasLegacyProgress = (candidate: LegacyGuidedOnboardingState) =>
  Boolean(
    candidate.firstItemCreatedAt ||
      candidate.firstDateCreatedAt ||
      candidate.firstPeriodCreatedAt ||
      (candidate.dateItemsCreated ?? 0) > 0 ||
      (candidate.periodItemsCreated ?? 0) > 0
  );

export const migrateGuidedOnboardingState = (
  value: unknown
): GuidedOnboardingState => {
  if (typeof value !== "object" || value === null) return initialGuidedState();
  const candidate = value as LegacyGuidedOnboardingState & {
    dateCategoryId?: unknown;
    periodCategoryId?: unknown;
    postOnboardingEventsCreated?: unknown;
    postOnboardingCategoriesCreated?: unknown;
    accountNudgeShownAt?: unknown;
    categoryRevealStartedAt?: unknown;
  };

  if (
    (candidate.version === 9 || candidate.version === 10 || candidate.version === 11 || candidate.version === 12 || candidate.version === 13) &&
    isGuidedStep(candidate.step)
  ) {
    const demoInteractionKeys = Array.isArray(candidate.demoInteractionKeys)
      ? [
          ...new Set(
            candidate.demoInteractionKeys.filter(
              (key): key is string =>
                typeof key === "string" && key.trim().length > 0
            )
          ),
        ]
      : [];
    return {
      version: 13,
      step:
        candidate.version === 11 && candidate.step === "theme_instruction"
          ? "profile_instruction"
          : candidate.step,
      context: isContext(candidate.context) ? candidate.context : undefined,
      startedAt: candidate.startedAt,
      profileConfiguredAt: candidate.profileConfiguredAt,
      dateCategoryId:
        typeof candidate.dateCategoryId === "string"
          ? candidate.dateCategoryId
          : undefined,
      periodCategoryId:
        typeof candidate.periodCategoryId === "string"
          ? candidate.periodCategoryId
          : undefined,
      categoryRevealStartedAt:
        typeof candidate.categoryRevealStartedAt === "string"
          ? candidate.categoryRevealStartedAt
          : undefined,
      dateItemsCreated:
        typeof candidate.dateItemsCreated === "number"
          ? Math.max(0, candidate.dateItemsCreated)
          : 0,
      periodItemsCreated:
        typeof candidate.periodItemsCreated === "number"
          ? Math.max(0, candidate.periodItemsCreated)
          : 0,
      firstDateCreatedAt: candidate.firstDateCreatedAt,
      firstPeriodCreatedAt: candidate.firstPeriodCreatedAt,
      themeConfirmedAt: candidate.themeConfirmedAt,
      firstHabitCreatedAt: candidate.firstHabitCreatedAt,
      periodNavigationInteractedAt: candidate.periodNavigationInteractedAt,
      profileOpenedAt: candidate.profileOpenedAt,
      appearanceOpenedAt: candidate.appearanceOpenedAt,
      holidayUf:
        typeof candidate.holidayUf === "string" ? candidate.holidayUf : undefined,
      holidayCalendarAddedAt: candidate.holidayCalendarAddedAt,
      postOnboardingEventsCreated:
        typeof candidate.postOnboardingEventsCreated === "number"
          ? Math.max(0, candidate.postOnboardingEventsCreated)
          : 0,
      postOnboardingCategoriesCreated: 0,
      accountNudgeShownAt:
        typeof candidate.accountNudgeShownAt === "string"
          ? candidate.accountNudgeShownAt
          : undefined,
      demoExplorationStartedAt: candidate.demoExplorationStartedAt,
      demoInteractionKeys,
      demoInviteEligibleAt: candidate.demoInviteEligibleAt,
      postExitCreationKeys: Array.isArray(candidate.postExitCreationKeys)
        ? [...new Set(candidate.postExitCreationKeys.filter((key): key is string => typeof key === "string" && key.length > 0))]
        : [],
      exitConfirmedAt: candidate.exitConfirmedAt,
      completedAt: candidate.completedAt,
      dismissedAt: candidate.dismissedAt,
    };
  }

  if (candidate.version === 8 && isGuidedStep(candidate.step)) {
    return {
      version: 13,
      step: candidate.step,
      context: isContext(candidate.context) ? candidate.context : undefined,
      startedAt: candidate.startedAt,
      profileConfiguredAt: candidate.profileConfiguredAt,
      dateCategoryId:
        typeof candidate.dateCategoryId === "string"
          ? candidate.dateCategoryId
          : undefined,
      periodCategoryId:
        typeof candidate.periodCategoryId === "string"
          ? candidate.periodCategoryId
          : undefined,
      dateItemsCreated:
        typeof candidate.dateItemsCreated === "number"
          ? Math.max(0, candidate.dateItemsCreated)
          : 0,
      periodItemsCreated:
        typeof candidate.periodItemsCreated === "number"
          ? Math.max(0, candidate.periodItemsCreated)
          : 0,
      firstDateCreatedAt: candidate.firstDateCreatedAt,
      firstPeriodCreatedAt: candidate.firstPeriodCreatedAt,
      themeConfirmedAt: candidate.themeConfirmedAt,
      holidayUf:
        typeof candidate.holidayUf === "string" ? candidate.holidayUf : undefined,
      holidayCalendarAddedAt: candidate.holidayCalendarAddedAt,
      postOnboardingEventsCreated:
        typeof candidate.postOnboardingEventsCreated === "number"
          ? Math.max(0, candidate.postOnboardingEventsCreated)
          : 0,
      postOnboardingCategoriesCreated: 0,
      accountNudgeShownAt:
        typeof candidate.accountNudgeShownAt === "string"
          ? candidate.accountNudgeShownAt
          : undefined,
      completedAt: candidate.completedAt,
      dismissedAt: candidate.dismissedAt,
    };
  }

  if (
    (candidate.version === 4 ||
      candidate.version === 5 ||
      candidate.version === 6 ||
      candidate.version === 7) &&
    typeof candidate.step === "string"
  ) {
    const dateItemsCreated =
      typeof candidate.dateItemsCreated === "number"
        ? Math.max(0, candidate.dateItemsCreated)
        : candidate.firstDateCreatedAt
          ? 1
          : 0;
    const periodItemsCreated =
      typeof candidate.periodItemsCreated === "number"
        ? Math.max(0, candidate.periodItemsCreated)
        : candidate.firstPeriodCreatedAt
          ? 1
          : 0;
    const themeConfirmedAt =
      typeof candidate.themeConfirmedAt === "string"
        ? candidate.themeConfirmedAt
        : candidate.version === 5 && candidate.step === "completion_choice"
          ? candidate.completedAt ?? nowIso()
          : undefined;
    let step: GuidedOnboardingStep;

    if (candidate.step === "completed" || candidate.step === "dismissed") {
      step = candidate.step;
    } else if (candidate.step === "context_selection") {
      step = "context_selection";
    } else if (
      candidate.step === "profile_reveal" ||
      candidate.step === "date_category_selection"
    ) {
      step = "date_category_selection";
    } else if (
      candidate.step === "date_instruction" ||
      candidate.step === "date_details" ||
      candidate.step === "period_category_selection" ||
      candidate.step === "period_instruction" ||
      candidate.step === "period_details"
    ) {
      step = candidate.step;
    } else {
      step = periodItemsCreated >= 2
        ? "calendar_instruction"
        : "period_category_selection";
    }

    return {
      version: 13,
      step,
      context: isContext(candidate.context) ? candidate.context : undefined,
      startedAt: candidate.startedAt,
      profileConfiguredAt: candidate.profileConfiguredAt,
      dateCategoryId:
        typeof candidate.dateCategoryId === "string"
          ? candidate.dateCategoryId
          : undefined,
      periodCategoryId:
        typeof candidate.periodCategoryId === "string"
          ? candidate.periodCategoryId
          : undefined,
      dateItemsCreated,
      periodItemsCreated,
      firstDateCreatedAt: candidate.firstDateCreatedAt,
      firstPeriodCreatedAt: candidate.firstPeriodCreatedAt,
      themeConfirmedAt,
      postOnboardingEventsCreated:
        typeof candidate.postOnboardingEventsCreated === "number"
          ? Math.max(0, candidate.postOnboardingEventsCreated)
          : 0,
      postOnboardingCategoriesCreated: 0,
      accountNudgeShownAt:
        typeof candidate.accountNudgeShownAt === "string"
          ? candidate.accountNudgeShownAt
          : undefined,
      completedAt: candidate.completedAt,
      dismissedAt: candidate.dismissedAt,
    };
  }

  if (candidate.version === 2 || candidate.version === 3) {
    const terminal =
      candidate.step === "completed" || candidate.step === "dismissed";
    const preserveAsCompleted = !terminal && hasLegacyProgress(candidate);
    return {
      version: 13,
      step: terminal
        ? (candidate.step as "completed" | "dismissed")
        : preserveAsCompleted
          ? "completed"
          : "context_selection",
      context: isContext(candidate.context) ? candidate.context : undefined,
      startedAt: candidate.startedAt,
      profileConfiguredAt: candidate.profileConfiguredAt,
      firstDateCreatedAt:
        candidate.firstDateCreatedAt ?? candidate.firstItemCreatedAt,
      firstPeriodCreatedAt: candidate.firstPeriodCreatedAt,
      dateItemsCreated: Math.max(
        candidate.dateItemsCreated ?? 0,
        candidate.firstDateCreatedAt || candidate.firstItemCreatedAt ? 1 : 0
      ),
      periodItemsCreated: Math.max(
        candidate.periodItemsCreated ?? 0,
        candidate.firstPeriodCreatedAt ? 1 : 0
      ),
      completedAt:
        candidate.step === "completed" || preserveAsCompleted
          ? candidate.completedAt ?? nowIso()
          : undefined,
      dismissedAt:
        candidate.step === "dismissed" ? candidate.dismissedAt ?? nowIso() : undefined,
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
    case "configure_profile":
      return state.step === "context_selection"
        ? {
            ...state,
            context: action.context,
            step: "date_category_selection",
            startedAt: state.startedAt ?? action.at ?? nowIso(),
            profileConfiguredAt: action.at ?? nowIso(),
          }
        : state;
    case "choose_date_category":
      return state.step === "date_category_selection"
        ? {
            ...state,
            dateCategoryId: action.categoryId,
            step: "date_category_reveal",
            categoryRevealStartedAt: action.at ?? nowIso(),
          }
        : state;
    case "finish_category_reveal":
      if (state.step === "date_category_reveal") {
        return {
          ...state,
          step: "date_instruction",
          categoryRevealStartedAt: undefined,
        };
      }
      if (state.step === "period_category_reveal") {
        return {
          ...state,
          step: "period_instruction",
          categoryRevealStartedAt: undefined,
        };
      }
      return state;
    case "select_date":
      return state.step === "date_instruction" && Boolean(state.dateCategoryId)
        ? { ...state, step: "date_details" }
        : state;
    case "date_saved":
      if (state.step !== "date_details") return state;
      const nextDateCount = (state.dateItemsCreated ?? 0) + 1;
      return {
        ...state,
        step:
          nextDateCount >= 2
            ? "period_category_selection"
            : "date_instruction",
        dateItemsCreated: nextDateCount,
        firstDateCreatedAt: state.firstDateCreatedAt ?? action.at ?? nowIso(),
      };
    case "choose_period_category":
      return state.step === "period_category_selection"
        ? {
            ...state,
            periodCategoryId: action.categoryId,
            step: "period_category_reveal",
            categoryRevealStartedAt: action.at ?? nowIso(),
          }
        : state;
    case "select_period":
      return state.step === "period_instruction" && Boolean(state.periodCategoryId)
        ? { ...state, step: "period_details" }
        : state;
    case "period_saved":
      if (state.step !== "period_details") return state;
      const nextPeriodCount = (state.periodItemsCreated ?? 0) + 1;
      return {
        ...state,
        step:
          nextPeriodCount >= 2
            ? "edit_instruction"
            : "period_instruction",
        periodItemsCreated: nextPeriodCount,
        firstPeriodCreatedAt:
          state.firstPeriodCreatedAt ?? action.at ?? nowIso(),
      };
    case "open_edit_preview":
      return state.step === "edit_instruction"
        ? { ...state, step: "edit_preview" }
        : state;
    case "finish_edit_preview":
      return state.step === "edit_preview"
        ? { ...state, step: "calendar_instruction" }
        : state;
    case "open_calendar":
      return state.step === "calendar_instruction"
        ? { ...state, step: "calendar_selection" }
        : state;
    case "close_calendar":
      return state.step === "calendar_selection"
        ? { ...state, step: "calendar_instruction" }
        : state;
    case "calendar_added":
      return state.step === "calendar_instruction" ||
        state.step === "calendar_selection"
        ? {
            ...state,
            step: "year_instruction",
            holidayUf: action.uf ?? state.holidayUf,
            holidayCalendarAddedAt:
              state.holidayCalendarAddedAt ?? action.at ?? nowIso(),
          }
        : state;
    case "continue_from_year":
      if (state.step !== "year_instruction") return state;
      if (action.showPeriodNavigation) {
        return { ...state, step: "period_navigation_instruction" };
      }
      if (!state.themeConfirmedAt) {
        return { ...state, step: "theme_instruction" };
      }
      return {
        ...state,
        step: "completed",
        postOnboardingEventsCreated: 0,
        postOnboardingCategoriesCreated: 0,
        accountNudgeShownAt: undefined,
        completedAt: action.at ?? nowIso(),
        dismissedAt: undefined,
      };
    case "continue_from_period_navigation":
      if (state.step !== "period_navigation_instruction") return state;
      return {
        ...state,
        step: action.showHabit ? "habit_surface_instruction" : "theme_instruction",
      };
    case "interact_with_period_navigation":
      return state.step === "period_navigation_instruction" && !state.periodNavigationInteractedAt
        ? { ...state, periodNavigationInteractedAt: action.at ?? nowIso() }
        : state;
    case "open_habits_surface":
      return state.step === "habit_surface_instruction"
        ? { ...state, step: "habit_instruction" }
        : state;
    case "habit_saved":
      return state.step === "habit_instruction"
        ? {
            ...state,
            step: "habit_created_confirmation",
            firstHabitCreatedAt: action.at ?? nowIso(),
          }
        : state;
    case "return_to_year":
      return state.step === "habit_created_confirmation"
        ? { ...state, step: "profile_instruction" }
        : state;
    case "open_profile":
      return state.step === "profile_instruction"
        ? {
            ...state,
            step: "appearance_instruction",
            profileOpenedAt: action.at ?? nowIso(),
          }
        : state;
    case "open_appearance":
      return state.step === "appearance_instruction"
        ? {
            ...state,
            step: "theme_instruction",
            appearanceOpenedAt: action.at ?? nowIso(),
          }
        : state;
    case "confirm_theme":
      if (state.step !== "theme_instruction") return state;
      if (!action.complete) {
        return { ...state, themeConfirmedAt: action.at ?? nowIso() };
      }
      return {
        ...state,
        step: "completed",
        themeConfirmedAt: state.themeConfirmedAt ?? action.at ?? nowIso(),
        postOnboardingEventsCreated: 0,
        postOnboardingCategoriesCreated: 0,
        accountNudgeShownAt: undefined,
        completedAt: action.at ?? nowIso(),
        dismissedAt: undefined,
      };
    case "complete":
      if (
        state.step !== "year_instruction" &&
        (state.step !== "theme_instruction" || !state.themeConfirmedAt)
      ) {
        return state;
      }
      return {
        ...state,
        step: "completed",
        postOnboardingEventsCreated: 0,
        postOnboardingCategoriesCreated: 0,
        accountNudgeShownAt: undefined,
        completedAt: action.at ?? nowIso(),
        dismissedAt: undefined,
      };
    case "record_post_onboarding_event": {
      if (state.step !== "completed" || state.accountNudgeShownAt) return state;
      const postOnboardingEventsCreated =
        (state.postOnboardingEventsCreated ?? 0) + 1;
      return {
        ...state,
        postOnboardingEventsCreated,
        accountNudgeShownAt: postOnboardingEventsCreated >= 2
          ? action.at ?? nowIso()
          : undefined,
      };
    }
    case "enter_demo_exploration":
      return {
        version: 13,
        step: "demo_exploration",
        demoExplorationStartedAt: action.at ?? nowIso(),
        demoInteractionKeys: [],
      };
    case "record_demo_interaction": {
      if (state.step !== "demo_exploration") return state;
      const currentKeys = state.demoInteractionKeys ?? [];
      if (currentKeys.includes(action.key)) return state;
      const demoInteractionKeys = [...currentKeys, action.key];
      return {
        ...state,
        demoInteractionKeys,
        demoInviteEligibleAt:
          state.demoInviteEligibleAt ??
          (demoInteractionKeys.length >= GUIDED_DEMO_INTERACTION_THRESHOLD
            ? action.at ?? nowIso()
            : undefined),
      };
    }
    case "restart_from_demo":
      return state.step === "demo_exploration"
        ? initialGuidedState()
        : state;
    case "dismiss_preserving":
      return {
        ...state,
        step: "dismissed_preserved",
        categoryRevealStartedAt: undefined,
        postExitCreationKeys: [],
        accountNudgeShownAt: undefined,
        exitConfirmedAt: action.at ?? nowIso(),
        dismissedAt: action.at ?? nowIso(),
        completedAt: undefined,
      };
    case "record_post_exit_creation": {
      if (state.step !== "dismissed_preserved" || state.accountNudgeShownAt) {
        return state;
      }
      const keys = state.postExitCreationKeys ?? [];
      if (!action.key || keys.includes(action.key)) return state;
      const postExitCreationKeys = [...keys, action.key];
      return {
        ...state,
        postExitCreationKeys,
        accountNudgeShownAt:
          postExitCreationKeys.length >= 3 ? action.at ?? nowIso() : undefined,
      };
    }
    case "dismiss":
      return {
        ...state,
        step: "dismissed",
        categoryRevealStartedAt: undefined,
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
  state.step !== "demo_exploration" &&
  state.step !== "dismissed_preserved" &&
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
  if (
    input.state.step === "completed" ||
    input.state.step === "dismissed" ||
    input.state.step === "dismissed_preserved"
  ) {
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
