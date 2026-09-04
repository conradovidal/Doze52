"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { MobileCalendarExperience } from "@/components/calendar/mobile-calendar-experience";
import { YearGrid } from "@/components/calendar/year-grid";
import {
  EventDialog,
  type EventDialogSubmission,
} from "@/components/event-dialog";
import { AppHeader } from "@/components/app-header";
import {
  AdaptiveNavigation,
  type UtilityPanelSection,
} from "@/components/navigation/adaptive-navigation";
import { AppUtilityPanel } from "@/components/navigation/app-utility-panel";
import {
  SyncStatusOverlay,
  type SyncOverlayStatus,
} from "@/components/sync-status-overlay";
import { AuthDialog } from "@/components/auth/auth-dialog";
import {
  GuidedOnboardingPanel,
  getGuidedSelectionNotice,
  type GuidedCalendarDraft,
} from "@/components/onboarding/guided-onboarding-panel";
import { AccountNudge } from "@/components/onboarding/account-nudge";
import { DemoExplorationInvite } from "@/components/onboarding/demo-exploration-invite";
import { MobileDesktopFirstGate } from "@/components/onboarding/mobile-desktop-first-gate";
import { OnboardingExitDialog } from "@/components/onboarding/onboarding-exit-dialog";
import type { GuidedToolbarNotice } from "@/components/onboarding/guided-toolbar-notice";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback-provider";
import {
  isOnboardingProfilesSnapshot,
  isOnboardingCategoriesSnapshot,
  isOnboardingPersonalDemoSnapshot,
  getOnboardingClosingVisibleCategoryIds,
  ONBOARDING_CATEGORY_IDS,
  ONBOARDING_PROFILE_IDS,
  ONBOARDING_PERSONAL_DEMO_GROUP_ID,
  isOnboardingPersonalDemoGroup,
  stripOnboardingPersonalDemo,
  useStore,
} from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useCalendarCatalog } from "@/lib/calendar-catalog/runtime";
import {
  getCalendarPackGroupId,
  reconcileInstalledCalendarPacks,
  removeCalendarPackByCategory,
} from "@/lib/calendar-packs/import";
import type { CalendarPack } from "@/lib/calendar-packs/types";
import {
  loadRemoteData,
  saveSnapshot,
  SyncError,
  type CalendarSnapshot,
} from "@/lib/sync";
import { getTodayIsoInTimeZone } from "@/lib/date";
import {
  GUIDED_ONBOARDING_CHANGE_EVENT,
  PRODUCT_ONBOARDING_RESET_EVENT,
  dispatchGuidedOnboarding,
  getGuidedOnboardingProgress,
  hasAuthorCalendarEvents,
  getGuidedCategoryRevealRemainingMs,
  readGuidedOnboardingState,
  readProductOnboardingState,
  resetAllProductOnboarding,
  shouldPresentOnboardingHabitShowcase,
  shouldShowGuidedOnboarding,
  type GuidedOnboardingAction,
  type GuidedOnboardingState,
  type OnboardingCategoryChoice,
  type OnboardingFocusTarget,
  type OnboardingContext,
  type ProductOnboardingState,
} from "@/lib/onboarding";
import { logDevError, logProdError } from "@/lib/safe-log";
import {
  captureFirstTouchAttribution,
  recordProductActivityDay,
  syncProductFunnelState,
} from "@/lib/product-metrics";
import { getSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase";
import { expandEventsForYear } from "@/lib/recurrence";
import { buildOnboardingHabitShowcase } from "@/lib/habits-prototype";
import {
  ensureSnapshotCoverage,
  materializeUserOwnedSnapshot,
} from "@/lib/snapshot-ownership";
import { cn } from "@/lib/utils";
import type { AnchorPoint } from "@/lib/types";
import { trackOnboardingRegion } from "@/lib/onboarding-region";
import { isHabitsPrototypeEnabled } from "@/lib/feature-flags";
import { useHabitsStore } from "@/lib/habits-store";
import {
  buildProductDestinationUrl,
  resolveInitialProductDestination,
  type ProductDestinationId,
} from "@/lib/product-navigation";

const toSnapshotHash = (snapshot: CalendarSnapshot) => JSON.stringify(snapshot);

const SYNC_HINT_BY_KIND: Record<SyncError["kind"], string> = {
  missing_relation:
    "Schema pendente no Supabase (rode as migrations de contextos/ícones).",
  permission: "RLS/policies sem permissao para seu usuario.",
  not_authenticated: "Sessao expirada. Faca login novamente.",
  network: "Falha de rede. Tente novamente em instantes.",
  environment:
    "Ambiente Supabase nao configurado corretamente (URL/anon key).",
  unknown: "Falha inesperada. Tente novamente.",
};

type SyncUiError = {
  message: string;
  kind: SyncError["kind"];
  code?: string;
  status?: number;
  rawMessage?: string | null;
};

type PendingSyncPayload = {
  savedAt: string;
  snapshot: CalendarSnapshot;
};

type RawSyncState =
  | { state: "hidden" }
  | { state: "loading" }
  | { state: "saving" }
  | { state: "synced" }
  | {
      state: "error";
      message: string;
      detail?: string | null;
      onRetry: () => void;
    };

const PENDING_SYNC_STORAGE_PREFIX = "pending-sync:";

const DESKTOP_VISIT_CONFIRMED_STORAGE_KEY = "doze52:desktop-visit-confirmed";

const readDesktopVisitConfirmed = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DESKTOP_VISIT_CONFIRMED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const writeDesktopVisitConfirmed = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DESKTOP_VISIT_CONFIRMED_STORAGE_KEY, "true");
  } catch {
    // Sem persistência entre navegações se o storage falhar; a Anual mobile
    // pode voltar a pedir o onboarding no desktop na próxima visita.
  }
};

const isDetailedSyncDiagnosticsEnabled =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_APP_ENV === "local" ||
  process.env.NEXT_PUBLIC_APP_ENV === "dev";

const MOBILE_CALENDAR_UI_MAX_WIDTH_PX = 767;
const HabitsPrototype = dynamic(() =>
  import("@/components/habits/habits-prototype").then(
    (module) => module.HabitsPrototype
  ),
  { ssr: false }
);
const MOBILE_EXAMPLE_PREVIEW_SESSION_KEY =
  "doze52:mobile-example-preview:session";

const readMobileExamplePreviewSession = () => {
  if (typeof window === "undefined") return false;

  try {
    return (
      window.sessionStorage.getItem(MOBILE_EXAMPLE_PREVIEW_SESSION_KEY) === "1"
    );
  } catch {
    return false;
  }
};

const writeMobileExamplePreviewSession = () => {
  try {
    window.sessionStorage.setItem(MOBILE_EXAMPLE_PREVIEW_SESSION_KEY, "1");
  } catch {
    // A prévia continua válida para a página atual quando o storage está indisponível.
  }
};

const cloneSnapshot = (snapshot: CalendarSnapshot): CalendarSnapshot => ({
  profiles: snapshot.profiles.map((profile) => ({ ...profile })),
  categories: snapshot.categories.map((category) => ({ ...category })),
  events: snapshot.events.map((event) => ({ ...event })),
});

const getPendingSyncStorageKey = (userId: string) =>
  `${PENDING_SYNC_STORAGE_PREFIX}${userId}`;

const isCalendarSnapshotLike = (value: unknown): value is CalendarSnapshot => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  return (
    Array.isArray(record.profiles) &&
    Array.isArray(record.categories) &&
    Array.isArray(record.events)
  );
};

const readPendingSyncSnapshot = (userId: string): CalendarSnapshot | null => {
  if (typeof window === "undefined") return null;

  const key = getPendingSyncStorageKey(userId);

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    const payload = parsed as Partial<PendingSyncPayload>;
    const snapshot = payload?.snapshot ?? parsed;

    if (!isCalendarSnapshotLike(snapshot)) {
      window.localStorage.removeItem(key);
      return null;
    }

    return ensureSnapshotCoverage(snapshot);
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
};

const writePendingSyncSnapshot = (userId: string, snapshot: CalendarSnapshot) => {
  if (typeof window === "undefined") return;

  const payload: PendingSyncPayload = {
    savedAt: new Date().toISOString(),
    snapshot: cloneSnapshot(snapshot),
  };

  window.localStorage.setItem(
    getPendingSyncStorageKey(userId),
    JSON.stringify(payload)
  );
};

const clearPendingSyncSnapshot = (userId: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(getPendingSyncStorageKey(userId));
};

const formatSyncDebugDetail = (error: SyncUiError) => {
  const parts: string[] = [];

  if (error.code) parts.push(`code:${error.code}`);
  if (typeof error.status === "number") parts.push(`status:${error.status}`);

  const meta = parts.length > 0 ? `[${parts.join(" | ")}]` : "";
  const raw = error.rawMessage?.trim() ?? "";
  const detail = [meta, raw].filter(Boolean).join(" ");

  if (!detail) return null;

  return detail.length > 180 ? `${detail.slice(0, 177)}...` : detail;
};

const filterAnonymousDraft = (
  snapshot: CalendarSnapshot,
  discardSandbox = false
): CalendarSnapshot => {
  if (discardSandbox) {
    return {
      profiles: [],
      categories: [],
      events: [],
    };
  }
  return stripOnboardingPersonalDemo({
    profiles: snapshot.profiles.filter((profile) => !profile.userId),
    categories: snapshot.categories.filter((category) => !category.userId),
    events: snapshot.events.filter((event) => !event.userId),
  });
};

const hasRelevantLocalDraft = (snapshot: CalendarSnapshot) =>
  snapshot.events.length > 0 ||
  !isOnboardingProfilesSnapshot(snapshot.profiles) ||
  !isOnboardingCategoriesSnapshot(snapshot.categories);

const mergeSnapshots = (
  remoteSnapshot: CalendarSnapshot,
  localSnapshot: CalendarSnapshot
): CalendarSnapshot => {
  const mergedProfiles = [...remoteSnapshot.profiles];
  const profileIds = new Set(mergedProfiles.map((profile) => profile.id));

  for (const profile of localSnapshot.profiles) {
    if (!profile.id || profileIds.has(profile.id)) continue;
    mergedProfiles.push(profile);
    profileIds.add(profile.id);
  }

  const mergedCategories = [...remoteSnapshot.categories];
  const categoryIds = new Set(mergedCategories.map((category) => category.id));

  for (const category of localSnapshot.categories) {
    if (!category.id || categoryIds.has(category.id)) continue;
    mergedCategories.push(category);
    categoryIds.add(category.id);
  }

  const mergedEvents = [...remoteSnapshot.events];
  const eventIds = new Set(mergedEvents.map((event) => event.id));

  for (const event of localSnapshot.events) {
    if (!event.id || eventIds.has(event.id)) continue;
    mergedEvents.push(event);
    eventIds.add(event.id);
  }

  return ensureSnapshotCoverage({
    profiles: mergedProfiles,
    categories: mergedCategories,
    events: mergedEvents,
  });
};

