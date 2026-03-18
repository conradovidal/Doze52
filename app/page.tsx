"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { YearGrid } from "@/components/calendar/year-grid";
import { EventDialog } from "@/components/event-dialog";
import { AppHeader } from "@/components/app-header";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback-provider";
import {
  getOnboardingDefaultProfiles,
  getOnboardingDefaultCategories,
  isOnboardingProfilesSnapshot,
  isOnboardingCategoriesSnapshot,
  ONBOARDING_DEFAULT_CATEGORY_ID,
  ONBOARDING_DEFAULT_PROFILE_ID,
  useStore,
  type EventInput,
} from "@/lib/store";
import { useAuth } from "@/lib/auth";
import {
  loadRemoteData,
  saveSnapshot,
  SyncError,
  type CalendarSnapshot,
} from "@/lib/sync";
import { getTodayIsoInTimeZone } from "@/lib/date";
import { logDevError, logProdError } from "@/lib/safe-log";
import { getSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase";
import { expandEventsForYear } from "@/lib/recurrence";
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

const PENDING_SYNC_STORAGE_PREFIX = "pending-sync:";
const isDetailedSyncDiagnosticsEnabled =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_APP_ENV === "local" ||
  process.env.NEXT_PUBLIC_APP_ENV === "dev";

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

const ensureSnapshotCoverage = (
  snapshot: CalendarSnapshot
): CalendarSnapshot => {
  const profiles =
    snapshot.profiles.length > 0
      ? snapshot.profiles
      : getOnboardingDefaultProfiles();
  const profileIds = new Set(profiles.map((profile) => profile.id));
  const fallbackProfileId = profileIds.has(ONBOARDING_DEFAULT_PROFILE_ID)
    ? ONBOARDING_DEFAULT_PROFILE_ID
    : (profiles[0]?.id ?? ONBOARDING_DEFAULT_PROFILE_ID);

  const categories =
    snapshot.categories.length > 0
      ? snapshot.categories
      : getOnboardingDefaultCategories();
  const normalizedCategories = categories.map((category) => ({
    ...category,
    profileId: profileIds.has(category.profileId)
      ? category.profileId
      : fallbackProfileId,
  }));

  const categoryIds = new Set(normalizedCategories.map((category) => category.id));
  const fallbackCategoryId = categoryIds.has(ONBOARDING_DEFAULT_CATEGORY_ID)
    ? ONBOARDING_DEFAULT_CATEGORY_ID
    : (normalizedCategories[0]?.id ?? ONBOARDING_DEFAULT_CATEGORY_ID);
  const colorByCategoryId = new Map(
    normalizedCategories.map((category) => [category.id, category.color])
  );

  const events = snapshot.events.map((event) => {
    const categoryId = categoryIds.has(event.categoryId)
      ? event.categoryId
      : fallbackCategoryId;
    const color = colorByCategoryId.get(categoryId) ?? event.color;
    if (categoryId === event.categoryId && color === event.color) {
      return event;
    }
    return { ...event, categoryId, color };
  });

  return { profiles, categories: normalizedCategories, events };
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
  const events = useStore((s) => s.events);
  const categories = useStore((s) => s.categories);
  const ensureEventMetadata = useStore((s) => s.ensureEventMetadata);
  const replaceAllData = useStore((s) => s.replaceAllData);
  const resetToOnboardingData = useStore((s) => s.resetToOnboardingData);
  const markLocalImported = useStore((s) => s.markLocalImported);
  const isLocalImported = useStore((s) => s.isLocalImported);
  const addEvent = useStore((s) => s.addEvent);
  const updateEvent = useStore((s) => s.updateEvent);
  const deleteEvent = useStore((s) => s.deleteEvent);
  const moveEventByDelta = useStore((s) => s.moveEventByDelta);
  const normalizeDayOrder = useStore((s) => s.normalizeDayOrder);
  const getEventById = useStore((s) => s.getEventById);
  const { session, loading: authLoading } = useAuth();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [authDialogOpen, setAuthDialogOpen] = React.useState(false);
  const [dialogAnchorPoint, setDialogAnchorPoint] = React.useState<AnchorPoint | undefined>(
    undefined
  );
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
  const [, setIsSyncing] = React.useState(false);
  const [remoteReady, setRemoteReady] = React.useState(false);
  const [syncBlocked, setSyncBlocked] = React.useState(false);
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
  const previousSessionUserIdRef = React.useRef<string | null>(null);
  const hadSyncIssueRef = React.useRef(false);
  const lastSyncIssueKeyRef = React.useRef<string | null>(null);
  const profilesRef = React.useRef(profiles);
  const categoriesRef = React.useRef(categories);
  const eventsRef = React.useRef(events);

  React.useEffect(() => {
    profilesRef.current = profiles;
    categoriesRef.current = categories;
    eventsRef.current = events;
  }, [profiles, categories, events]);

  const editingEvent = editingId ? getEventById(editingId) : null;
  const renderEvents = React.useMemo(() => expandEventsForYear(events, year), [events, year]);
  const showSyncNotice = React.useCallback(
    (tone: "success" | "info", message: string, durationMs = 1800) => {
      notify({
        tone,
        title: message,
        durationMs,
      });
    },
    [notify]
  );

  React.useEffect(() => {
    if (windowContext !== "main") return;

    if (syncError) {
      const errorKey = `${syncError.kind}:${syncError.code ?? ""}:${syncError.message}`;
      if (lastSyncIssueKeyRef.current !== errorKey) {
        notify({
          tone: "error",
          title: "Sincronização pausada",
          description: SYNC_HINT_BY_KIND[syncError.kind] ?? syncError.message,
          durationMs: 3800,
        });
        lastSyncIssueKeyRef.current = errorKey;
      }
      hadSyncIssueRef.current = true;
      return;
    }

    lastSyncIssueKeyRef.current = null;
    if (hadSyncIssueRef.current && remoteReady) {
      notify({
        tone: "success",
        title: "Sincronização restabelecida",
        description: "Seus dados voltaram a ser salvos normalmente.",
        durationMs: 2200,
      });
      hadSyncIssueRef.current = false;
    }
  }, [notify, remoteReady, syncError, windowContext]);

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
      setRemoteReady(false);
      setSyncBlocked(false);
      setSyncError(null);
      lastSyncedHashRef.current = "";
      previousSessionUserIdRef.current = null;
      hadSyncIssueRef.current = false;
      lastSyncIssueKeyRef.current = null;
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

  const bootstrapRemote = React.useCallback(() => {
    if (windowContext !== "main") return () => {};
    const userId = session?.user.id;
    if (!userId) return () => {};
    let cancelled = false;
    const run = async () => {
      setIsSyncing(true);
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
        const localDraftIsRelevant = hasRelevantLocalDraft(localSnapshot);
        const remoteSnapshot = await loadRemoteData();
        if (cancelled) return;
        const remoteIsEmpty =
          remoteSnapshot.profiles.length === 0 &&
          remoteSnapshot.categories.length === 0 &&
          remoteSnapshot.events.length === 0;
        const alreadyImported = isLocalImported(userId);
        const remoteHash = toSnapshotHash(remoteSnapshot);
        let nextSnapshot: CalendarSnapshot = remoteSnapshot;
        let shouldForceSave = false;

        if (pendingSnapshot) {
          nextSnapshot = pendingSnapshot;
          shouldForceSave = true;
        } else if (localDraftIsRelevant) {
          nextSnapshot = mergeSnapshots(remoteSnapshot, localSnapshot);
        } else if (remoteIsEmpty && !alreadyImported) {
          nextSnapshot = ensureSnapshotCoverage(remoteSnapshot);
        }

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
        if (!cancelled) setIsSyncing(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    isLocalImported,
    markLocalImported,
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
    if (nextHash === lastSyncedHashRef.current) return;

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(async () => {
      setIsSyncing(true);
      setSyncError(null);
      try {
        await saveSnapshot(nextSnapshot);
        clearPendingSyncSnapshot(session.user.id);
        lastSyncedHashRef.current = nextHash;
        showSyncNotice("success", "Alteracoes salvas");
      } catch (error) {
        const syncError =
          error instanceof SyncError
            ? error
            : new SyncError("unknown", "Falhou ao salvar. Tente novamente.", false);
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
      }
    };
  }, [
    categories,
    events,
    profiles,
    remoteReady,
    session?.user.id,
    showSyncNotice,
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
    setDialogOpen(true);
  };

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
    addEvent(payload);
    notify({
      tone: "success",
      title: "Evento criado",
      description: "O novo evento já aparece no calendário.",
    });
  };

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

  const handleFinishCreateRange = React.useCallback((endIso?: string, anchorPoint?: AnchorPoint) => {
    setCreatingRange((prev) => {
      if (!prev) return prev;
      const resolvedEnd = endIso ?? prev.hoverIso;
      const start = parseISO(prev.startIso);
      const end = parseISO(resolvedEnd);
      const normalizedStart = start <= end ? start : end;
      const normalizedEnd = start <= end ? end : start;
      setSeedRange({
        startDate: format(normalizedStart, "yyyy-MM-dd"),
        endDate: format(normalizedEnd, "yyyy-MM-dd"),
      });
      setEditingId(null);
      setDialogAnchorPoint(anchorPoint);
      setDialogOpen(true);
      return null;
    });
  }, []);

  React.useEffect(() => {
    if (windowContext !== "main") return;
    const onWindowMouseUp = (event: MouseEvent) => {
      if (!creatingRange) return;
      handleFinishCreateRange(undefined, { x: event.clientX, y: event.clientY });
    };
    window.addEventListener("mouseup", onWindowMouseUp);
    return () => window.removeEventListener("mouseup", onWindowMouseUp);
  }, [creatingRange, handleFinishCreateRange, windowContext]);

  const syncDebugDetail =
    syncError && isDetailedSyncDiagnosticsEnabled
      ? formatSyncDebugDetail(syncError)
      : null;

  if (windowContext === "popup") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">{popupStatusMessage}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-none overflow-x-hidden px-4 pt-3 pb-2 md:pb-4">
      <div className="sticky top-0 z-30 -mx-4 px-4 pb-2 bg-background/92 backdrop-blur supports-[backdrop-filter]:bg-background/82 md:static md:mx-0 md:px-0 md:pb-0 md:bg-transparent md:backdrop-blur-none">
        <AppHeader
          year={year}
          onYearChange={setYear}
          authLoading={authLoading}
          isAuthenticated={Boolean(session)}
          onOpenAuthDialog={(anchorPoint) => {
            setAuthDialogAnchorPoint(anchorPoint);
            setAuthDialogOpen(true);
          }}
        />
      </div>
      {!hasSupabaseEnv ? (
        <p className="mb-3 text-center text-sm text-amber-700">
          Supabase nao configurado neste ambiente.
        </p>
      ) : null}

      <div className="overflow-x-auto md:overflow-visible">
        <div
          data-calendar-focus-root
          className="w-[190%] min-[420px]:w-[175%] md:w-full"
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
          />
        </div>
      </div>
      {syncError ? (
        <div className="mt-3 flex justify-center">
          <div className="flex max-w-xl flex-col gap-3 rounded-2xl border border-red-200/80 bg-red-50/88 px-4 py-3.5 text-left shadow-sm dark:border-red-500/25 dark:bg-red-500/10">
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-700 dark:text-red-200">
                {syncError.message}
              </p>
              <p className="text-xs text-red-700/80 dark:text-red-200/80">
                {SYNC_HINT_BY_KIND[syncError.kind] ?? SYNC_HINT_BY_KIND.unknown}
              </p>
              {syncDebugDetail ? (
                <p className="text-[10px] text-red-700/65 dark:text-red-200/65">
                  {syncDebugDetail}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setSyncBlocked(false);
                void bootstrapRemote();
              }}
            >
              Recarregar
            </Button>
          </div>
        </div>
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
        onSubmit={handleSubmit}
        onDelete={
          editingId ? handleDeleteEvent : undefined
        }
      />
      <AuthDialog
        open={authDialogOpen}
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
