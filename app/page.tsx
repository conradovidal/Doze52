"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { MobileCalendarExperience } from "@/components/calendar/mobile-calendar-experience";
import { YearGrid } from "@/components/calendar/year-grid";
import { EventDialog } from "@/components/event-dialog";
import { AppHeader } from "@/components/app-header";
import {
  SyncStatusOverlay,
  type SyncOverlayStatus,
} from "@/components/sync-status-overlay";
import { AuthDialog } from "@/components/auth/auth-dialog";
import {
  GuidedOnboardingPanel,
  type GuidedCalendarDraft,
} from "@/components/onboarding/guided-onboarding-panel";
import { AccountNudge } from "@/components/onboarding/account-nudge";
import { OnboardingConnector } from "@/components/onboarding/onboarding-connector";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback-provider";
import {
  isOnboardingProfilesSnapshot,
  isOnboardingCategoriesSnapshot,
  getOnboardingCategoryIdForIntent,
  useStore,
  type EventInput,
} from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { calendarPacks } from "@/lib/calendar-packs";
import { reconcileInstalledCalendarPacks } from "@/lib/calendar-packs/import";
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
  hasAuthorCalendarEvents,
  readGuidedOnboardingState,
  readProductOnboardingState,
  shouldShowGuidedOnboarding,
  type GuidedOnboardingAction,
  type GuidedOnboardingState,
  type OnboardingFocusTarget,
  type OnboardingContext,
  type ProductOnboardingState,
} from "@/lib/onboarding";
import { logDevError, logProdError } from "@/lib/safe-log";
import { getSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase";
import { expandEventsForYear } from "@/lib/recurrence";
import {
  ensureSnapshotCoverage,
  materializeUserOwnedSnapshot,
} from "@/lib/snapshot-ownership";
import { cn } from "@/lib/utils";
import type { AnchorPoint } from "@/lib/types";

const toSnapshotHash = (snapshot: CalendarSnapshot) => JSON.stringify(snapshot);

const SYNC_HINT_BY_KIND: Record<SyncError["kind"], string> = {
  missing_relation:
    "Schema pendente no Supabase (rode as migrations de perfis/icones).",
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

const isDetailedSyncDiagnosticsEnabled =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_APP_ENV === "local" ||
  process.env.NEXT_PUBLIC_APP_ENV === "dev";

const MOBILE_CALENDAR_UI_MAX_WIDTH_PX = 767;

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

const filterAnonymousDraft = (snapshot: CalendarSnapshot): CalendarSnapshot => ({
  profiles: snapshot.profiles.filter((profile) => !profile.userId),
  categories: snapshot.categories.filter((category) => !category.userId),
  events: snapshot.events.filter((event) => !event.userId),
});

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
  const { notify } = useFeedback();

  const initialYear = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    return currentYear >= 2025 && currentYear <= 2027 ? currentYear : 2026;
  }, []);

  const [year, setYear] = React.useState<number>(initialYear);

  const profiles = useStore((s) => s.profiles);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const events = useStore((s) => s.events);
  const categories = useStore((s) => s.categories);
  const ensureEventMetadata = useStore((s) => s.ensureEventMetadata);
  const replaceAllData = useStore((s) => s.replaceAllData);
  const resetToOnboardingData = useStore((s) => s.resetToOnboardingData);
  const configureOnboardingContext = useStore(
    (s) => s.configureOnboardingContext
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
  const [guidedPanelHidden, setGuidedPanelHidden] = React.useState(false);
  const [accountNudgeVisible, setAccountNudgeVisible] = React.useState(false);
  const [guidedDraft, setGuidedDraft] =
    React.useState<GuidedCalendarDraft | null>(null);
  const [guidedDialogIntent, setGuidedDialogIntent] = React.useState<
    "date" | "period" | null
  >(null);
  const [mobileGuidedRangeStart, setMobileGuidedRangeStart] = React.useState<
    string | null
  >(null);
  const [highlightedEventId, setHighlightedEventId] = React.useState<
    string | null
  >(null);
  const [isMobileCalendarUi, setIsMobileCalendarUi] = React.useState<
    boolean | null
  >(null);
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
      setGuidedPanelHidden(false);
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
        const localSnapshot = filterAnonymousDraft(
          ensureSnapshotCoverage({
            profiles: profilesRef.current,
            categories: categoriesRef.current,
            events: eventsRef.current,
          })
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
    setGuidedDialogIntent(null);
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

  const handleConfigureGuidedContext = React.useCallback(
    (context: OnboardingContext, customName?: string) => {
      if (context === "custom" && customName === undefined) {
        updateGuidedOnboarding({ type: "choose_context", context });
        return;
      }
      const configured = configureOnboardingContext({ context, customName });
      if (!configured) {
        notify({
          tone: "error",
          title: "Não foi possível configurar este perfil",
          description: "Confira o nome ou continue usando o calendário atual.",
        });
        return;
      }
      updateGuidedOnboarding({ type: "configure_profile", context });
      setGuidedDraft(null);
      setMobileGuidedRangeStart(null);
    },
    [configureOnboardingContext, notify, updateGuidedOnboarding]
  );

  const completeGuidedOnboarding = React.useCallback(() => {
    const current = readGuidedOnboardingState();
    if (current.step === "completed") return;
    updateGuidedOnboarding({ type: "complete" });
    setGuidedPanelHidden(true);
    if (!session?.user.id) setAccountNudgeVisible(true);
    notify({
      tone: "success",
      title: "Teu ano já começou a ganhar forma",
      description: "Volte quando algo mudar.",
      durationMs: 3200,
    });
  }, [notify, session?.user.id, updateGuidedOnboarding]);

  const dismissGuidedOnboarding = React.useCallback(() => {
    updateGuidedOnboarding({ type: "dismiss" });
    setGuidedPanelHidden(true);
  }, [updateGuidedOnboarding]);

  const handleSubmit = async (payload: EventInput) => {
    if (editingId) {
      updateEvent(editingId, payload);

      notify({
        tone: "success",
        title: "Evento atualizado",
        description: "As alterações já foram aplicadas ao calendário.",
      });

      return;
    }

    const eventId = addEvent(payload);
    if (!eventId) {
      throw new Error("Não foi possível adicionar este evento à categoria escolhida.");
    }

    setHighlightedEventId(eventId);

    if (guidedDialogIntent) {
      updateGuidedOnboarding({
        type: guidedDialogIntent === "period" ? "period_saved" : "date_saved",
      });
      setGuidedDialogIntent(null);
      setGuidedDraft(null);
      setGuidedPanelHidden(false);
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
    setGuidedDialogIntent(null);
    setSeedRange({
      startDate: fallbackTodayIso,
      endDate: fallbackTodayIso,
    });
    setDialogOpen(true);
  }, [todayIso]);

  const handleDeleteEvent = React.useCallback(() => {
    if (!editingId) return;

    deleteEvent(editingId);

    notify({
      tone: "success",
      title: "Evento excluído",
      description: "O calendário foi atualizado.",
    });

    setDialogAnchorPoint(undefined);
    setDialogOpen(false);
  }, [deleteEvent, editingId, notify]);

  const handleStartCreateRange = (startIso: string) => {
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
        if (currentStep === "date_instruction") {
          setGuidedDraft({
            startDate: nextDraft.startDate,
            endDate: nextDraft.startDate,
          });
          updateGuidedOnboarding({ type: "select_date" });
          return null;
        }
        if (currentStep === "period_instruction") {
          if (nextDraft.startDate === nextDraft.endDate) {
            notify({
              tone: "info",
              title: "Desenhe um período",
              description: "Arraste até outro dia para mostrar quanto tempo isso ocupa.",
            });
            return null;
          }
          setGuidedDraft(nextDraft);
          updateGuidedOnboarding({ type: "select_period" });
          return null;
        }

        setSeedRange(nextDraft);

        setEditingId(null);
        setDialogAnchorPoint(anchorPoint);
        setGuidedDialogIntent(null);
        setDialogOpen(true);

        return null;
      });
    },
    [guidedOnboarding?.step, notify, updateGuidedOnboarding]
  );

  const cancelGuidedDraft = React.useCallback(() => {
    const step = guidedOnboarding?.step;
    if (step === "date_details") {
      updateGuidedOnboarding({ type: "cancel_date" });
    } else if (step === "period_details") {
      updateGuidedOnboarding({ type: "cancel_period" });
    }
    setGuidedDraft(null);
    setMobileGuidedRangeStart(null);
  }, [guidedOnboarding?.step, updateGuidedOnboarding]);

  const saveGuidedDraft = React.useCallback(
    (title: string) => {
      if (!guidedDraft || !guidedOnboarding?.context || !title.trim()) return;
      const intent =
        guidedOnboarding.step === "period_details" ? "period" : "date";
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
        categoryId: getOnboardingCategoryIdForIntent(
          guidedOnboarding.context,
          intent
        ),
        startDate: guidedDraft.startDate,
        endDate: guidedDraft.endDate,
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

  const openGuidedMoreOptions = React.useCallback(() => {
    if (!guidedDraft) return;
    const intent =
      guidedOnboarding?.step === "period_details" ? "period" : "date";
    setSeedRange(guidedDraft);
    setGuidedDialogIntent(intent);
    setEditingId(null);
    setDialogAnchorPoint(undefined);
    setDialogOpen(true);
  }, [guidedDraft, guidedOnboarding?.step]);

  const handleMobileGuidedDaySelect = React.useCallback(
    (dateIso: string) => {
      const step = guidedOnboarding?.step;
      if (step === "date_instruction") {
        setGuidedDraft({ startDate: dateIso, endDate: dateIso });
        updateGuidedOnboarding({ type: "select_date" });
        return;
      }
      if (step !== "period_instruction") return;
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
      updateGuidedOnboarding({ type: "select_period" });
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

  const hasAuthorEvents = hasAuthorCalendarEvents(events);
  const showGuidedOnboarding = Boolean(
    guidedOnboarding &&
      calendarCreateOnboarding &&
      isMobileCalendarUi !== null &&
      !guidedPanelHidden &&
      shouldShowGuidedOnboarding({
        state: guidedOnboarding,
        legacyState: calendarCreateOnboarding,
        hasAuthorEvents,
        authLoading,
        isAuthenticated: Boolean(session?.user.id),
        remoteReady,
      })
  );
  const onboardingFocusTarget = React.useMemo<OnboardingFocusTarget>(() => {
    if (!showGuidedOnboarding || !guidedOnboarding) return null;
    if (guidedOnboarding.step === "profile_reveal") {
      const profileId = selectedProfileIds[0] ?? profiles[0]?.id;
      return profileId ? { kind: "profile", id: profileId } : null;
    }
    if (!guidedOnboarding.context) return null;
    if (
      guidedOnboarding.step === "date_instruction" ||
      guidedOnboarding.step === "date_details"
    ) {
      return {
        kind: "category",
        id: getOnboardingCategoryIdForIntent(guidedOnboarding.context, "date"),
      };
    }
    if (
      guidedOnboarding.step === "period_instruction" ||
      guidedOnboarding.step === "period_details"
    ) {
      return {
        kind: "category",
        id: getOnboardingCategoryIdForIntent(guidedOnboarding.context, "period"),
      };
    }
    return null;
  }, [guidedOnboarding, profiles, selectedProfileIds, showGuidedOnboarding]);
  const onboardingTargetSelector = React.useMemo(() => {
    if (!onboardingFocusTarget) return null;
    if (onboardingFocusTarget.kind === "profile") {
      return `[data-onboarding-profile-id="${onboardingFocusTarget.id}"]`;
    }
    if (onboardingFocusTarget.kind === "category") {
      return `[data-onboarding-category-id="${onboardingFocusTarget.id}"]`;
    }
    return "[data-onboarding-auth-entry]";
  }, [onboardingFocusTarget]);
  const headerOnboardingFocusTarget = React.useMemo<OnboardingFocusTarget>(
    () =>
      accountNudgeVisible && !session?.user.id
        ? { kind: "auth" }
        : onboardingFocusTarget,
    [accountNudgeVisible, onboardingFocusTarget, session?.user.id]
  );

  const handleYearChange = React.useCallback(
    (nextYear: number) => {
      setYear(nextYear);
      resetCalendarFocusOnYearChange();
    },
    [resetCalendarFocusOnYearChange]
  );

  React.useEffect(() => {
    setMobileActiveDateIso((currentIso) => {
      if (Number(currentIso.slice(0, 4)) === year) return currentIso;
      if (todayIso && Number(todayIso.slice(0, 4)) === year) return todayIso;
      return `${year}-01-01`;
    });
  }, [todayIso, year]);

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
          ? "flex h-[100dvh] min-h-0 flex-col overflow-hidden px-3 pt-2 pb-1"
          : "min-h-full px-4 pt-3 pb-2 md:pb-4"
      )}
    >
      <SyncStatusOverlay
        status={syncOverlayStatus}
        visible={isSyncOverlayVisible}
        errorPopoverOpen={isSyncOverlayErrorOpen}
        onErrorPopoverOpenChange={handleSyncOverlayErrorOpenChange}
      />

      <div
        className={cn(
          "z-30 bg-background",
          isMobileCalendarUi
            ? "shrink-0 pb-2"
            : "sticky top-0 -mx-4 px-4 pb-2 backdrop-blur supports-[backdrop-filter]:bg-background/82 md:static md:mx-0 md:bg-transparent md:px-0 md:pb-0 md:backdrop-blur-none"
        )}
      >
        <AppHeader
          year={year}
          onYearChange={handleYearChange}
          authLoading={authLoading}
          isAuthenticated={Boolean(session)}
          isMobileCalendarUi={isMobileCalendarUi === true}
          onCalendarPackFocusYear={handleYearChange}
          onboardingFocusTarget={headerOnboardingFocusTarget}
          onOpenAuthDialog={(anchorPoint) => {
            setAuthDialogInitialMode("login");
            setAuthDialogAnchorPoint(anchorPoint);
            setAuthDialogOpen(true);
          }}
        />
      </div>

      {isMobileCalendarUi === true ? (
        <MobileCalendarExperience
          year={year}
          todayIso={todayIso}
          events={renderEvents}
          activeDateIso={mobileActiveDateIso}
          onActiveDateChange={setMobileActiveDateIso}
          onYearChange={handleYearChange}
          onEditEvent={handleEditEvent}
          guidedSelectionMode={
            guidedOnboarding?.step === "date_instruction"
              ? "date"
              : guidedOnboarding?.step === "period_instruction"
                ? "period"
                : null
          }
          guidedRangeStart={mobileGuidedRangeStart}
          onGuidedDaySelect={handleMobileGuidedDaySelect}
        />
      ) : (
        <div className="overflow-x-auto pb-1 md:overflow-visible">
          <div
            data-calendar-focus-root
            data-calendar-ui-mode="desktop"
            className={cn(
              "relative rounded-xl doze52-calendar-mode-transition",
              guidedOnboarding?.step === "date_instruction" ||
                guidedOnboarding?.step === "period_instruction"
                ? "ring-2 ring-primary/35 ring-offset-4 ring-offset-background shadow-[0_22px_70px_-42px_rgba(37,99,235,0.72)]"
                : null
            )}
          >
            <YearGrid
              year={year}
              todayIso={todayIso}
              events={renderEvents}
              onEditEvent={handleEditEvent}
              creatingRange={creatingRange}
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
            />
          </div>
        </div>
      )}

      {showGuidedOnboarding && guidedOnboarding ? (
        <GuidedOnboardingPanel
          state={guidedOnboarding}
          draft={guidedDraft}
          isMobile={isMobileCalendarUi === true}
          mobileRangeStart={mobileGuidedRangeStart}
          onClose={() => setGuidedPanelHidden(true)}
          onDismiss={dismissGuidedOnboarding}
          onConfigureContext={handleConfigureGuidedContext}
          onContinueFromProfile={() =>
            updateGuidedOnboarding({ type: "continue_from_profile" })
          }
          onCancelDraft={cancelGuidedDraft}
          onChangeDraft={setGuidedDraft}
          onSaveDraft={saveGuidedDraft}
          onOpenMoreOptions={openGuidedMoreOptions}
          onContinueToPeriods={() =>
            updateGuidedOnboarding({ type: "continue_to_periods" })
          }
          onContinueToPreview={() =>
            updateGuidedOnboarding({ type: "continue_to_preview" })
          }
          onComplete={completeGuidedOnboarding}
        />
      ) : null}

      {showGuidedOnboarding && onboardingTargetSelector ? (
        <OnboardingConnector
          sourceSelector="[data-onboarding-panel]"
          targetSelector={onboardingTargetSelector}
        />
      ) : null}

      {accountNudgeVisible && !session?.user.id ? (
        <>
          <AccountNudge
            onDismiss={() => setAccountNudgeVisible(false)}
            onCreateAccount={() => {
              setAccountNudgeVisible(false);
              setAuthDialogInitialMode("signup");
              setAuthDialogAnchorPoint(undefined);
              setAuthDialogOpen(true);
            }}
          />
          <OnboardingConnector
            sourceSelector="[data-onboarding-account-nudge]"
            targetSelector="[data-onboarding-auth-entry]"
          />
        </>
      ) : null}

      {isMobileCalendarUi ? (
        <div
          className="fixed right-4 z-40"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 2.75rem)" }}
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
            if (!open) setGuidedDialogIntent(null);
          }
        }}
        initialEvent={editingEvent}
        seedRange={seedRange}
        anchorPoint={dialogAnchorPoint}
        guidedIntent={
          guidedDialogIntent === "period"
            ? "period"
            : guidedDialogIntent === "date"
              ? "dated_item"
              : null
        }
        onSubmit={handleSubmit}
        onDelete={
          editingId && !editingEvent?.calendarPackGroupId
            ? handleDeleteEvent
            : undefined
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
    </main>
  );
}