export default function HomePage() {
  const { calendarPacks } = useCalendarCatalog();
  const { notify } = useFeedback();

  const initialYear = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    return currentYear >= 2025 && currentYear <= 2027 ? currentYear : 2026;
  }, []);

  const [year, setYear] = React.useState<number>(initialYear);

  const profiles = useStore((s) => s.profiles);
  const events = useStore((s) => s.events);
  const categories = useStore((s) => s.categories);
  const ensureEventMetadata = useStore((s) => s.ensureEventMetadata);
  const replaceAllData = useStore((s) => s.replaceAllData);
  const resetToOnboardingData = useStore((s) => s.resetToOnboardingData);
  const loadOnboardingPersonalDemo = useStore(
    (s) => s.loadOnboardingPersonalDemo
  );
  const unlockOnboardingPersonalDemo = useStore(
    (s) => s.unlockOnboardingPersonalDemo
  );
  const configureOnboardingContext = useStore(
    (s) => s.configureOnboardingContext
  );
  const createOnboardingCategory = useStore(
    (s) => s.createOnboardingCategory
  );
  const markLocalImported = useStore((s) => s.markLocalImported);
  const isLocalImported = useStore((s) => s.isLocalImported);
  const addEvent = useStore((s) => s.addEvent);
  const updateEvent = useStore((s) => s.updateEvent);
  const deleteEvent = useStore((s) => s.deleteEvent);
  const moveEventByDelta = useStore((s) => s.moveEventByDelta);
  const normalizeDayOrder = useStore((s) => s.normalizeDayOrder);
  const getEventById = useStore((s) => s.getEventById);
  const resetCalendarFocusOnYearChange = useStore(
    (s) => s.resetCalendarFocusOnYearChange
  );

  const { session, loading: authLoading } = useAuth();

  React.useEffect(() => {
    if (!isHabitsPrototypeEnabled) return;
    void import("@/components/habits/habits-prototype");
  }, []);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [authDialogOpen, setAuthDialogOpen] = React.useState(false);
  const [authDialogInitialMode, setAuthDialogInitialMode] = React.useState<
    "login" | "signup"
  >("login");
  const [dialogAnchorPoint, setDialogAnchorPoint] = React.useState<
    AnchorPoint | undefined
  >(undefined);
  const [authDialogAnchorPoint, setAuthDialogAnchorPoint] = React.useState<
    AnchorPoint | undefined
  >(undefined);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [seedRange, setSeedRange] = React.useState<{
    startDate: string;
    endDate: string;
  } | null>(null);
  const [creatingRange, setCreatingRange] = React.useState<{
    startIso: string;
    hoverIso: string;
    isDragging: boolean;
  } | null>(null);
  const [syncError, setSyncError] = React.useState<SyncUiError | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isBootstrappingSync, setIsBootstrappingSync] = React.useState(false);
  const [hasQueuedSave, setHasQueuedSave] = React.useState(false);
  const [syncOverlayStatus, setSyncOverlayStatus] =
    React.useState<SyncOverlayStatus | null>(null);
  const [isSyncOverlayVisible, setIsSyncOverlayVisible] =
    React.useState(false);
  const [isSyncOverlayErrorOpen, setIsSyncOverlayErrorOpen] =
    React.useState(false);
  const [remoteReady, setRemoteReady] = React.useState(false);
  const [syncBlocked, setSyncBlocked] = React.useState(false);
  const [calendarCreateOnboarding, setCalendarCreateOnboarding] =
    React.useState<ProductOnboardingState | null>(null);
  const [guidedOnboarding, setGuidedOnboarding] =
    React.useState<GuidedOnboardingState | null>(null);
  const [accountNudgeVisible, setAccountNudgeVisible] = React.useState(false);
  const [onboardingExitOpen, setOnboardingExitOpen] = React.useState(false);
  const [workspaceEditMode, setWorkspaceEditMode] = React.useState<
    "calendar" | "habits" | null
  >(null);
  const inlineEditModeActive = workspaceEditMode === "calendar";
  const [exitInlineEditRequestKey, setExitInlineEditRequestKey] =
    React.useState(0);
  const [scrollToTodayRequestKey, setScrollToTodayRequestKey] =
    React.useState(0);
  const [expandCategoriesRequestKey, setExpandCategoriesRequestKey] =
    React.useState(0);
  const requestCategoriesRowExpanded = React.useCallback(() => {
    setExpandCategoriesRequestKey((key) => key + 1);
  }, []);
  const [demoInviteSuppressed, setDemoInviteSuppressed] = React.useState(false);
  const [guidedDraft, setGuidedDraft] =
    React.useState<GuidedCalendarDraft | null>(null);
  const [mobileGuidedRangeStart, setMobileGuidedRangeStart] = React.useState<
    string | null
  >(null);
  const [highlightedEventId, setHighlightedEventId] = React.useState<
    string | null
  >(null);
  const [isMobileCalendarUi, setIsMobileCalendarUi] = React.useState<
    boolean | null
  >(null);
  const [hasConfirmedDesktopVisit, setHasConfirmedDesktopVisit] =
    React.useState(readDesktopVisitConfirmed);
  React.useEffect(() => {
    if (isMobileCalendarUi !== false || hasConfirmedDesktopVisit) return;
    writeDesktopVisitConfirmed();
    setHasConfirmedDesktopVisit(true);
  }, [isMobileCalendarUi, hasConfirmedDesktopVisit]);
  const [activeDestination, setActiveDestination] =
    React.useState<ProductDestinationId>("annual");
  // Desktop-only "minimize chrome" toggle, shared by the Anual and Hábitos
  // surfaces via the same header button. Initial value matches SSR (never
  // minimized) to avoid a hydration mismatch; the real viewport-based
  // default is applied client-side right after mount, before paint.
  const [headerMinimized, setHeaderMinimizedState] = React.useState(false);
  const headerMinimizedManuallySetRef = React.useRef(false);
  const canMinimizeHeader = isHabitsPrototypeEnabled && isMobileCalendarUi === false;
  const setHeaderMinimized = React.useCallback((next: boolean) => {
    headerMinimizedManuallySetRef.current = true;
    setHeaderMinimizedState(next);
  }, []);
  React.useLayoutEffect(() => {
    if (!canMinimizeHeader) return;
    setHeaderMinimizedState(window.innerHeight < 860);
  }, [canMinimizeHeader]);
  React.useEffect(() => {
    if (!canMinimizeHeader) return;
    const handleResize = () => {
      if (headerMinimizedManuallySetRef.current) return;
      setHeaderMinimizedState(window.innerHeight < 860);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [canMinimizeHeader]);
  const [utilityPanelOpen, setUtilityPanelOpen] = React.useState(false);
  const [utilityPanelSection, setUtilityPanelSection] =
    React.useState<UtilityPanelSection>("account");
  const [mobileExamplePreviewDismissed, setMobileExamplePreviewDismissed] =
    React.useState(readMobileExamplePreviewSession);
  const [mobileActiveDateIso, setMobileActiveDateIso] = React.useState(() =>
    format(new Date(), "yyyy-MM-dd")
  );
  const [windowContext] = React.useState<"main" | "popup">(() => {
    if (typeof window === "undefined") return "main";
    return Boolean(window.opener) || window.name === "doze52_oauth"
      ? "popup"
      : "main";
  });
  const [popupStatusMessage, setPopupStatusMessage] = React.useState(
    "Finalizando login..."
  );

  const [todayIso, setTodayIso] = React.useState<string>("");
  const lastSyncedHashRef = React.useRef<string>("");
  const saveTimerRef = React.useRef<number | null>(null);
  const syncOverlayTimerRef = React.useRef<number | null>(null);
  const previousSessionUserIdRef = React.useRef<string | null>(null);
  const anonymousReconciliationHashRef = React.useRef("");
  const previousRawSyncStateRef = React.useRef<RawSyncState["state"]>("hidden");
  const shouldHideSyncOverlayAfterCloseRef = React.useRef(false);
  const syncOverlayErrorOpenRef = React.useRef(false);
  const profilesRef = React.useRef(profiles);
  const categoriesRef = React.useRef(categories);
  const eventsRef = React.useRef(events);
  const desktopCalendarScrollRef = React.useRef<HTMLDivElement | null>(null);
  const desktopCalendarScrollTopRef = React.useRef(0);
  const surfaceInitializedRef = React.useRef(false);
  const utilityPanelTriggerRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    profilesRef.current = profiles;
    categoriesRef.current = categories;
    eventsRef.current = events;
  }, [profiles, categories, events]);

  const editingEvent = editingId ? getEventById(editingId) : null;

  const renderEvents = React.useMemo(
    () => expandEventsForYear(events, year),
    [events, year]
  );
  const hasAuthorEvents = hasAuthorCalendarEvents(events);
  // Existing accounts (created before the guided onboarding tour existed) can
  // have zero "author" events yet still have real, user-customized setups —
  // e.g. categories they renamed/created, or more than the single default
  // profile. Treat those as established users too, so the tour (and the
  // editing lock that comes with it) never traps someone who already has an
  // account, not just someone with existing events.
  //
  // Anonymous visitors get the personal demo snapshot (2 profiles, demo
  // categories under DEMO_CATEGORY_IDS, plus imported "ready-made" holiday
  // and F1 calendar packs) auto-loaded the moment the tour starts, so
  // counting profiles/categories by raw length or a partial id set wrongly
  // flags every fresh visitor as "established" too. A category sourced from
  // any calendar pack (demo or a real ready-made pack — those carry their
  // own calendarPackGroupId, not the onboarding demo marker) is exactly as
  // "not authored" as the pack events already excluded above, so the same
  // signal applies here. Only a profile or category with neither a pack
  // origin nor a known onboarding id was actually created by the user.
  const defaultOnboardingCategoryIds = React.useMemo(
    () => new Set<string>(Object.values(ONBOARDING_CATEGORY_IDS)),
    []
  );
  const knownOnboardingProfileIds = React.useMemo(
    () => new Set<string>(Object.values(ONBOARDING_PROFILE_IDS)),
    []
  );
  const hasCustomizedCategories = categories.some(
    (category) =>
      !category.calendarPackGroupId &&
      !defaultOnboardingCategoryIds.has(category.id)
  );
  const hasCustomProfiles = profiles.some(
    (profile) => !knownOnboardingProfileIds.has(profile.id)
  );
  const hasExistingHabits = useHabitsStore((s) => s.habits.length > 0);
  const hasEstablishedSetup =
    hasAuthorEvents ||
    hasCustomizedCategories ||
    hasCustomProfiles ||
    hasExistingHabits;
  const guidedOnboardingEligible = Boolean(
    guidedOnboarding &&
      calendarCreateOnboarding &&
      isMobileCalendarUi !== null &&
      shouldShowGuidedOnboarding({
        state: guidedOnboarding,
        legacyState: calendarCreateOnboarding,
        hasAuthorEvents: hasEstablishedSetup,
        authLoading,
        isAuthenticated: Boolean(session?.user.id),
        remoteReady,
      })
  );
  const showGuidedOnboarding = Boolean(
    guidedOnboardingEligible && isMobileCalendarUi === false
  );

  const habitShowcaseDataEligible = Boolean(
    // Only ever show the demo/example habits while the guided tour is
    // actually eligible to run — otherwise an established account that
    // merely has a leftover "context_selection" step in local storage
    // would have its real Hábitos view replaced by undeletable demo data.
    showGuidedOnboarding &&
      guidedOnboarding &&
      activeDestination === "habits" &&
      isMobileCalendarUi === false &&
      todayIso
  );
  const guidedHabitShowcaseSource = React.useMemo(
    () =>
      habitShowcaseDataEligible && todayIso
        ? buildOnboardingHabitShowcase({
            year,
            todayIso,
            events: renderEvents,
            categories,
          })
        : null,
    [categories, habitShowcaseDataEligible, renderEvents, todayIso, year]
  );
  // Passo em que a vitrine ainda é só demonstrativa (nada é criado de verdade
  // ainda) — trava toda a interação, como hoje.
  const onboardingHabitShowcase =
    guidedHabitShowcaseSource &&
    guidedOnboarding &&
    shouldPresentOnboardingHabitShowcase(guidedOnboarding.step)
      ? guidedHabitShowcaseSource
      : null;
  // A partir do passo de criar o primeiro hábito, a vitrine continua visível
  // (o hábito real nasce ao lado dela), mas deixa de travar a interação.
  const onboardingHabitShowcaseDisplay =
    guidedHabitShowcaseSource &&
    guidedOnboarding &&
    (guidedOnboarding.step === "habit_instruction" ||
      guidedOnboarding.step === "habit_created_confirmation")
      ? guidedHabitShowcaseSource
      : null;

  const centerTodayInDesktopCalendar = React.useCallback(() => {
    if (isMobileCalendarUi !== false || !todayIso) return;
    if (Number(todayIso.slice(0, 4)) !== year) return;

    const viewport = desktopCalendarScrollRef.current;
    const todayCell = viewport?.querySelector<HTMLElement>(
      `[data-day-cell][data-day-iso="${todayIso}"]`
    );
    if (!viewport || !todayCell) return;

    const viewportRect = viewport.getBoundingClientRect();
    const todayRect = todayCell.getBoundingClientRect();
    const nextScrollTop =
      viewport.scrollTop +
      todayRect.top +
      todayRect.height / 2 -
      (viewportRect.top + viewportRect.height / 2);

    viewport.scrollTop = Math.max(0, nextScrollTop);
  }, [isMobileCalendarUi, todayIso, year]);

  const requestDesktopTodayCenter = React.useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(centerTodayInDesktopCalendar);
    });
  }, [centerTodayInDesktopCalendar]);

  React.useLayoutEffect(() => {
    requestDesktopTodayCenter();
  }, [requestDesktopTodayCenter]);

  React.useEffect(() => {
    if (windowContext !== "popup") return;

    let finished = false;
    let attempts = 0;
    const maxAttempts = 30;
    let timer: number | null = null;

    const notifyOpener = (
      type: "SUPABASE_AUTH_SUCCESS" | "SUPABASE_AUTH_ERROR"
    ) => {
      if (!window.opener) return;

      if (type === "SUPABASE_AUTH_SUCCESS") {
        window.opener.postMessage({ type }, window.location.origin);
        return;
      }

      window.opener.postMessage(
        { type, error: "oauth_callback_failed" },
        window.location.origin
      );
    };

    const finishSuccess = () => {
      notifyOpener("SUPABASE_AUTH_SUCCESS");
      setPopupStatusMessage("Login concluido. Voce pode fechar esta janela.");
      window.close();
    };

    const finishError = () => {
      notifyOpener("SUPABASE_AUTH_ERROR");
      setPopupStatusMessage("Falha no login. Feche esta janela e tente novamente.");
    };

    if (!hasSupabaseEnv) {
      finishError();
      return;
    }

    const supabase = getSupabaseBrowserClient();

    const tryFinalize = async () => {
      if (finished) return;

      attempts += 1;

      const { data } = await supabase.auth.getSession();

      if (finished) return;

      if (data.session) {
        finished = true;

        if (timer !== null) {
          window.clearInterval(timer);
        }

        finishSuccess();
        return;
      }

      if (attempts >= maxAttempts) {
        finished = true;

        if (timer !== null) {
          window.clearInterval(timer);
        }

        finishError();
      }
    };

    void tryFinalize();

    timer = window.setInterval(() => {
      void tryFinalize();
    }, 500);

    return () => {
      finished = true;

      if (timer !== null) {
        window.clearInterval(timer);
      }
    };
  }, [windowContext]);

  React.useEffect(() => {
    if (!isHabitsPrototypeEnabled || isMobileCalendarUi === null) return;
    if (surfaceInitializedRef.current) return;

    surfaceInitializedRef.current = true;
    const initialDestination = resolveInitialProductDestination({
      search: window.location.search,
      isMobile: isMobileCalendarUi,
    });
    setActiveDestination(initialDestination);
    window.history.replaceState(
      window.history.state,
      "",
      buildProductDestinationUrl(window.location.href, initialDestination)
    );
  }, [isMobileCalendarUi]);

  React.useEffect(() => {
    if (windowContext !== "main") return;
    ensureEventMetadata();
  }, [ensureEventMetadata, windowContext]);

  React.useEffect(() => {
    if (windowContext !== "main") return;

    const url = new URL(window.location.href);
    const billingStatus = url.searchParams.get("billing");

    if (
      billingStatus !== "success" &&
      billingStatus !== "cancelled" &&
      billingStatus !== "portal"
    ) {
      return;
    }

    if (billingStatus === "success") {
      notify({
        tone: "info",
        title: "Estamos confirmando sua assinatura",
        description: "O Pro aparece quando o webhook da Stripe atualizar sua conta.",
      });
    } else if (billingStatus === "cancelled") {
      notify({
        tone: "info",
        title: "Upgrade cancelado",
        description: "Nenhuma alteração foi aplicada ao seu plano.",
      });
    } else {
      notify({
        tone: "success",
        title: "Assinatura atualizada",
        description: "As mudanças do portal serão refletidas assim que a Stripe confirmar.",
      });
    }

    url.searchParams.delete("billing");
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, "", nextUrl || "/");
  }, [notify, windowContext]);

  React.useEffect(() => {
    if (windowContext !== "main") return;

    let rolloverTimer: number | null = null;
    let refreshInterval: number | null = null;

    const browserTimeZone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    const refreshTodayIso = () => {
      const nextTodayIso = getTodayIsoInTimeZone(browserTimeZone);
      setTodayIso((prev) => (prev === nextTodayIso ? prev : nextTodayIso));
    };

    const scheduleNextRollover = () => {
      if (rolloverTimer !== null) {
        window.clearTimeout(rolloverTimer);
      }

      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 1, 0);

      const delayMs = Math.max(1000, nextMidnight.getTime() - now.getTime());

      rolloverTimer = window.setTimeout(() => {
        refreshTodayIso();
        scheduleNextRollover();
      }, delayMs);
    };

    const refreshAndReschedule = () => {
      refreshTodayIso();
      scheduleNextRollover();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      refreshAndReschedule();
    };

    const handleFocus = () => {
      refreshAndReschedule();
    };

    const handlePageShow = () => {
      refreshAndReschedule();
    };

    refreshAndReschedule();

    refreshInterval = window.setInterval(() => {
      refreshTodayIso();
    }, 60_000);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      if (rolloverTimer !== null) {
        window.clearTimeout(rolloverTimer);
      }

      if (refreshInterval !== null) {
        window.clearInterval(refreshInterval);
      }

      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [windowContext]);

  React.useEffect(() => {
    if (windowContext !== "main") return;
    captureFirstTouchAttribution();
  }, [windowContext]);

  React.useEffect(() => {
    if (windowContext !== "main" || !session?.user.id || !guidedOnboarding) {
      return;
    }
    void syncProductFunnelState(session.user.id, guidedOnboarding);
  }, [guidedOnboarding, session?.user.id, windowContext]);

  React.useEffect(() => {
    if (windowContext !== "main") return;

    if (hasSupabaseEnv) return;

    const message =
      "Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY neste ambiente.";

    logDevError("app.page.supabase-env", { message });
    logProdError("Supabase nao configurado neste ambiente.");
  }, [windowContext]);

  React.useEffect(() => {
    if (windowContext !== "main") return;

    const syncOnboarding = () => {
      setCalendarCreateOnboarding(readProductOnboardingState("create-event"));
      setGuidedOnboarding(readGuidedOnboardingState());
    };

    const syncGuidedOnboarding = (event: Event) => {
      const nextState = (event as CustomEvent<GuidedOnboardingState>).detail;
      setGuidedOnboarding(nextState ?? readGuidedOnboardingState());
    };

    syncOnboarding();

    window.addEventListener(
      PRODUCT_ONBOARDING_RESET_EVENT,
      syncOnboarding
    );
    window.addEventListener(
      GUIDED_ONBOARDING_CHANGE_EVENT,
      syncGuidedOnboarding
    );

    return () => {
      window.removeEventListener(
        PRODUCT_ONBOARDING_RESET_EVENT,
        syncOnboarding
      );
      window.removeEventListener(
        GUIDED_ONBOARDING_CHANGE_EVENT,
        syncGuidedOnboarding
      );
    };
  }, [windowContext]);

  React.useLayoutEffect(() => {
    if (windowContext !== "main") return;

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    let animationFrameId: number | null = null;

    const getMeasuredWidth = () => {
      const appShellWidth =
        document
          .querySelector("[data-doze52-app-shell]")
          ?.getBoundingClientRect().width ?? Number.POSITIVE_INFINITY;
      const documentWidth =
        document.documentElement.clientWidth || Number.POSITIVE_INFINITY;
      const viewportWidth = window.visualViewport?.width ?? Number.POSITIVE_INFINITY;
      const innerWidth = window.innerWidth || Number.POSITIVE_INFINITY;
      return Math.min(appShellWidth, documentWidth, viewportWidth, innerWidth);
    };

    const resolveViewportMode = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const forcedMobileUi = searchParams.get("mobileUi");
      if (forcedMobileUi === "1" || forcedMobileUi === "true") return true;
      if (forcedMobileUi === "0" || forcedMobileUi === "false") return false;
      return (
        mediaQuery.matches ||
        getMeasuredWidth() <= MOBILE_CALENDAR_UI_MAX_WIDTH_PX
      );
    };

    const applyViewportMode = () => {
      setIsMobileCalendarUi(resolveViewportMode());
    };

    const syncViewportMode = () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        applyViewportMode();
      });
    };

    applyViewportMode();
    syncViewportMode();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(syncViewportMode);
    resizeObserver?.observe(document.documentElement);
    if (document.body) {
      resizeObserver?.observe(document.body);
    }

    window.addEventListener("resize", syncViewportMode);
    window.visualViewport?.addEventListener("resize", syncViewportMode);
    window.addEventListener("pageshow", syncViewportMode);
    window.addEventListener("popstate", syncViewportMode);
    mediaQuery.addEventListener("change", syncViewportMode);

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncViewportMode);
      window.visualViewport?.removeEventListener("resize", syncViewportMode);
      window.removeEventListener("pageshow", syncViewportMode);
      window.removeEventListener("popstate", syncViewportMode);
      mediaQuery.removeEventListener("change", syncViewportMode);
    };
  }, [windowContext]);

  React.useEffect(() => {
    if (windowContext !== "main") return;
    if (authLoading) return;

    const currentUserId = session?.user.id ?? null;
    const previousUserId = previousSessionUserIdRef.current;

    const hasUserBoundLocalData =
      profiles.some((profile) => Boolean(profile.userId)) ||
      categories.some((category) => Boolean(category.userId)) ||
      events.some((event) => Boolean(event.userId));

    if (!currentUserId) {
      if (previousUserId || hasUserBoundLocalData) {
        resetToOnboardingData();
      }

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      setIsSyncing(false);
      setIsBootstrappingSync(false);
      setHasQueuedSave(false);
      setRemoteReady(false);
      setSyncBlocked(false);
      setSyncError(null);
      lastSyncedHashRef.current = "";
      previousSessionUserIdRef.current = null;
      return;
    }

    previousSessionUserIdRef.current = currentUserId;
  }, [
    authLoading,
    categories,
    events,
    profiles,
    resetToOnboardingData,
    session?.user.id,
    windowContext,
  ]);

  React.useEffect(() => {
    if (windowContext !== "main" || authLoading || session?.user.id) return;
    if (
      guidedOnboarding?.step !== "context_selection" ||
      calendarCreateOnboarding !== "pending"
    ) {
      return;
    }

    const snapshot = { profiles, categories, events };
    const hasDemo = isOnboardingPersonalDemoSnapshot(snapshot);
    const isInitialTemplate =
      events.length === 0 &&
      isOnboardingProfilesSnapshot(profiles) &&
      isOnboardingCategoriesSnapshot(categories);

    if (!hasDemo && !isInitialTemplate) return;
    if (
      hasDemo &&
      events.some(
        (event) =>
          event.calendarPackGroupId === ONBOARDING_PERSONAL_DEMO_GROUP_ID
      )
    ) {
      return;
    }

    loadOnboardingPersonalDemo(year);
  }, [
    authLoading,
    calendarCreateOnboarding,
    categories,
    events,
    guidedOnboarding?.step,
    loadOnboardingPersonalDemo,
    profiles,
    session?.user.id,
    windowContext,
    year,
  ]);

  React.useEffect(() => {
    if (windowContext !== "main" || authLoading || session?.user.id) return;
    if (
      profiles.some((profile) => Boolean(profile.userId)) ||
      categories.some((category) => Boolean(category.userId)) ||
      events.some((event) => Boolean(event.userId))
    ) {
      return;
    }

    const snapshot = { profiles, categories, events };
    const snapshotHash = toSnapshotHash(snapshot);
    if (anonymousReconciliationHashRef.current === snapshotHash) return;

    const result = reconcileInstalledCalendarPacks(snapshot, calendarPacks);
    anonymousReconciliationHashRef.current = toSnapshotHash(result.snapshot);
    if (anonymousReconciliationHashRef.current === snapshotHash) return;

    replaceAllData(result.snapshot);
    if (result.updatedPackCount > 0) {
      notify({
        tone: "success",
        title: "Calendários atualizados",
        description: "Os eventos dos seus calendários prontos foram atualizados automaticamente.",
      });
    }
  }, [
    authLoading,
    calendarPacks,
    categories,
    events,
    notify,
    profiles,
    replaceAllData,
    session?.user.id,
    windowContext,
  ]);

  const bootstrapRemote = React.useCallback(() => {
    if (windowContext !== "main") return () => {};

    const userId = session?.user.id;

    if (!userId) return () => {};

    let cancelled = false;

    const run = async () => {
      setIsBootstrappingSync(true);
      setSyncError(null);

      let snapshotToPersistOnFailure: CalendarSnapshot | null = null;

      try {
        const currentGuidedStep = readGuidedOnboardingState().step;
        const localSnapshot = filterAnonymousDraft(
          ensureSnapshotCoverage({
            profiles: profilesRef.current,
            categories: categoriesRef.current,
            events: eventsRef.current,
          }),
          currentGuidedStep === "demo_exploration" ||
            currentGuidedStep === "context_selection"
        );

        const pendingSnapshot = readPendingSyncSnapshot(userId);
        const alreadyImported = isLocalImported(userId);
        const localDraftIsRelevant =
          !alreadyImported && hasRelevantLocalDraft(localSnapshot);
        const remoteSnapshot = await loadRemoteData();

        if (cancelled) return;

        const remoteIsEmpty =
          remoteSnapshot.profiles.length === 0 &&
          remoteSnapshot.categories.length === 0 &&
          remoteSnapshot.events.length === 0;

        const remoteHash = toSnapshotHash(remoteSnapshot);

        let nextSnapshot: CalendarSnapshot = remoteSnapshot;
        let shouldForceSave = false;

        if (pendingSnapshot) {
          nextSnapshot = pendingSnapshot;
          shouldForceSave = true;
        } else if (localDraftIsRelevant) {
          nextSnapshot = mergeSnapshots(
            remoteSnapshot,
            materializeUserOwnedSnapshot(localSnapshot)
          );
        } else if (remoteIsEmpty && !alreadyImported) {
          nextSnapshot = materializeUserOwnedSnapshot(remoteSnapshot);
        }

        const reconciliation = reconcileInstalledCalendarPacks(
          nextSnapshot,
          calendarPacks
        );
        nextSnapshot = reconciliation.snapshot;
        snapshotToPersistOnFailure = nextSnapshot;

        const nextHash = toSnapshotHash(nextSnapshot);

        replaceAllData(nextSnapshot);

        if (shouldForceSave || nextHash !== remoteHash) {
          await saveSnapshot(nextSnapshot);

          if (cancelled) return;
        }

        clearPendingSyncSnapshot(userId);
        markLocalImported(userId);
        lastSyncedHashRef.current = nextHash;
        setRemoteReady(true);
        setSyncBlocked(false);
        if (reconciliation.updatedPackCount > 0) {
          notify({
            tone: "success",
            title: "Calendários atualizados",
            description:
              "Os eventos dos seus calendários prontos foram atualizados automaticamente.",
          });
        }
      } catch (error) {
        if (cancelled) return;

        const syncError =
          error instanceof SyncError
            ? error
            : new SyncError("unknown", "Falhou ao carregar dados.", false);

        logDevError("app.page.bootstrap-remote", {
          kind: syncError.kind,
          message: syncError.userMessage,
          code: syncError.code,
          status: syncError.status,
        });

        logProdError("Falha ao carregar dados remotos.");

        if (snapshotToPersistOnFailure) {
          writePendingSyncSnapshot(userId, snapshotToPersistOnFailure);
          replaceAllData(snapshotToPersistOnFailure);
        }

        setSyncError({
          message: syncError.userMessage,
          kind: syncError.kind,
          code: syncError.code,
          status: syncError.status,
          rawMessage: syncError.rawMessage,
        });

        setRemoteReady(false);
        setSyncBlocked(true);
      } finally {
        if (!cancelled) setIsBootstrappingSync(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    calendarPacks,
    isLocalImported,
    markLocalImported,
    notify,
    replaceAllData,
    session?.user.id,
    windowContext,
  ]);

  React.useEffect(() => {
    const cleanup = bootstrapRemote();
    return cleanup;
  }, [bootstrapRemote]);

  React.useEffect(() => {
    if (windowContext !== "main") return;
    if (!session?.user.id || !remoteReady || syncBlocked || syncError) return;

    const nextSnapshot = { profiles, categories, events };
    const nextHash = JSON.stringify(nextSnapshot);

    if (nextHash === lastSyncedHashRef.current) {
      setHasQueuedSave(false);
      return;
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    setHasQueuedSave(true);

    saveTimerRef.current = window.setTimeout(async () => {
      saveTimerRef.current = null;
      setHasQueuedSave(false);
      setIsSyncing(true);
      setSyncError(null);

      try {
        await saveSnapshot(nextSnapshot);
        void recordProductActivityDay(session.user.id);
        clearPendingSyncSnapshot(session.user.id);
        lastSyncedHashRef.current = nextHash;
      } catch (error) {
        const syncError =
          error instanceof SyncError
            ? error
            : new SyncError(
                "unknown",
                "Falhou ao salvar. Tente novamente.",
                false
              );

        logDevError("app.page.save-snapshot", {
          kind: syncError.kind,
          message: syncError.userMessage,
          code: syncError.code,
          status: syncError.status,
        });

        logProdError("Falha ao salvar dados.");

        writePendingSyncSnapshot(session.user.id, nextSnapshot);

        setSyncError({
          message: syncError.userMessage,
          kind: syncError.kind,
          code: syncError.code,
          status: syncError.status,
          rawMessage: syncError.rawMessage,
        });

        setSyncBlocked(true);
        setRemoteReady(false);
      } finally {
        setIsSyncing(false);
      }
    }, 800);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [
    categories,
    events,
    profiles,
    remoteReady,
    session?.user.id,
    syncBlocked,
    syncError,
    windowContext,
  ]);

  const isMobileOnboardingPending = Boolean(
    guidedOnboardingEligible && isMobileCalendarUi === true
  );
  const isInitialMobileOnboarding =
    guidedOnboarding?.step === "context_selection";
  const isMobileExamplePreview = Boolean(
    isMobileOnboardingPending &&
      isInitialMobileOnboarding &&
      mobileExamplePreviewDismissed
  );
  // Anual mobile is a read/consult surface, not a place to build the year —
  // that lives on desktop. Established mobile users (e.g. someone who signed
  // up and started habits from their phone) fall outside guidedOnboarding
  // once they have real content, so gate them here too until this browser
  // has confirmed at least one non-mobile visit. This is a local, per-browser
  // heuristic (no server-side "completed desktop onboarding" flag exists
  // yet), so it can re-trigger on a new device/browser even for someone who
  // already did this on desktop elsewhere — acceptable for now, revisit if
  // that turns out to be common.
  const showMobileDesktopFirstGate = Boolean(
    (isMobileOnboardingPending &&
      (!isInitialMobileOnboarding || !mobileExamplePreviewDismissed)) ||
      (isMobileCalendarUi === true && !hasConfirmedDesktopVisit && !authLoading)
  );
  const isDemoExploration =
    guidedOnboarding?.step === "demo_exploration" && !session?.user.id;
  const showDemoInvite = Boolean(
    isDemoExploration &&
      guidedOnboarding?.demoInviteEligibleAt &&
      !demoInviteSuppressed
  );

  const handleEditEvent = (payload: {
    eventId: string;
    sourceEventId: string;
    anchorPoint: AnchorPoint;
  }) => {
    void payload.eventId;
    setEditingId(payload.sourceEventId);
    setDialogAnchorPoint(payload.anchorPoint);
    setSeedRange(null);
    setCreatingRange(null);
    setDialogOpen(true);
  };

  const updateGuidedOnboarding = React.useCallback(
    (action: GuidedOnboardingAction) => {
      const next = dispatchGuidedOnboarding(action);
      setGuidedOnboarding(next);
      return next;
    },
    []
  );

  React.useEffect(() => {
    if (
      guidedOnboarding?.step === "edit_instruction" &&
      inlineEditModeActive
    ) {
      updateGuidedOnboarding({
        type: "open_edit_preview",
        continueToCalendar:
          isHabitsPrototypeEnabled && isMobileCalendarUi !== true,
      });
    }
  }, [
    guidedOnboarding?.step,
    inlineEditModeActive,
    isMobileCalendarUi,
    updateGuidedOnboarding,
  ]);

  React.useEffect(() => {
    if (
      guidedOnboarding?.step !== "calendar_instruction" &&
      guidedOnboarding?.step !== "calendar_selection"
    ) {
      return;
    }
    if (!inlineEditModeActive) setWorkspaceEditMode("calendar");
  }, [guidedOnboarding?.step, inlineEditModeActive]);

  React.useEffect(() => {
    // No mobile o guia começa em Hábitos de propósito (ver
    // resolveInitialProductDestination) — só o desktop precisa ser
    // redirecionado para o Anual, já que é lá que os primeiros passos
    // (escolher contexto, criar categoria) acontecem.
    if (isMobileCalendarUi !== false) return;
    if (guidedOnboarding?.step !== "context_selection") return;
    if (activeDestination === "annual") return;
    setActiveDestination("annual");
    window.history.replaceState(
      window.history.state,
      "",
      buildProductDestinationUrl(window.location.href, "annual")
    );
  }, [activeDestination, guidedOnboarding?.step, isMobileCalendarUi]);

  const recordDemoInteraction = React.useCallback(
    (key: string) => {
      if (readGuidedOnboardingState().step !== "demo_exploration") return;
      updateGuidedOnboarding({ type: "record_demo_interaction", key });
    },
    [updateGuidedOnboarding]
  );

  React.useEffect(() => {
    if (!isDemoExploration) return;
    const handleDemoClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const profile = target.closest<HTMLElement>("[data-onboarding-profile-id]");
      if (profile?.dataset.onboardingProfileId) {
        recordDemoInteraction(`profile:${profile.dataset.onboardingProfileId}`);
        return;
      }
      const category = target.closest<HTMLElement>("[data-onboarding-category-id]");
      if (category?.dataset.onboardingCategoryId) {
        recordDemoInteraction(`category:${category.dataset.onboardingCategoryId}`);
        return;
      }
      const calendarEvent = target.closest<HTMLElement>("[data-calendar-event-id]");
      if (calendarEvent?.dataset.calendarEventId) {
        recordDemoInteraction(`event:${calendarEvent.dataset.calendarEventId}`);
        return;
      }
      if (target.closest("[data-onboarding-edit-control]")) {
        recordDemoInteraction("toolbar:edit");
        return;
      }
      if (target.closest("[data-onboarding-calendar-control]")) {
        recordDemoInteraction("toolbar:calendars");
        return;
      }
      if (target.closest("[data-onboarding-theme-control]")) {
        recordDemoInteraction("toolbar:theme");
      }
    };
    document.addEventListener("click", handleDemoClick, true);
    return () => document.removeEventListener("click", handleDemoClick, true);
  }, [isDemoExploration, recordDemoInteraction]);

  React.useEffect(() => {
    if (!session?.user.id || guidedOnboarding?.step !== "demo_exploration") {
      return;
    }
    updateGuidedOnboarding({ type: "dismiss" });
  }, [guidedOnboarding?.step, session?.user.id, updateGuidedOnboarding]);

  React.useEffect(() => {
    if (
      guidedOnboarding?.step !== "date_category_reveal" &&
      guidedOnboarding?.step !== "period_category_reveal"
    ) {
      return;
    }

    const remaining = getGuidedCategoryRevealRemainingMs(
      guidedOnboarding.categoryRevealStartedAt
    );
    const timer = window.setTimeout(() => {
      updateGuidedOnboarding({ type: "finish_category_reveal" });
    }, remaining);

    return () => window.clearTimeout(timer);
  }, [
    guidedOnboarding?.categoryRevealStartedAt,
    guidedOnboarding?.step,
    updateGuidedOnboarding,
  ]);

  const handleConfigureGuidedContext = React.useCallback(
    (context: OnboardingContext) => {
      const configured = configureOnboardingContext({
        context,
        year: initialYear,
      });
      if (!configured) {
        notify({
          tone: "error",
          title: "Não foi possível configurar este contexto",
          description: "Confira o nome ou continue usando o calendário atual.",
        });
        return;
      }
      setYear(initialYear);
      resetCalendarFocusOnYearChange();
      updateGuidedOnboarding({ type: "configure_profile", context });
      setGuidedDraft(null);
      setMobileGuidedRangeStart(null);
    },
    [
      configureOnboardingContext,
      initialYear,
      notify,
      resetCalendarFocusOnYearChange,
      updateGuidedOnboarding,
    ]
  );

  const handleChooseGuidedCategory = React.useCallback(
    (
      intent: "date" | "period",
      choice: OnboardingCategoryChoice,
      color: string
    ) => {
      const current = readGuidedOnboardingState();
      if (!current.context) return;
      const categoryId = createOnboardingCategory({
        context: current.context,
        intent,
        choice,
        color,
      });
      if (!categoryId) {
        notify({
          tone: "error",
          title: "Não foi possível criar esta categoria",
          description: "Tente novamente ou encerre o guia para continuar.",
        });
        return;
      }
      updateGuidedOnboarding({
        type:
          intent === "date"
            ? "choose_date_category"
            : "choose_period_category",
        categoryId,
      });
      setGuidedDraft(null);
      setMobileGuidedRangeStart(null);
    },
    [
      createOnboardingCategory,
      notify,
      updateGuidedOnboarding,
    ]
  );

  const announceGuidedCompletion = React.useCallback(() => {
    notify({
      tone: "success",
      title: "Agora o seu ano conta uma história",
      description: "Continue dando espaço ao que importa para você.",
      durationMs: 3200,
    });
  }, [notify]);

  const finalizeGuidedOnboarding = React.useCallback(
    (next: GuidedOnboardingState) => {
      if (next.step !== "completed") return;
      const context = next.context ?? "personal";
      const keepCategoryIds = new Set(
        getOnboardingClosingVisibleCategoryIds(context)
      );
      const current = useStore.getState();
      const categoriesToRemove = current.categories.filter(
        (category) => !keepCategoryIds.has(category.id)
      );
      const packCategoriesToRemove = categoriesToRemove.filter(
        (category) =>
          category.calendarPackGroupId &&
          !isOnboardingPersonalDemoGroup(category.calendarPackGroupId)
      );
      const ordinaryCategoryIdsToRemove = new Set(
        categoriesToRemove
          .filter(
            (category) =>
              !category.calendarPackGroupId ||
              isOnboardingPersonalDemoGroup(category.calendarPackGroupId)
          )
          .map((category) => category.id)
      );
      // Dentro das categorias mantidas, só o que a pessoa criou com a própria
      // mão sobrevive: os eventos que já vinham prontos no ano de exemplo
      // (ex.: Eventos) somem, deixando a categoria pronta para ela começar do
      // zero. Os dois aniversários que ela criou não carregam essa marca,
      // então não são afetados.
      const categories = current.categories.filter(
        (category) => !ordinaryCategoryIdsToRemove.has(category.id)
      );
      const events = current.events.filter((event) => {
        if (ordinaryCategoryIdsToRemove.has(event.categoryId)) return false;
        if (
          keepCategoryIds.has(event.categoryId) &&
          isOnboardingPersonalDemoGroup(event.calendarPackGroupId)
        ) {
          return false;
        }
        return true;
      });
      let snapshot = { profiles: current.profiles, categories, events };
      for (const category of packCategoriesToRemove) {
        snapshot = removeCalendarPackByCategory(
          snapshot,
          calendarPacks,
          category.id
        ).snapshot;
      }
      replaceAllData(snapshot);
      unlockOnboardingPersonalDemo();
      announceGuidedCompletion();
      setActiveDestination("annual");
      resetCalendarFocusOnYearChange();
      setHeaderMinimized(false);
      requestCategoriesRowExpanded();
      window.history.replaceState(
        window.history.state,
        "",
        buildProductDestinationUrl(window.location.href, "annual")
      );
    },
    [
      announceGuidedCompletion,
      calendarPacks,
      replaceAllData,
      requestCategoriesRowExpanded,
      resetCalendarFocusOnYearChange,
      setHeaderMinimized,
      unlockOnboardingPersonalDemo,
    ]
  );

  const handleRestartOnboardingForTesting = React.useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem("yiv-store");
      window.localStorage.removeItem("doze52:habits-store:v1");
    } catch {
      // Recarrega mesmo assim; sem storage disponível não há o que limpar.
    }
    resetAllProductOnboarding();
    window.location.reload();
  }, []);

  const dismissGuidedOnboarding = React.useCallback(() => {
    setOnboardingExitOpen(true);
  }, []);

  const confirmDismissGuidedOnboarding = React.useCallback(() => {
    const current = readGuidedOnboardingState();
    if (current.step === "context_selection") {
      updateGuidedOnboarding({ type: "enter_demo_exploration" });
    } else {
      updateGuidedOnboarding({ type: "dismiss_preserving" });
    }
    if (inlineEditModeActive) {
      setExitInlineEditRequestKey((key) => key + 1);
    }
    setGuidedDraft(null);
    setMobileGuidedRangeStart(null);
    setAccountNudgeVisible(false);
    setDemoInviteSuppressed(false);
    setOnboardingExitOpen(false);
  }, [inlineEditModeActive, updateGuidedOnboarding]);

  const restartGuidedOnboardingFromDemo = React.useCallback(() => {
    loadOnboardingPersonalDemo(initialYear);
    updateGuidedOnboarding({ type: "restart_from_demo" });
    setYear(initialYear);
    resetCalendarFocusOnYearChange();
    setWorkspaceEditMode(null);
    setActiveDestination("annual");
    window.history.replaceState(
      window.history.state,
      "",
      buildProductDestinationUrl(window.location.href, "annual")
    );
    setGuidedDraft(null);
    setMobileGuidedRangeStart(null);
    setDemoInviteSuppressed(false);
  }, [
    initialYear,
    loadOnboardingPersonalDemo,
    resetCalendarFocusOnYearChange,
    updateGuidedOnboarding,
  ]);

  const trackPostOnboardingEvent = React.useCallback(
    () => {
      if (session?.user.id) return;
      const current = readGuidedOnboardingState();
      if (current.step !== "completed" || current.accountNudgeShownAt) return;
      const next = updateGuidedOnboarding({
        type: "record_post_onboarding_event",
      });
      if (!current.accountNudgeShownAt && next.accountNudgeShownAt) {
        setAccountNudgeVisible(true);
      }
    },
    [session?.user.id, updateGuidedOnboarding]
  );

  const trackPostExitCreation = React.useCallback(
    (key: string) => {
      if (session?.user.id) return;
      const current = readGuidedOnboardingState();
      if (current.step !== "dismissed_preserved" || current.accountNudgeShownAt) {
        return;
      }
      const next = updateGuidedOnboarding({
        type: "record_post_exit_creation",
        key,
      });
      if (!current.accountNudgeShownAt && next.accountNudgeShownAt) {
        setAccountNudgeVisible(true);
      }
    },
    [session?.user.id, updateGuidedOnboarding]
  );

  const handleSubmit = async (submission: EventDialogSubmission) => {
    if (submission.mode === "update") {
      if (!editingId) {
        throw new Error("Não foi possível identificar o evento em edição.");
      }
      updateEvent(editingId, submission.patch);
      recordDemoInteraction(`mutation:event:update:${editingId}`);

      notify({
        tone: "success",
        title: "Evento atualizado",
        description: "As alterações já foram aplicadas ao calendário.",
      });

      return;
    }

    const eventId = addEvent(submission.input);
    if (!eventId) {
      throw new Error("Não foi possível adicionar este evento à categoria escolhida.");
    }

    setHighlightedEventId(eventId);
    if (isDemoExploration) {
      recordDemoInteraction(`mutation:event:create:${eventId}`);
    } else {
      trackPostOnboardingEvent();
      trackPostExitCreation(`event:${eventId}`);
    }

    const guidedStep = readGuidedOnboardingState().step;
    if (guidedStep === "date_details" || guidedStep === "period_details") {
      updateGuidedOnboarding({
        type: guidedStep === "period_details" ? "period_saved" : "date_saved",
      });
      setGuidedDraft(null);
    }

    notify({
      tone: "success",
      title: "Evento criado",
      description: "O novo evento já aparece no calendário.",
    });
  };

  const handleMobileFabCreate = React.useCallback((dateIso?: string) => {
    const fallbackTodayIso = dateIso || todayIso || format(new Date(), "yyyy-MM-dd");

    setEditingId(null);
    setDialogAnchorPoint(undefined);
    setCreatingRange(null);
    setSeedRange({
      startDate: fallbackTodayIso,
      endDate: fallbackTodayIso,
    });
    setDialogOpen(true);
  }, [todayIso]);

  const handleDeleteEvent = React.useCallback(() => {
    if (!editingId) return;

    deleteEvent(editingId);
    recordDemoInteraction(`mutation:event:delete:${editingId}`);

    notify({
      tone: "success",
      title: "Evento excluído",
      description: "O calendário foi atualizado.",
    });

    setDialogAnchorPoint(undefined);
    setDialogOpen(false);
  }, [deleteEvent, editingId, notify, recordDemoInteraction]);

  const handleStartCreateRange = (startIso: string) => {
    if (isMobileExamplePreview) return;
    setCreatingRange({ startIso, hoverIso: startIso, isDragging: false });
  };

  const handleHoverCreateRange = (hoverIso: string) => {
    setCreatingRange((prev) => {
      if (!prev) return prev;
      if (prev.hoverIso === hoverIso && prev.isDragging) return prev;

      return { ...prev, hoverIso, isDragging: true };
    });
  };

  const handleFinishCreateRange = React.useCallback(
    (endIso?: string, anchorPoint?: AnchorPoint) => {
      setCreatingRange((prev) => {
        if (!prev) return prev;

        const resolvedEnd = endIso ?? prev.hoverIso;
        const start = parseISO(prev.startIso);
        const end = parseISO(resolvedEnd);
        const normalizedStart = start <= end ? start : end;
        const normalizedEnd = start <= end ? end : start;

        const nextDraft = {
          startDate: format(normalizedStart, "yyyy-MM-dd"),
          endDate: format(normalizedEnd, "yyyy-MM-dd"),
        };

        const currentStep = guidedOnboarding?.step;
        if (
          showGuidedOnboarding &&
          (currentStep === "date_instruction" ||
            currentStep === "date_details")
        ) {
          setGuidedDraft({
            startDate: nextDraft.startDate,
            endDate: nextDraft.startDate,
          });
          if (currentStep === "date_instruction") {
            updateGuidedOnboarding({ type: "select_date" });
          }
          setSeedRange({
            startDate: nextDraft.startDate,
            endDate: nextDraft.startDate,
          });
          setEditingId(null);
          setDialogAnchorPoint(anchorPoint);
          setDialogOpen(true);
          return null;
        }
        if (
          showGuidedOnboarding &&
          (currentStep === "period_instruction" ||
            currentStep === "period_details")
        ) {
          if (nextDraft.startDate === nextDraft.endDate) {
            notify({
              tone: "info",
              title: "Selecione um período",
              description: "Arraste até outro dia para definir o início e o fim.",
            });
            return null;
          }
          setGuidedDraft(nextDraft);
          if (currentStep === "period_instruction") {
            updateGuidedOnboarding({ type: "select_period" });
          }
          setSeedRange(nextDraft);
          setEditingId(null);
          setDialogAnchorPoint(anchorPoint);
          setDialogOpen(true);
          return null;
        }
        setSeedRange(nextDraft);

        setEditingId(null);
        setDialogAnchorPoint(anchorPoint);
        setDialogOpen(true);

        return null;
      });
    },
    [
      guidedOnboarding?.step,
      notify,
      showGuidedOnboarding,
      updateGuidedOnboarding,
    ]
  );

  const saveGuidedDraft = React.useCallback(
    (title: string) => {
      if (!guidedDraft || !guidedOnboarding?.context || !title.trim()) return;
      const intent =
        guidedOnboarding.step === "period_details" ? "period" : "date";
      const categoryId =
        intent === "period"
          ? guidedOnboarding.periodCategoryId
          : guidedOnboarding.dateCategoryId;
      if (!categoryId) return;
      if (
        guidedDraft.startDate > guidedDraft.endDate ||
        (intent === "period" && guidedDraft.startDate === guidedDraft.endDate)
      ) {
        notify({
          tone: "error",
          title: "Confira o período",
          description: "A data final precisa vir depois da data inicial.",
        });
        return;
      }
      const eventId = addEvent({
        title: title.trim(),
        categoryId,
        startDate: guidedDraft.startDate,
        endDate: guidedDraft.endDate,
        recurrenceType:
          categoryId === ONBOARDING_CATEGORY_IDS.birthday
            ? "yearly"
            : undefined,
      });
      if (!eventId) {
        notify({
          tone: "error",
          title: "Não foi possível salvar",
          description: "Tente selecionar a data novamente.",
        });
        return;
      }
      setHighlightedEventId(eventId);
      updateGuidedOnboarding({
        type: intent === "period" ? "period_saved" : "date_saved",
      });
      setGuidedDraft(null);
      setMobileGuidedRangeStart(null);
      notify({
        tone: "success",
        title: intent === "period" ? "Período adicionado" : "Data adicionada",
        description: "Já dá para ver isso ocupando espaço no seu ano.",
      });
    },
    [addEvent, guidedDraft, guidedOnboarding, notify, updateGuidedOnboarding]
  );

  const handleMobileGuidedDaySelect = React.useCallback(
    (dateIso: string) => {
      const step = guidedOnboarding?.step;
      if (step === "date_instruction" || step === "date_details") {
        setGuidedDraft({ startDate: dateIso, endDate: dateIso });
        if (step === "date_instruction") {
          updateGuidedOnboarding({ type: "select_date" });
        }
        return;
      }
      if (step !== "period_instruction" && step !== "period_details") return;
      if (!mobileGuidedRangeStart) {
        setMobileGuidedRangeStart(dateIso);
        return;
      }
      const [startDate, endDate] =
        mobileGuidedRangeStart <= dateIso
          ? [mobileGuidedRangeStart, dateIso]
          : [dateIso, mobileGuidedRangeStart];
      if (startDate === endDate) return;
      setGuidedDraft({ startDate, endDate });
      setMobileGuidedRangeStart(null);
      if (step === "period_instruction") {
        updateGuidedOnboarding({ type: "select_period" });
      }
    },
    [guidedOnboarding?.step, mobileGuidedRangeStart, updateGuidedOnboarding]
  );

  React.useEffect(() => {
    if (windowContext !== "main") return;

    const onWindowMouseUp = (event: MouseEvent) => {
      if (!creatingRange) return;
      handleFinishCreateRange(undefined, {
        x: event.clientX,
        y: event.clientY,
      });
    };

    window.addEventListener("mouseup", onWindowMouseUp);

    return () => window.removeEventListener("mouseup", onWindowMouseUp);
  }, [creatingRange, handleFinishCreateRange, windowContext]);

  const syncDebugDetail =
    syncError && isDetailedSyncDiagnosticsEnabled
      ? formatSyncDebugDetail(syncError)
      : null;

  const handleRetrySync = React.useCallback(() => {
    setSyncBlocked(false);
    setSyncError(null);
    void bootstrapRemote();
  }, [bootstrapRemote]);

  const rawSyncState = React.useMemo<RawSyncState>(() => {
    if (!session?.user.id) {
      return { state: "hidden" };
    }

    if (syncError || syncBlocked) {
      return {
        state: "error",
        message: syncError
          ? SYNC_HINT_BY_KIND[syncError.kind] ?? syncError.message
          : "Falha de sincronizacao. Tente novamente.",
        detail: syncDebugDetail,
        onRetry: handleRetrySync,
      };
    }

    if (!remoteReady || isBootstrappingSync) {
      return { state: "loading" };
    }

    if (hasQueuedSave || isSyncing) {
      return { state: "saving" };
    }

    return { state: "synced" };
  }, [
    handleRetrySync,
    hasQueuedSave,
    isBootstrappingSync,
    isSyncing,
    remoteReady,
    session?.user.id,
    syncBlocked,
    syncDebugDetail,
    syncError,
  ]);

  const clearSyncOverlayTimer = React.useCallback(() => {
    if (syncOverlayTimerRef.current !== null) {
      window.clearTimeout(syncOverlayTimerRef.current);
      syncOverlayTimerRef.current = null;
    }
  }, []);

  const handleSyncOverlayErrorOpenChange = React.useCallback((open: boolean) => {
    syncOverlayErrorOpenRef.current = open;
    setIsSyncOverlayErrorOpen(open);

    if (!open && shouldHideSyncOverlayAfterCloseRef.current) {
      shouldHideSyncOverlayAfterCloseRef.current = false;
      setIsSyncOverlayVisible(false);
    }
  }, []);

  React.useEffect(() => {
    if (windowContext !== "main") return;

    const previousState = previousRawSyncStateRef.current;
    previousRawSyncStateRef.current = rawSyncState.state;

    if (rawSyncState.state === "hidden") {
      clearSyncOverlayTimer();
      shouldHideSyncOverlayAfterCloseRef.current = false;
      syncOverlayErrorOpenRef.current = false;
      setIsSyncOverlayErrorOpen(false);
      setIsSyncOverlayVisible(false);
      setSyncOverlayStatus(null);
      return;
    }

    if (rawSyncState.state === "loading" || rawSyncState.state === "saving") {
      clearSyncOverlayTimer();
      shouldHideSyncOverlayAfterCloseRef.current = false;
      syncOverlayErrorOpenRef.current = false;
      setIsSyncOverlayErrorOpen(false);
      setSyncOverlayStatus(rawSyncState);
      setIsSyncOverlayVisible(true);
      return;
    }

    if (rawSyncState.state === "error") {
      clearSyncOverlayTimer();
      shouldHideSyncOverlayAfterCloseRef.current = false;
      syncOverlayErrorOpenRef.current = false;
      setIsSyncOverlayErrorOpen(false);
      setSyncOverlayStatus(rawSyncState);
      setIsSyncOverlayVisible(true);

      syncOverlayTimerRef.current = window.setTimeout(() => {
        if (syncOverlayErrorOpenRef.current) {
          shouldHideSyncOverlayAfterCloseRef.current = true;
          return;
        }

        setIsSyncOverlayVisible(false);
      }, 6000);

      return;
    }

    if (rawSyncState.state === "synced") {
      const shouldShowSuccess =
        previousState === "loading" ||
        previousState === "saving" ||
        previousState === "error";

      clearSyncOverlayTimer();
      shouldHideSyncOverlayAfterCloseRef.current = false;
      syncOverlayErrorOpenRef.current = false;
      setIsSyncOverlayErrorOpen(false);

      if (!shouldShowSuccess) {
        setIsSyncOverlayVisible(false);
        return;
      }

      setSyncOverlayStatus(rawSyncState);
      setIsSyncOverlayVisible(true);

      syncOverlayTimerRef.current = window.setTimeout(() => {
        setIsSyncOverlayVisible(false);
      }, 1000);
    }
  }, [clearSyncOverlayTimer, rawSyncState, windowContext]);

  React.useEffect(() => {
    return () => {
      clearSyncOverlayTimer();
    };
  }, [clearSyncOverlayTimer]);

  React.useEffect(() => {
    if (!highlightedEventId) return;

    const highlightTimer = window.setTimeout(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const nodes = document.querySelectorAll<HTMLElement>(
        `[data-calendar-event-id="${highlightedEventId}"]`
      );
      nodes.forEach((node) => {
        node.animate(
          [
            { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(37, 99, 235, 0)" },
            {
              transform: "scale(1.035)",
              boxShadow: "0 0 0 4px rgba(37, 99, 235, 0.2)",
            },
            { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(37, 99, 235, 0)" },
          ],
          { duration: 900, easing: "ease-out" }
        );
      });
    }, 50);

    const cleanupTimer = window.setTimeout(() => {
      setHighlightedEventId(null);
    }, 1200);

    return () => {
      window.clearTimeout(highlightTimer);
      window.clearTimeout(cleanupTimer);
    };
  }, [highlightedEventId]);

  const onboardingFocusTarget = React.useMemo<OnboardingFocusTarget>(() => {
    if (!showGuidedOnboarding || !guidedOnboarding) return null;
    if (!guidedOnboarding.context) return null;
    if (
      guidedOnboarding.step === "date_category_reveal"
    ) {
      return guidedOnboarding.dateCategoryId
        ? {
            kind: "category",
            id: guidedOnboarding.dateCategoryId,
            effect: "reveal",
          }
        : null;
    }
    if (
      guidedOnboarding.step === "period_category_reveal"
    ) {
      return guidedOnboarding.periodCategoryId
        ? {
            kind: "category",
            id: guidedOnboarding.periodCategoryId,
            effect: "reveal",
          }
        : null;
    }
    return null;
  }, [guidedOnboarding, showGuidedOnboarding]);

  const guidedSelectionNotice = React.useMemo(
    () =>
      showGuidedOnboarding && guidedOnboarding
        ? getGuidedSelectionNotice({
            state: guidedOnboarding,
            isMobile: isMobileCalendarUi === true,
            mobileRangeStart: mobileGuidedRangeStart,
            draft: guidedDraft,
          })
        : null,
    [
      guidedDraft,
      guidedOnboarding,
      isMobileCalendarUi,
      mobileGuidedRangeStart,
      showGuidedOnboarding,
    ]
  );

  const guidedToolbarNotice = React.useMemo<GuidedToolbarNotice | null>(() => {
    if (!showGuidedOnboarding || !guidedOnboarding) return null;
    const showHabitSteps = isHabitsPrototypeEnabled && isMobileCalendarUi !== true;
    const { current, total } = getGuidedOnboardingProgress(
      guidedOnboarding.step,
      { showHabitSteps }
    );
    const stepLabel = `Passo ${current} de ${total}`;
    if (guidedOnboarding.step === "edit_instruction") {
      return {
        target: "edit",
        title: "Organize contextos e categorias.",
        instruction:
          isMobileCalendarUi === true
            ? "Toque no lápis para abrir o modo de edição."
            : "Clique em Organizar para abrir o modo de edição.",
        stepLabel,
      };
    }
    if (guidedOnboarding.step === "edit_preview") {
      return {
        target: "edit",
        title: "Este é o modo de edição.",
        instruction:
          isMobileCalendarUi === true
            ? "Aqui você poderá ajustar nomes, cores e organização. Toque em Finalizar para continuar."
            : "Aqui você poderá ajustar nomes, cores e organização. Clique em Finalizar para continuar.",
        stepLabel,
      };
    }
    if (guidedOnboarding.step === "calendar_instruction") {
      return {
        target: "calendars",
        title: "Complemente seu ano com calendários prontos.",
        instruction: "Use o + para abrir as opções e escolher um calendário.",
        stepLabel,
      };
    }
    if (guidedOnboarding.step === "year_instruction") {
      return {
        target: "year",
        title: "Aqui você troca o ano.",
        instruction:
          "Depois do guia, use estas setas para consultar o ano anterior ou o próximo.",
        actionLabel: "Continuar",
        stepLabel,
      };
    }
    if (
      guidedOnboarding.step === "period_navigation_instruction" &&
      isMobileCalendarUi !== true
    ) {
      return {
        target: "period-navigation",
        title: "Navegue pelo seu ano.",
        instruction:
          "Clique nos rótulos Q1–Q4 e JAN–DEZ para ir direto a trimestres e meses.",
        actionLabel: "Continuar",
        stepLabel,
      };
    }
    if (
      guidedOnboarding.step === "habit_surface_instruction" &&
      isMobileCalendarUi !== true
    ) {
      return {
        target: "habit-surface",
        title: "Conheça seus hábitos.",
        instruction: "Clique em Hábitos no topo para mudar de tela.",
        stepLabel,
      };
    }
    if (
      guidedOnboarding.step === "habit_instruction" &&
      isMobileCalendarUi !== true
    ) {
      return {
        target: "habit",
        title: "Crie seu primeiro hábito.",
        instruction:
          "Viagens, férias e noites especiais já mudam o ritmo de Exercício e Ler 20 minutos. Abra o + e crie o seu.",
        stepLabel,
      };
    }
    if (
      guidedOnboarding.step === "habit_created_confirmation" &&
      isMobileCalendarUi !== true
    ) {
      return {
        target: "habit-created",
        title: "Seu primeiro hábito está pronto.",
        instruction:
          "Antes de finalizar, registre como foram as duas últimas semanas — marque os dias que conseguir. Não precisa ser exato.",
        actionLabel: "Finalizar guia",
        stepLabel,
      };
    }
    if (guidedOnboarding.step === "theme_instruction") {
      return {
        target: "theme",
        title: "Escolha o clima do seu ano.",
        instruction:
          "Teste o tema claro e escuro e fique com o que combina mais com você.",
        actionLabel:
          !isHabitsPrototypeEnabled ||
          isMobileCalendarUi === true ||
          guidedOnboarding.themeConfirmedAt
            ? "Finalizar guia"
            : undefined,
        stepLabel,
      };
    }
    return null;
  }, [guidedOnboarding, isMobileCalendarUi, showGuidedOnboarding]);

  const handleGuidedToolbarAction = React.useCallback((
    target: GuidedToolbarNotice["target"]
  ) => {
    const current = readGuidedOnboardingState();
    if (target === "edit" && current.step === "edit_instruction") {
      updateGuidedOnboarding({
        type: "open_edit_preview",
        continueToCalendar:
          isHabitsPrototypeEnabled && isMobileCalendarUi !== true,
      });
      return;
    }
    if (target === "edit" && current.step === "edit_preview") {
      updateGuidedOnboarding({ type: "finish_edit_preview" });
      return;
    }
    if (target === "year" && current.step === "year_instruction") {
      const next = updateGuidedOnboarding({
        type: "continue_from_year",
        showPeriodNavigation:
          isHabitsPrototypeEnabled && isMobileCalendarUi !== true,
      });
      finalizeGuidedOnboarding(next);
      return;
    }
    if (
      target === "period-navigation" &&
      current.step === "period_navigation_instruction"
    ) {
      resetCalendarFocusOnYearChange();
      updateGuidedOnboarding({
        type: "continue_from_period_navigation",
        showHabit: true,
      });
      return;
    }
    if (target === "theme" && current.step === "theme_instruction") {
      const next = updateGuidedOnboarding({
        type: "confirm_theme",
        complete: true,
      });
      finalizeGuidedOnboarding(next);
    }
  }, [
    finalizeGuidedOnboarding,
    isMobileCalendarUi,
    resetCalendarFocusOnYearChange,
    updateGuidedOnboarding,
  ]);

  const handleGuidedCalendarOpen = React.useCallback(() => {
    if (readGuidedOnboardingState().step === "calendar_instruction") {
      updateGuidedOnboarding({ type: "open_calendar" });
    }
  }, [updateGuidedOnboarding]);

  const handleGuidedCalendarClose = React.useCallback(() => {
    if (readGuidedOnboardingState().step === "calendar_selection") {
      updateGuidedOnboarding({ type: "close_calendar" });
    }
  }, [updateGuidedOnboarding]);

  const handleGuidedCalendarImported = React.useCallback(
    (pack?: CalendarPack) => {
      if (!pack) return;
      const uf = pack.regionCode;
      const packGroupId = getCalendarPackGroupId(pack);
      const next = updateGuidedOnboarding({
        type: "calendar_added",
        uf,
        packGroupId,
      });
      if (next.step === "year_instruction") {
        setWorkspaceEditMode(null);
        if (uf) void trackOnboardingRegion(uf);
      }
    },
    [updateGuidedOnboarding]
  );

  React.useEffect(() => {
    if (
      guidedOnboarding?.step !== "calendar_instruction" &&
      guidedOnboarding?.step !== "calendar_selection"
    ) {
      return;
    }
    const holidayCategory = categories.find(
      (category) => category.calendarPackGroupId === "holidays-by-state"
    );
    if (!holidayCategory) return;
    const pack = calendarPacks.find(
      (candidate) => candidate.id === holidayCategory.calendarPackVariantId
    );
    handleGuidedCalendarImported(pack);
  }, [calendarPacks, categories, guidedOnboarding?.step, handleGuidedCalendarImported]);

  const handleYearChange = React.useCallback(
    (nextYear: number) => {
      setYear(nextYear);
      resetCalendarFocusOnYearChange();
      recordDemoInteraction(`year:${nextYear}`);
    },
    [recordDemoInteraction, resetCalendarFocusOnYearChange]
  );

  React.useEffect(() => {
    setMobileActiveDateIso((currentIso) => {
      if (Number(currentIso.slice(0, 4)) === year) return currentIso;
      if (todayIso && Number(todayIso.slice(0, 4)) === year) return todayIso;
      return `${year}-01-01`;
    });
  }, [todayIso, year]);

  const handleDestinationSelect = React.useCallback(
    (destination: ProductDestinationId) => {
      if (destination === activeDestination) return;
      const currentGuidedState = readGuidedOnboardingState();
      if (
        destination === "habits" &&
        currentGuidedState.step === "habit_surface_instruction"
      ) {
        setYear(initialYear);
        resetCalendarFocusOnYearChange();
        updateGuidedOnboarding({
          type: "open_habits_surface",
          hasExistingHabit: hasExistingHabits,
        });
      }
      if (activeDestination === "annual" && isMobileCalendarUi === false) {
        desktopCalendarScrollTopRef.current =
          desktopCalendarScrollRef.current?.scrollTop ?? 0;
      }
      setWorkspaceEditMode(null);
      setActiveDestination(destination);
      window.history.replaceState(
        window.history.state,
        "",
        buildProductDestinationUrl(window.location.href, destination)
      );
    },
    [
      activeDestination,
      hasExistingHabits,
      initialYear,
      isMobileCalendarUi,
      resetCalendarFocusOnYearChange,
      updateGuidedOnboarding,
    ]
  );

  const handleOpenUtilityPanel = React.useCallback(
    (section: UtilityPanelSection, trigger: HTMLElement) => {
      utilityPanelTriggerRef.current = trigger;
      setUtilityPanelSection(section);
      setUtilityPanelOpen(true);
      if (readGuidedOnboardingState().step === "profile_instruction") {
        updateGuidedOnboarding({ type: "open_profile" });
      }
    },
    [updateGuidedOnboarding]
  );

  const handleToggleHabitsEditing = React.useCallback(() => {
    setWorkspaceEditMode((current) => (current === "habits" ? null : "habits"));
  }, []);

  React.useLayoutEffect(() => {
    if (
      !isHabitsPrototypeEnabled ||
      activeDestination !== "annual" ||
      isMobileCalendarUi !== false
    ) {
      return;
    }
    const scrollRegion = desktopCalendarScrollRef.current;
    if (!scrollRegion || desktopCalendarScrollTopRef.current <= 0) return;
    scrollRegion.scrollTop = desktopCalendarScrollTopRef.current;
  }, [activeDestination, isMobileCalendarUi]);

  React.useEffect(() => {
    if (
      isMobileCalendarUi !== true ||
      guidedOnboarding?.step !== "period_navigation_instruction"
    ) {
      return;
    }
    updateGuidedOnboarding({ type: "continue_from_period_navigation" });
  }, [guidedOnboarding?.step, isMobileCalendarUi, updateGuidedOnboarding]);

  const isHabitsSurfaceActive =
    isHabitsPrototypeEnabled && activeDestination === "habits";
  const isCalendarSurfaceActive = !isHabitsSurfaceActive;
  const headerGuidedToolbarNotice =
    isHabitsPrototypeEnabled &&
    (guidedToolbarNotice?.target === "theme" ||
      guidedToolbarNotice?.target === "appearance" ||
      guidedToolbarNotice?.target === "year" ||
      guidedToolbarNotice?.target === "habit-showcase" ||
      guidedToolbarNotice?.target === "habit" ||
      guidedToolbarNotice?.target === "habit-created")
      ? null
      : guidedToolbarNotice;

  if (windowContext === "popup") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">{popupStatusMessage}</p>
      </main>
    );
  }

  return (
    <main
      data-doze52-app-shell
      className={cn(
        "mx-auto w-full max-w-none",
        isMobileCalendarUi
          ? cn(
              "flex h-[100dvh] min-h-0 flex-col overflow-hidden px-3 pt-2",
              isHabitsPrototypeEnabled ? "pb-0" : "pb-1"
            )
          : cn(
              "flex h-full min-h-0 flex-col overflow-hidden pt-3 pb-2 md:pb-4",
              "px-4"
            )
      )}
    >
      {isHabitsPrototypeEnabled && isMobileCalendarUi !== null ? (
        <>
          <AdaptiveNavigation
            activeDestination={activeDestination}
            authLoading={authLoading}
            onDestinationSelect={handleDestinationSelect}
            onOpenUtilityPanel={handleOpenUtilityPanel}
          />
          <AppUtilityPanel
            open={utilityPanelOpen}
            section={utilityPanelSection}
            isMobile={isMobileCalendarUi}
            returnFocusRef={utilityPanelTriggerRef}
            guidedAppearanceNotice={
              guidedToolbarNotice?.target === "appearance"
                ? guidedToolbarNotice
                : null
            }
            onOpenChange={setUtilityPanelOpen}
            onOpenAuthDialog={() => {
              setAuthDialogInitialMode("login");
              setAuthDialogAnchorPoint(undefined);
              setAuthDialogOpen(true);
            }}
            onDismissGuidedNotice={dismissGuidedOnboarding}
            onGuidedAppearanceOpen={() =>
              updateGuidedOnboarding({ type: "open_appearance" })
            }
          />
        </>
      ) : null}

      <SyncStatusOverlay
        status={syncOverlayStatus}
        visible={isSyncOverlayVisible}
        errorPopoverOpen={isSyncOverlayErrorOpen}
        onErrorPopoverOpenChange={handleSyncOverlayErrorOpenChange}
      />

      <div className="z-30 shrink-0 bg-background pb-0">
        <AppHeader
          year={year}
          onYearChange={handleYearChange}
          authLoading={authLoading}
          isAuthenticated={Boolean(session)}
          isMobileCalendarUi={isMobileCalendarUi === true}
          showCalendarControls={isCalendarSurfaceActive}
          useAdaptiveNavigation={isHabitsPrototypeEnabled}
          activeDestination={activeDestination}
          onDestinationSelect={handleDestinationSelect}
          onOpenUtilityPanel={handleOpenUtilityPanel}
          onToggleHabitsEditing={handleToggleHabitsEditing}
          habitsEditingActive={workspaceEditMode === "habits"}
          habitsOrganizeDisabled={Boolean(onboardingHabitShowcase)}
          onCalendarPackFocusYear={handleYearChange}
          onboardingFocusTarget={
            isCalendarSurfaceActive ? onboardingFocusTarget : null
          }
          guidedSelectionNotice={
            isCalendarSurfaceActive ? guidedSelectionNotice : null
          }
          guidedToolbarNotice={
            isCalendarSurfaceActive ? headerGuidedToolbarNotice : null
          }
          onDismissGuidedSelection={dismissGuidedOnboarding}
          onGuidedToolbarAction={handleGuidedToolbarAction}
          onGuidedCalendarOpen={handleGuidedCalendarOpen}
          onGuidedCalendarClose={handleGuidedCalendarClose}
          onGuidedCalendarImported={handleGuidedCalendarImported}
          guidedCalendarSelectionActive={
            guidedOnboarding?.step === "calendar_instruction" ||
            guidedOnboarding?.step === "calendar_selection"
          }
          guidedEditPreviewActive={
            isCalendarSurfaceActive && guidedOnboarding?.step === "edit_preview"
          }
          onboardingLayoutLocked={false}
          onboardingLayoutReserved={
            isCalendarSurfaceActive && Boolean(guidedSelectionNotice)
          }
          onInlineEditModeChange={(active) =>
            setWorkspaceEditMode(active ? "calendar" : null)
          }
          controlledInlineEditMode={inlineEditModeActive}
          onFilterLayoutChange={requestDesktopTodayCenter}
          exitInlineEditRequestKey={exitInlineEditRequestKey}
          expandCategoriesRequestKey={expandCategoriesRequestKey}
          onYearLabelClick={
            isMobileCalendarUi === true
              ? () => setScrollToTodayRequestKey((key) => key + 1)
              : undefined
          }
          onGuidedThemeChange={() =>
            updateGuidedOnboarding({ type: "confirm_theme" })
          }
          headerMinimized={headerMinimized}
          onToggleHeaderMinimized={() => setHeaderMinimized(!headerMinimized)}
          mobileExamplePreviewActive={isMobileExamplePreview}
          demoExplorationActive={isDemoExploration}
          onCategoryCreated={(categoryId) => {
            recordDemoInteraction(`mutation:category:create:${categoryId}`);
            trackPostExitCreation(`category:${categoryId}`);
          }}
          onProfileCreated={(profileId) => {
            recordDemoInteraction(`mutation:profile:create:${profileId}`);
            trackPostExitCreation(`profile:${profileId}`);
          }}
          onOpenAuthDialog={(anchorPoint) => {
            setAuthDialogInitialMode("login");
            setAuthDialogAnchorPoint(anchorPoint);
            setAuthDialogOpen(true);
          }}
        />
      </div>

      {isHabitsSurfaceActive && isMobileCalendarUi !== null ? (
        <HabitsPrototype
          year={year}
          todayIso={todayIso}
          isMobile={isMobileCalendarUi}
          isEditing={workspaceEditMode === "habits"}
          headerMinimized={headerMinimized}
          onYearChange={handleYearChange}
          onRequireAuth={() => {
            setAuthDialogInitialMode("login");
            setAuthDialogAnchorPoint(undefined);
            setAuthDialogOpen(true);
          }}
          onRequestSignup={(trigger) => {
            handleOpenUtilityPanel("account", trigger);
          }}
          isAuthenticated={Boolean(session)}
          guidedNotice={
            guidedToolbarNotice?.target === "habit-showcase" ||
            guidedToolbarNotice?.target === "habit" ||
            guidedToolbarNotice?.target === "habit-created"
              ? guidedToolbarNotice
              : null
          }
          showcase={onboardingHabitShowcase}
          showcaseDisplay={onboardingHabitShowcaseDisplay}
          onDismissGuidedNotice={dismissGuidedOnboarding}
          onHabitCreated={() =>
            updateGuidedOnboarding({ type: "habit_saved" })
          }
          retrospectiveInteracted={Boolean(
            guidedOnboarding?.habitRetrospectiveInteractedAt
          )}
          scrollToTodayRequestKey={scrollToTodayRequestKey}
          onHabitCheckIn={() => {
            if (
              readGuidedOnboardingState().step ===
              "habit_created_confirmation"
            ) {
              updateGuidedOnboarding({
                type: "interact_with_habit_retrospective",
              });
            }
          }}
          onGuidedNoticeAction={(input) => {
            const current = readGuidedOnboardingState();
            if (current.step === "habit_showcase_instruction") {
              updateGuidedOnboarding({
                type: "continue_from_habit_showcase",
                hasExistingHabit: input?.hasExistingHabit,
              });
              return;
            }
            if (current.step !== "habit_created_confirmation") return;
            const next = updateGuidedOnboarding({
              type: "finish_habit_onboarding",
            });
            finalizeGuidedOnboarding(next);
          }}
        />
      ) : isMobileCalendarUi === true ? (
        <MobileCalendarExperience
          year={year}
          todayIso={todayIso}
          events={renderEvents}
          activeDateIso={mobileActiveDateIso}
          onActiveDateChange={setMobileActiveDateIso}
          onYearChange={handleYearChange}
          onEditEvent={handleEditEvent}
          guidedSelectionMode={
            showGuidedOnboarding &&
            (guidedOnboarding?.step === "date_instruction" ||
              guidedOnboarding?.step === "date_details")
              ? "date"
              : showGuidedOnboarding &&
                  (guidedOnboarding?.step === "period_instruction" ||
                    guidedOnboarding?.step === "period_details")
                ? "period"
                : null
          }
          guidedRangeStart={mobileGuidedRangeStart}
          guidedSelectionRange={guidedDraft}
          onGuidedDaySelect={handleMobileGuidedDaySelect}
          scrollToTodayRequestKey={scrollToTodayRequestKey}
        />
      ) : (
        <div
          className="min-h-0 flex-1 overflow-hidden pb-1"
        >
          <div
            data-calendar-focus-root
            data-calendar-ui-mode="desktop"
            className={cn(
              "relative h-full min-h-0 rounded-xl doze52-calendar-mode-transition",
              showGuidedOnboarding &&
                (guidedOnboarding?.step === "date_instruction" ||
                  guidedOnboarding?.step === "date_details" ||
                  guidedOnboarding?.step === "period_instruction" ||
                  guidedOnboarding?.step === "period_details")
                ? "ring-2 ring-primary/35 ring-offset-4 ring-offset-background shadow-[0_22px_70px_-42px_rgba(37,99,235,0.72)]"
                : null
            )}
          >
            <YearGrid
              year={year}
              onYearChange={handleYearChange}
              todayIso={todayIso}
              events={renderEvents}
              onEditEvent={handleEditEvent}
              creatingRange={creatingRange}
              guidedSelectionRange={guidedDraft}
              onStartCreateRange={handleStartCreateRange}
              onHoverCreateRange={handleHoverCreateRange}
              onFinishCreateRange={handleFinishCreateRange}
              onMoveEventByDelta={moveEventByDelta}
              onApplyDayReorder={({ dayIso, eventId, toIndex, orderedIds }) => {
                void eventId;
                void toIndex;
                normalizeDayOrder(dayIso, orderedIds);
              }}
              isMobileInteractionMode={false}
              guidedYearNotice={
                isHabitsPrototypeEnabled &&
                guidedToolbarNotice?.target === "year"
                  ? guidedToolbarNotice
                  : null
              }
              onDismissGuidedYearNotice={dismissGuidedOnboarding}
              onGuidedYearAction={() => handleGuidedToolbarAction("year")}
              guidedPeriodNotice={
                guidedToolbarNotice?.target === "period-navigation"
                  ? guidedToolbarNotice
                  : null
              }
              onDismissGuidedPeriodNotice={dismissGuidedOnboarding}
              onGuidedPeriodAction={() =>
                handleGuidedToolbarAction("period-navigation")
              }
              onGuidedPeriodInteraction={() =>
                updateGuidedOnboarding({ type: "interact_with_period_navigation" })
              }
              guidedPeriodInteracted={Boolean(
                guidedOnboarding?.periodNavigationInteractedAt
              )}
              showScaleControl={!isHabitsPrototypeEnabled}
              scrollViewportRef={desktopCalendarScrollRef}
              scrollRegion="calendar"
            />
          </div>
        </div>
      )}

      {showGuidedOnboarding && guidedOnboarding ? (
        <GuidedOnboardingPanel
          state={guidedOnboarding}
          draft={guidedDraft}
          showHabitSteps={isHabitsPrototypeEnabled && isMobileCalendarUi !== true}
          isMobile={isMobileCalendarUi === true}
          onClose={dismissGuidedOnboarding}
          onConfigureContext={handleConfigureGuidedContext}
          onChooseCategory={handleChooseGuidedCategory}
          onChangeDraft={setGuidedDraft}
          onSaveDraft={saveGuidedDraft}
          onOpenLogin={() => {
            setAuthDialogInitialMode("login");
            setAuthDialogAnchorPoint(undefined);
            setAuthDialogOpen(true);
          }}
        />
      ) : null}

      <OnboardingExitDialog
        open={onboardingExitOpen}
        onOpenChange={setOnboardingExitOpen}
        onConfirm={confirmDismissGuidedOnboarding}
      />

      {isCalendarSurfaceActive && showMobileDesktopFirstGate ? (
        <MobileDesktopFirstGate
          allowExample={isInitialMobileOnboarding && !hasEstablishedSetup}
          onExploreExample={() => {
            writeMobileExamplePreviewSession();
            setMobileExamplePreviewDismissed(true);
          }}
          onOpenLogin={() => {
            setAuthDialogInitialMode("login");
            setAuthDialogAnchorPoint(undefined);
            setAuthDialogOpen(true);
          }}
          onBackToHabits={
            isHabitsPrototypeEnabled
              ? () => handleDestinationSelect("habits")
              : undefined
          }
        />
      ) : null}

      {isCalendarSurfaceActive &&
      (isDemoExploration ||
        (showGuidedOnboarding &&
          guidedOnboarding?.step === "context_selection")) ? (
        <div
          data-demo-mode-badge
          className="pointer-events-none fixed bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-full border border-border/75 bg-card/92 px-3 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground shadow-sm backdrop-blur"
        >
          Ano de exemplo
        </div>
      ) : null}

      {isCalendarSurfaceActive && showDemoInvite ? (
        <DemoExplorationInvite
          onCreateYear={restartGuidedOnboardingFromDemo}
          onContinue={() => setDemoInviteSuppressed(true)}
        />
      ) : null}

      {accountNudgeVisible && !session?.user.id ? (
        <AccountNudge
          onDismiss={() => setAccountNudgeVisible(false)}
          onCreateAccount={() => {
            setAccountNudgeVisible(false);
            setAuthDialogInitialMode("signup");
            setAuthDialogAnchorPoint(undefined);
            setAuthDialogOpen(true);
          }}
        />
      ) : null}

      {isCalendarSurfaceActive &&
      isMobileCalendarUi &&
      !showGuidedOnboarding &&
      !isMobileExamplePreview &&
      !showMobileDesktopFirstGate ? (
        <div
          className="fixed right-4 z-40"
          style={{
            bottom: isHabitsPrototypeEnabled
              ? "calc(env(safe-area-inset-bottom, 0px) + 4.75rem)"
              : "calc(env(safe-area-inset-bottom, 0px) + 2.75rem)",
          }}
        >
          <Button
            type="button"
            size="icon-lg"
            variant="premium"
            className="rounded-full shadow-[0_20px_40px_-24px_rgba(15,23,42,0.55)]"
            aria-label="Novo evento"
            onClick={() => handleMobileFabCreate(mobileActiveDateIso)}
          >
            <Plus className="size-5" />
          </Button>
        </div>
      ) : null}

      {!hasSupabaseEnv ? (
        <p className="mx-auto mt-4 w-fit rounded-full border border-amber-200/70 bg-amber-50/70 px-3 py-1 text-center text-[11px] font-medium text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
          Supabase nao configurado neste ambiente.
        </p>
      ) : null}

      <EventDialog
        open={dialogOpen}
          onOpenChange={(open) => {
          setDialogOpen(open);

          if (!open) {
            setDialogAnchorPoint(undefined);
            setSeedRange(null);
            setCreatingRange(null);
          }
        }}
        initialEvent={editingEvent}
        seedRange={seedRange}
        anchorPoint={dialogAnchorPoint}
        guidedIntent={null}
        initialCategoryId={
          guidedOnboarding?.step === "date_details"
            ? guidedOnboarding.dateCategoryId
            : guidedOnboarding?.step === "period_details"
              ? guidedOnboarding.periodCategoryId
              : undefined
        }
        initialRecurrenceType={
          guidedOnboarding?.step === "date_details" &&
          guidedOnboarding.dateCategoryId === ONBOARDING_CATEGORY_IDS.birthday
            ? "yearly"
            : undefined
        }
        onSubmit={handleSubmit}
        onDelete={
          editingId &&
          (!editingEvent?.calendarPackGroupId ||
            isOnboardingPersonalDemoGroup(editingEvent.calendarPackGroupId))
            ? handleDeleteEvent
            : undefined
        }
        allowManagedMutation={
          isOnboardingPersonalDemoGroup(editingEvent?.calendarPackGroupId) &&
          !session?.user.id
        }
      />

      <AuthDialog
        open={authDialogOpen}
        initialMode={authDialogInitialMode}
        onOpenChange={(open) => {
          setAuthDialogOpen(open);

          if (!open) {
            setAuthDialogAnchorPoint(undefined);
          }
        }}
        anchorPoint={authDialogAnchorPoint}
      />

      {isDetailedSyncDiagnosticsEnabled ? (
        <button
          type="button"
          onClick={handleRestartOnboardingForTesting}
          className="fixed bottom-3 left-3 z-[60] rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground"
        >
          Reiniciar onboarding
        </button>
      ) : null}
    </main>
  );
}
