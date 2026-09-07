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
import { MobileDesktopFirstNotice } from "@/components/onboarding/mobile-desktop-first-notice";
import { OnboardingExitDialog } from "@/components/onboarding/onboarding-exit-dialog";
import { GuidedTargetOutline } from "@/components/onboarding/guided-target-outline";
import {
  GuidedToolbarNoticeCard,
  type GuidedToolbarNotice,
} from "@/components/onboarding/guided-toolbar-notice";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback-provider";
import {
  isOnboardingProfilesSnapshot,
  isOnboardingCategoriesSnapshot,
  isOnboardingPersonalDemoSnapshot,
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
  getWrapUpCategorySuggestions,
  isGuidedOnboardingInProgress,
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
  readMobileHabitsOnboardingStep,
  resetMobileHabitsOnboarding,
  writeMobileHabitsOnboardingStep,
  type MobileHabitsOnboardingStep,
} from "@/lib/mobile-habits-onboarding";
import {
  ensureSnapshotCoverage,
  materializeUserOwnedSnapshot,
} from "@/lib/snapshot-ownership";
import { cn } from "@/lib/utils";
import type { AnchorPoint, CategoryItem } from "@/lib/types";
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
const MOBILE_DESKTOP_FIRST_NOTICE_STORAGE_KEY =
  "doze52:mobile-desktop-first-notice:dismissed";

const readDesktopFirstNoticeDismissed = () => {
  if (typeof window === "undefined") return false;

  try {
    return (
      window.localStorage.getItem(MOBILE_DESKTOP_FIRST_NOTICE_STORAGE_KEY) ===
      "true"
    );
  } catch {
    return false;
  }
};

const writeDesktopFirstNoticeDismissed = () => {
  try {
    window.localStorage.setItem(MOBILE_DESKTOP_FIRST_NOTICE_STORAGE_KEY, "true");
  } catch {
    // A faixa volta na próxima visita se o storage falhar; ela é dispensável,
    // então reaparecer é bem menos grave do que travar a tela.
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
  // Espelho do passo salvo por HabitsPrototype (lib/mobile-habits-onboarding.ts)
  // — a fonte da verdade continua lá; isto só existe para travar/destacar o
  // botão Anual da navegação, que não é filho daquele componente. Começa
  // nulo (não `readMobileHabitsOnboardingStep()` direto) para não arriscar
  // um descompasso de hidratação nesta página, que é renderizada no
  // servidor; HabitsPrototype relê e confirma o valor real assim que monta.
  const [mobileHabitsOnboardingStep, setMobileHabitsOnboardingStep] =
    React.useState<MobileHabitsOnboardingStep | null>(null);
  // Sem isso, o espelho só é populado quando `HabitsPrototype` monta — quem
  // chega direto na Anual (link, recarregou lá) sem passar por Hábitos
  // nesta sessão de navegador ficaria com os passos annual_*/goto_profile
  // salvos no storage mas invisíveis, porque o componente que os leria de
  // volta nunca montou.
  React.useEffect(() => {
    setMobileHabitsOnboardingStep(readMobileHabitsOnboardingStep());
  }, []);
  const mobileHabitsOnboardingNavLocked =
    (mobileHabitsOnboardingStep === "create_habit" ||
      mobileHabitsOnboardingStep === "mark_day") &&
    !(guidedOnboarding && isGuidedOnboardingInProgress(guidedOnboarding));
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
  const [utilityPanelAuthMode, setUtilityPanelAuthMode] = React.useState<
    "login" | "signup"
  >("login");
  const [desktopFirstNoticeDismissed, setDesktopFirstNoticeDismissed] =
    React.useState(readDesktopFirstNoticeDismissed);
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
    // No desktop isso equivale ao antigo `showGuidedOnboarding` (que já é
    // `guidedOnboardingEligible && isMobileCalendarUi === false`). No mobile
    // o tour guiado não roda, mas a vitrine precisa aparecer mesmo assim: é
    // por lá que chega a maior parte do tráfego, e abrir a grade vazia é a
    // pior primeira impressão justamente onde ela mais custa.
    guidedOnboardingEligible &&
      guidedOnboarding &&
      activeDestination === "habits" &&
      todayIso
  );
  // No mobile a vitrine nunca trava a tela: ela entra sempre pela via
  // "display" (soma aos hábitos reais em vez de substituí-los), para que o
  // "+" continue disponível desde o primeiro segundo.
  const habitShowcaseDisplayOnly = isMobileCalendarUi === true;
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
    !habitShowcaseDisplayOnly &&
    guidedHabitShowcaseSource &&
    guidedOnboarding &&
    shouldPresentOnboardingHabitShowcase(guidedOnboarding.step)
      ? guidedHabitShowcaseSource
      : null;
  // A partir do passo de criar o primeiro hábito, a vitrine continua visível
  // (o hábito real nasce ao lado dela), mas deixa de travar a interação.
  // No mobile essa é a única via: a vitrine já entra composta com os hábitos
  // reais desde o começo, sem passo travado.
  const onboardingHabitShowcaseDisplay =
    guidedHabitShowcaseSource &&
    guidedOnboarding &&
    (habitShowcaseDisplayOnly ||
      guidedOnboarding.step === "habit_instruction" ||
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
    const resolvedDestination = resolveInitialProductDestination({
      search: window.location.search,
      isMobile: isMobileCalendarUi,
    });
    // A trava do nav (handleDestinationSelect) só intercepta cliques — um
    // link direto para `?surface=annual` a contorna completamente. Mesma
    // regra aqui: quem ainda está criando o hábito ou marcando o primeiro
    // dia não entra na Anual, nem por URL. `null` conta como travado
    // também — é o valor de quem nunca abriu Hábitos nem uma vez (o próprio
    // link de entrada já foi direto para a Anual); manda para Hábitos, que
    // decide sozinho se essa pessoa é mesmo nova ou já estabelecida.
    // Duas exceções: autenticado nunca trava (a jornada é só para anônimo);
    // e quem já está em progresso no guia do desktop (ex.: abriu o tour lá,
    // depois trocou de aparelho) também não — ela está noutro fluxo guiado,
    // não faz sentido empurrá-la para o de Hábitos por cima.
    const mobileStepAtLoad = readMobileHabitsOnboardingStep();
    const initialDestination =
      resolvedDestination === "annual" &&
      isMobileCalendarUi === true &&
      !session?.user.id &&
      !isGuidedOnboardingInProgress(readGuidedOnboardingState()) &&
      (mobileStepAtLoad === null ||
        mobileStepAtLoad === "create_habit" ||
        mobileStepAtLoad === "mark_day")
        ? "habits"
        : resolvedDestination;
    setActiveDestination(initialDestination);
    window.history.replaceState(
      window.history.state,
      "",
      buildProductDestinationUrl(window.location.href, initialDestination)
    );
  }, [isMobileCalendarUi, session?.user.id]);

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
    isMobileOnboardingPending && isInitialMobileOnboarding
  );
  // Anual mobile is a read/consult surface, not a place to build the year —
  // that lives on desktop. Established mobile users (e.g. someone who signed
  // up and started habits from their phone) fall outside guidedOnboarding
  // once they have real content, so the notice greets them too until this
  // browser has confirmed at least one non-mobile visit. This is a local,
  // per-browser heuristic (no server-side "completed desktop onboarding" flag
  // exists yet), so it can re-trigger on a new device/browser even for
  // someone who already did this on desktop elsewhere — acceptable for now,
  // revisit if that turns out to be common.
  //
  // Isso já foi um Dialog sem saída (sem botão de fechar, com Escape e
  // clique-fora cancelados), que deixava `pointer-events: none` no body e
  // impedia até rolar o ano. Agora é uma faixa em fluxo no topo da Anual:
  // a mensagem continua, o bloqueio não.
  //
  // Dois públicos precisam da faixa: quem chega neste navegador sem nunca ter
  // visto o desktop, e quem começou a montar o ano no desktop e voltou ao
  // celular com o guia pela metade — esse segundo já marcou a visita, então
  // `hasConfirmedDesktopVisit` sozinho o deixaria de fora.
  //
  // Mas `hasConfirmedDesktopVisit` é uma heurística por NAVEGADOR — uma conta
  // autenticada com dados reais já confirmados pelo servidor (ano montado,
  // categorias criadas) não pode ver essa faixa só porque é a primeira vez
  // que ESTE navegador específico abre a Anual. A fonte da verdade da conta é
  // o servidor, não um flag local; `hasEstablishedSetup` só é confiável aqui
  // depois que `remoteReady` confirma que os dados já foram sincronizados.
  const isEstablishedAccount = Boolean(
    session?.user.id && remoteReady && hasEstablishedSetup
  );
  // Enquanto a continuação da jornada mobile está no ar na Anual (ver
  // mobileAnnualOnboardingNotice), essa faixa fica de fora — os dois juntos
  // disputariam o mesmo espaço no topo. Ela volta a fazer sentido só depois
  // que a jornada termina de verdade (variant "onboarding", abaixo).
  const mobileAnnualOnboardingActive = Boolean(
    mobileHabitsOnboardingStep &&
      mobileHabitsOnboardingStep !== "create_habit" &&
      mobileHabitsOnboardingStep !== "mark_day" &&
      mobileHabitsOnboardingStep !== "goto_annual" &&
      mobileHabitsOnboardingStep !== "completed" &&
      mobileHabitsOnboardingStep !== "dismissed"
  );
  const showMobileDesktopFirstNotice = Boolean(
    isMobileCalendarUi === true &&
      !authLoading &&
      !desktopFirstNoticeDismissed &&
      !isEstablishedAccount &&
      !mobileAnnualOnboardingActive &&
      (!hasConfirmedDesktopVisit || isMobileOnboardingPending)
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

  const recordDemoInteraction = React.useCallback(
    (key: string) => {
      if (readGuidedOnboardingState().step !== "demo_exploration") return;
      updateGuidedOnboarding({ type: "record_demo_interaction", key });
    },
    [updateGuidedOnboarding]
  );

  const handleYearChange = React.useCallback(
    (nextYear: number) => {
      setYear(nextYear);
      resetCalendarFocusOnYearChange();
      recordDemoInteraction(`year:${nextYear}`);
    },
    [recordDemoInteraction, resetCalendarFocusOnYearChange]
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
      // Antes de escolher o contexto ela pode explorar a aplicação livremente,
      // inclusive os Hábitos — mas a partir daqui o guia segue no Anual, que é
      // onde os próximos passos (criar categoria, etc.) acontecem. No mobile o
      // guia já começa em Hábitos de propósito, então não mexe lá.
      if (isMobileCalendarUi === false && activeDestination !== "annual") {
        setActiveDestination("annual");
        window.history.replaceState(
          window.history.state,
          "",
          buildProductDestinationUrl(window.location.href, "annual")
        );
      }
    },
    [
      activeDestination,
      configureOnboardingContext,
      initialYear,
      isMobileCalendarUi,
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

  // O ano de exemplo é um vislumbre de como a aplicação fica com uso
  // consistente — não vira dado da pessoa. No resumo final sobrevive só o
  // que é dela: a categoria que ela criou durante o tour (com os itens que
  // ela salvou nela) e o calendário pronto que ela escolheu, com os eventos
  // dele. Nada de categoria vazia sobrando. Roda uma única vez, ao entrar no
  // passo de resumo (wrap_up_instruction) — dali em diante ela já está livre
  // para adicionar categorias (inclusive pelas sugestões), então o
  // encerramento do guia não repete esse corte.
  const trimToRealCategories = React.useCallback(
    (next: GuidedOnboardingState) => {
      const current = useStore.getState();
      const createdCategoryIds = new Set(
        [next.dateCategoryId, next.periodCategoryId].filter(
          (categoryId): categoryId is string => Boolean(categoryId)
        )
      );
      // O pack escolhido no passo dos calendários prontos fica instalado
      // inteiro: ela seguiu a instrução do guia de propósito, e é ele que dá
      // volume ao ano. O fallback cobre estados antigos, salvos antes de o
      // guia registrar o grupo do pack.
      const chosenPackGroupId = next.addedCalendarPackGroupId;
      const isChosenPackCategory = (category: CategoryItem) =>
        Boolean(category.calendarPackGroupId) &&
        !isOnboardingPersonalDemoGroup(category.calendarPackGroupId) &&
        (!chosenPackGroupId ||
          category.calendarPackGroupId === chosenPackGroupId);
      const keepCategoryIds = new Set(
        current.categories
          .filter(
            (category) =>
              createdCategoryIds.has(category.id) ||
              isChosenPackCategory(category)
          )
          .map((category) => category.id)
      );
      const categories = current.categories.filter((category) =>
        keepCategoryIds.has(category.id)
      );
      const events = current.events.filter((event) =>
        keepCategoryIds.has(event.categoryId)
      );
      replaceAllData({ profiles: current.profiles, categories, events });
      unlockOnboardingPersonalDemo();
    },
    [replaceAllData, unlockOnboardingPersonalDemo]
  );

  const finalizeGuidedOnboarding = React.useCallback(
    (next: GuidedOnboardingState) => {
      if (next.step !== "completed") return;
      announceGuidedCompletion();
      setActiveDestination("annual");
      resetCalendarFocusOnYearChange();
      // Revelar o chrome aqui é decisão do guia, não da pessoa: usa o setter
      // interno para não travar o padrão automático por altura da janela.
      setHeaderMinimizedState(false);
      requestCategoriesRowExpanded();
      window.history.replaceState(
        window.history.state,
        "",
        buildProductDestinationUrl(window.location.href, "annual")
      );
    },
    [
      announceGuidedCompletion,
      requestCategoriesRowExpanded,
      resetCalendarFocusOnYearChange,
    ]
  );

  const handleRestartOnboardingForTesting = React.useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem("yiv-store");
      window.localStorage.removeItem("doze52:habits-store:v1");
      // Sem isso, reiniciar o onboarding do desktop não tocava nas chaves do
      // mobile — a jornada própria de Hábitos (Parte 3) ficava travada no
      // que já tivesse sido salvo antes (ex.: "completed" de um teste
      // anterior) e caía direto na dica antiga em vez de reabrir do passo 1.
      window.localStorage.removeItem("doze52:desktop-visit-confirmed");
      window.localStorage.removeItem(
        "doze52:mobile-desktop-first-notice:dismissed"
      );
      window.localStorage.removeItem(
        "doze52:mobile-onboarding:desktop-hint-dismissed"
      );
    } catch {
      // Recarrega mesmo assim; sem storage disponível não há o que limpar.
    }
    resetMobileHabitsOnboarding();
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
          "Use as setas para ver o ano anterior ou o próximo. Clique no número no centro para voltar para hoje.",
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
          "Clique nos rótulos Q1-Q4 e JAN-DEZ para ir direto a trimestres e meses. Arraste de um rótulo a outro para criar um período com vários meses ou trimestres de uma vez.",
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
          "Antes de continuar, marque os dias das duas últimas semanas que conseguir lembrar.",
        actionLabel: "Continuar",
        stepLabel,
      };
    }
    if (guidedOnboarding.step === "theme_instruction") {
      return {
        target: "theme",
        title: "Escolha o clima do seu ano.",
        instruction:
          "Teste o tema claro e escuro e fique com o que combina mais com você.",
        actionLabel: guidedOnboarding.themeConfirmedAt ? "Continuar" : undefined,
        stepLabel,
      };
    }
    if (guidedOnboarding.step === "visibility_instruction") {
      return {
        target: "visibility",
        title: "Esconda o que não precisa agora.",
        instruction:
          "Clique numa categoria para ocultá-la do seu ano. Ela continua guardada e volta quando você quiser.",
        actionLabel: "Continuar",
        stepLabel,
      };
    }
    if (guidedOnboarding.step === "wrap_up_instruction") {
      return {
        target: "wrap-up",
        title: "Veja o que você já construiu.",
        instruction: inlineEditModeActive
          ? "Sua categoria, seu calendário e seu hábito já estão aqui. Arraste até três sugestões abaixo que fizerem mais sentido pra você."
          : "Abra o Organizar para ver o que você já construiu e escolher mais algumas categorias.",
        actionLabel: inlineEditModeActive ? "Finalizar guia" : undefined,
        stepLabel,
        categorySuggestions: getWrapUpCategorySuggestions(
          guidedOnboarding.context
        ),
      };
    }
    return null;
  }, [
    guidedOnboarding,
    inlineEditModeActive,
    isMobileCalendarUi,
    showGuidedOnboarding,
  ]);

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
      const todayYear = todayIso ? Number(todayIso.slice(0, 4)) : year;
      if (year !== todayYear) {
        handleYearChange(todayYear);
      }
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
      if (next.step === "wrap_up_instruction") trimToRealCategories(next);
      return;
    }
    if (
      target === "visibility" &&
      current.step === "visibility_instruction"
    ) {
      updateGuidedOnboarding({ type: "continue_from_visibility" });
      return;
    }
    if (target === "wrap-up" && current.step === "wrap_up_instruction") {
      const next = updateGuidedOnboarding({ type: "continue_from_wrap_up" });
      setWorkspaceEditMode(null);
      finalizeGuidedOnboarding(next);
      return;
    }
    if (target === "profile" && current.step === "profile_instruction") {
      const next = updateGuidedOnboarding({ type: "finish_profile_onboarding" });
      finalizeGuidedOnboarding(next);
    }
  }, [
    finalizeGuidedOnboarding,
    handleYearChange,
    isMobileCalendarUi,
    resetCalendarFocusOnYearChange,
    setWorkspaceEditMode,
    todayIso,
    trimToRealCategories,
    updateGuidedOnboarding,
    year,
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
      if (destination === "annual" && isMobileCalendarUi === true) {
        // A jornada própria de Hábitos (lib/mobile-habits-onboarding.ts) leva
        // até aqui de propósito: quem ainda está criando o hábito ou
        // marcando o primeiro dia não pode pular direto para a Anual. Lê o
        // storage direto (não o espelho em estado) para não depender do
        // React já ter propagado a última mudança.
        const mobileStep = readMobileHabitsOnboardingStep();
        const desktopTourInProgress = isGuidedOnboardingInProgress(
          readGuidedOnboardingState()
        );
        if (
          !desktopTourInProgress &&
          (mobileStep === "create_habit" || mobileStep === "mark_day")
        ) {
          return;
        }
        if (mobileStep === "goto_annual") {
          // Chegou na Anual: a jornada continua aqui, pelo cabeçalho, antes
          // de terminar no Perfil (ver mobileAnnualOnboardingNotice abaixo).
          writeMobileHabitsOnboardingStep("annual_year");
          setMobileHabitsOnboardingStep("annual_year");
        }
      }
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
        // Abrir a conta a partir daqui já encerra o guia — ela segue direto
        // para o cadastro, sem mais um passo entre o convite e a ação.
        const next = updateGuidedOnboarding({
          type: "finish_profile_onboarding",
        });
        finalizeGuidedOnboarding(next);
      }
      if (readMobileHabitsOnboardingStep() === "goto_profile") {
        // Último passo da jornada própria do mobile: abrir o Perfil a
        // partir daqui já encerra ela, do mesmo jeito que o tour desktop
        // faz acima.
        writeMobileHabitsOnboardingStep("completed");
        setMobileHabitsOnboardingStep("completed");
        setUtilityPanelAuthMode("signup");
      } else {
        setUtilityPanelAuthMode("login");
      }
    },
    [finalizeGuidedOnboarding, updateGuidedOnboarding]
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
    (guidedToolbarNotice?.target === "appearance" ||
      guidedToolbarNotice?.target === "year" ||
      guidedToolbarNotice?.target === "habit-showcase" ||
      guidedToolbarNotice?.target === "habit" ||
      guidedToolbarNotice?.target === "habit-created")
      ? null
      : guidedToolbarNotice;

  // Continuação da jornada própria do mobile depois da Anual (ver
  // lib/mobile-habits-onboarding.ts): ano, tema, organizar e o atalho do ano
  // para hoje — cada um aponta pro controle real do cabeçalho, sem duplicar
  // nada de app-header.tsx (que outra frente edita agora). O card e o
  // destaque são só nossos, buscando o elemento por seletor, exatamente como
  // já fizemos com o "+" e o botão Anual da navegação.
  const mobileAnnualOnboardingNotice = React.useMemo<{
    notice: GuidedToolbarNotice;
    targetSelector: string;
    // A maioria dos alvos só existe uma vez visível no DOM — o seletor do
    // tema é a exceção (há uma instância desktop escondida também
    // presente), então precisa do modo `multiple` do GuidedTargetOutline
    // para não parar no primeiro match (que pode ser o escondido) e
    // simplesmente não desenhar nada.
    targetMultiple?: boolean;
  } | null>(() => {
    if (
      !isCalendarSurfaceActive ||
      isMobileCalendarUi !== true ||
      session?.user.id
    ) {
      return null;
    }
    if (mobileHabitsOnboardingStep === "annual_year") {
      return {
        // A mesma caixa já cobre as setas e o ano no meio — não precisa de
        // dois passos nem de dois alvos para as duas funções.
        targetSelector: "[data-onboarding-year-control]",
        notice: {
          target: "year",
          title: "Aqui você troca o ano.",
          instruction:
            "Use estas setas para consultar o ano anterior ou o próximo. Toque no ano a qualquer momento para voltar direto a hoje.",
          actionLabel: "Continuar",
          stepLabel: "Passo 1 de 4",
        },
      };
    }
    if (mobileHabitsOnboardingStep === "annual_theme") {
      return {
        targetSelector:
          'button[aria-label="Ativar tema escuro"], button[aria-label="Ativar tema claro"]',
        targetMultiple: true,
        notice: {
          target: "theme",
          title: "Escolha o clima do seu ano.",
          instruction:
            "Teste o tema claro e escuro e fique com o que combina mais com você.",
          actionLabel: "Continuar",
          stepLabel: "Passo 2 de 4",
        },
      };
    }
    if (mobileHabitsOnboardingStep === "annual_organize") {
      return {
        targetSelector: '[data-product-organize="mobile"]',
        notice: {
          target: "mobile-organize",
          title: "Organize contextos e categorias.",
          instruction: "Toque em Organizar para abrir o modo de edição.",
          actionLabel: "Continuar",
          stepLabel: "Passo 3 de 4",
        },
      };
    }
    if (mobileHabitsOnboardingStep === "goto_profile") {
      return {
        targetSelector: "[data-onboarding-auth-entry]",
        // Mesmo caso do tema: existe uma instância desktop escondida com o
        // mesmo atributo.
        targetMultiple: true,
        notice: {
          target: "profile",
          title: "Guarde esse ano com você.",
          instruction: "Toque em Perfil para criar sua conta e acessar de qualquer aparelho.",
          stepLabel: "Passo 4 de 4",
        },
      };
    }
    return null;
  }, [
    isCalendarSurfaceActive,
    isMobileCalendarUi,
    mobileHabitsOnboardingStep,
    session?.user.id,
  ]);

  const dismissMobileAnnualOnboarding = React.useCallback(() => {
    writeMobileHabitsOnboardingStep("dismissed");
    setMobileHabitsOnboardingStep("dismissed");
  }, []);

  const advanceMobileAnnualOnboarding = React.useCallback(() => {
    const sequence: MobileHabitsOnboardingStep[] = [
      "annual_year",
      "annual_theme",
      "annual_organize",
      "goto_profile",
    ];
    if (mobileHabitsOnboardingStep === "annual_year") {
      // O passo explica o atalho "toque no ano pra voltar a hoje" — "Continuar"
      // já demonstra na hora, em vez de só descrever.
      setScrollToTodayRequestKey((key) => key + 1);
    }
    const currentIndex = sequence.indexOf(
      mobileHabitsOnboardingStep as MobileHabitsOnboardingStep
    );
    const next = sequence[currentIndex + 1];
    if (!next) return;
    writeMobileHabitsOnboardingStep(next);
    setMobileHabitsOnboardingStep(next);
  }, [mobileHabitsOnboardingStep]);

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
            disabledDestination={
              mobileHabitsOnboardingNavLocked ? "annual" : undefined
            }
          />
          <AppUtilityPanel
            open={utilityPanelOpen}
            section={utilityPanelSection}
            isMobile={isMobileCalendarUi}
            authInitialMode={utilityPanelAuthMode}
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
          accountNudgeHighlightProfile={
            accountNudgeVisible && !session?.user.id
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
              : () => {
                  const todayYear = todayIso
                    ? Number(todayIso.slice(0, 4))
                    : year;
                  if (todayYear !== year) {
                    handleYearChange(todayYear);
                  } else {
                    requestDesktopTodayCenter();
                  }
                }
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
          onMobileOnboardingStepChange={setMobileHabitsOnboardingStep}
          hasEstablishedAccountData={isEstablishedAccount}
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
            if (next.step === "completed") {
              finalizeGuidedOnboarding(next);
              return;
            }
            if (next.step === "wrap_up_instruction") {
              // Tema já tinha sido confirmado antes — pula direto para o
              // resumo, cortando o ano de exemplo aqui mesmo.
              trimToRealCategories(next);
            }
            // O guia continua no Anual a partir daqui (tema, resumo, conta)
            // — é lá que vive a UI desses passos finais.
            setActiveDestination("annual");
            resetCalendarFocusOnYearChange();
            window.history.replaceState(
              window.history.state,
              "",
              buildProductDestinationUrl(window.location.href, "annual")
            );
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
          notice={
            showMobileDesktopFirstNotice ? (
              <MobileDesktopFirstNotice
                variant={
                  // "completed" só acontece por dois caminhos: uma conta já
                  // estabelecida (excluída de showMobileDesktopFirstNotice
                  // via isEstablishedAccount, então nunca chega aqui assim)
                  // ou quem acabou de terminar a jornada de Hábitos e tocou
                  // em Anual de propósito — é sempre essa segunda pessoa.
                  mobileHabitsOnboardingStep === "completed"
                    ? "onboarding"
                    : isInitialMobileOnboarding && !hasEstablishedSetup
                      ? "example"
                      : "resuming"
                }
                onOpenLogin={() => {
                  setAuthDialogInitialMode(
                    mobileHabitsOnboardingStep === "completed"
                      ? "signup"
                      : "login"
                  );
                  setAuthDialogAnchorPoint(undefined);
                  setAuthDialogOpen(true);
                }}
                onDismiss={() => {
                  writeDesktopFirstNoticeDismissed();
                  setDesktopFirstNoticeDismissed(true);
                }}
              />
            ) : null
          }
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

      {mobileAnnualOnboardingNotice ? (
        <>
          <GuidedTargetOutline
            selector={mobileAnnualOnboardingNotice.targetSelector}
            multiple={mobileAnnualOnboardingNotice.targetMultiple}
          />
          <GuidedToolbarNoticeCard
            notice={mobileAnnualOnboardingNotice.notice}
            onClose={dismissMobileAnnualOnboarding}
            onAction={advanceMobileAnnualOnboarding}
          />
        </>
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
      !isMobileExamplePreview ? (
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
