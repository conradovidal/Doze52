"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { YearGrid } from "@/components/calendar/year-grid";
import { EventDialog } from "@/components/event-dialog";
import { AppHeader } from "@/components/app-header";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import { useStore, type EventInput } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { loadRemoteData, saveSnapshot, SyncError } from "@/lib/sync";
import { logDevError, logProdError } from "@/lib/safe-log";
import { getSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase";

export default function HomePage() {
  const initialYear = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    return currentYear >= 2025 && currentYear <= 2027 ? currentYear : 2026;
  }, []);
  const [year, setYear] = React.useState<number>(initialYear);
  const events = useStore((s) => s.events);
  const categories = useStore((s) => s.categories);
  const ensureEventMetadata = useStore((s) => s.ensureEventMetadata);
  const replaceAllData = useStore((s) => s.replaceAllData);
  const addEvent = useStore((s) => s.addEvent);
  const updateEvent = useStore((s) => s.updateEvent);
  const deleteEvent = useStore((s) => s.deleteEvent);
  const moveEventByDelta = useStore((s) => s.moveEventByDelta);
  const reorderEventInDay = useStore((s) => s.reorderEventInDay);
  const normalizeDayOrder = useStore((s) => s.normalizeDayOrder);
  const getEventById = useStore((s) => s.getEventById);
  const { session, loading: authLoading } = useAuth();
  const isDevBuildInfoVisible = process.env.NODE_ENV !== "production";
  const commitSha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "local";
  const buildLabel = commitSha === "local" ? "local" : commitSha.slice(0, 7);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [authDialogOpen, setAuthDialogOpen] = React.useState(false);
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
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
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
  const lastSyncedHashRef = React.useRef<string>("");
  const saveTimerRef = React.useRef<number | null>(null);

  const editingEvent = editingId ? getEventById(editingId) : null;

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
    if (hasSupabaseEnv) return;
    const message =
      "Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY neste ambiente.";
    logDevError("app.page.supabase-env", { message });
    logProdError("Supabase nao configurado neste ambiente.");
  }, [windowContext]);

  React.useEffect(() => {
    if (windowContext !== "main") return;
    if (!session?.user.id) {
      setRemoteReady(false);
      setSyncBlocked(false);
      setSyncError(null);
      lastSyncedHashRef.current = "";
      return;
    }
  }, [session?.user.id, windowContext]);

  const bootstrapRemote = React.useCallback(() => {
    if (windowContext !== "main") return () => {};
    if (!session?.user.id) return () => {};
    let cancelled = false;
    const run = async () => {
      setIsSyncing(true);
      setSyncError(null);
      try {
        const snapshot = await loadRemoteData();
        if (cancelled) return;
        replaceAllData(snapshot);
        lastSyncedHashRef.current = JSON.stringify(snapshot);
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
        });
        logProdError("Falha ao carregar dados remotos.");
        setSyncError(syncError.userMessage);
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
  }, [replaceAllData, session?.user.id, windowContext]);

  React.useEffect(() => {
    const cleanup = bootstrapRemote();
    return cleanup;
  }, [bootstrapRemote]);

  React.useEffect(() => {
    if (windowContext !== "main") return;
    if (!session?.user.id || !remoteReady || syncBlocked || syncError) return;
    const nextSnapshot = { categories, events };
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
        lastSyncedHashRef.current = nextHash;
      } catch (error) {
        const syncError =
          error instanceof SyncError
            ? error
            : new SyncError("unknown", "Falhou ao salvar. Tente novamente.", false);
        logDevError("app.page.save-snapshot", {
          kind: syncError.kind,
          message: syncError.userMessage,
        });
        logProdError("Falha ao salvar dados.");
        setSyncError(syncError.userMessage);
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
    remoteReady,
    session?.user.id,
    syncBlocked,
    syncError,
    windowContext,
  ]);

  const handleEditEvent = (id: string) => {
    setEditingId(id);
    setSeedRange(null);
    setCreatingRange(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (payload: EventInput) => {
    if (editingId) updateEvent(editingId, payload);
    else addEvent(payload);
  };

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

  const handleFinishCreateRange = React.useCallback((endIso?: string) => {
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
      setDialogOpen(true);
      return null;
    });
  }, []);

  React.useEffect(() => {
    if (windowContext !== "main") return;
    const onWindowMouseUp = () => {
      if (!creatingRange) return;
      handleFinishCreateRange();
    };
    window.addEventListener("mouseup", onWindowMouseUp);
    return () => window.removeEventListener("mouseup", onWindowMouseUp);
  }, [creatingRange, handleFinishCreateRange, windowContext]);

  if (windowContext === "popup") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-neutral-600">{popupStatusMessage}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-none px-4 py-8">
      <AppHeader
        year={year}
        onYearChange={setYear}
        authLoading={authLoading}
        isAuthenticated={Boolean(session)}
        onOpenAuthDialog={() => setAuthDialogOpen(true)}
      />
      {!hasSupabaseEnv ? (
        <p className="mb-3 text-center text-sm text-amber-700">
          Supabase nao configurado neste ambiente.
        </p>
      ) : null}

      <YearGrid
        year={year}
        events={events}
        onEditEvent={handleEditEvent}
        creatingRange={creatingRange}
        onStartCreateRange={handleStartCreateRange}
        onHoverCreateRange={handleHoverCreateRange}
        onFinishCreateRange={handleFinishCreateRange}
        onMoveEventByDelta={moveEventByDelta}
        onApplyDayReorder={({ dayIso, eventId, toIndex, orderedIds }) => {
          reorderEventInDay({ eventId, dayIso, toIndex });
          normalizeDayOrder(dayIso, orderedIds);
        }}
      />
      {syncError ? (
        <div className="mt-2 flex flex-col items-center gap-2">
          <p className="text-center text-xs text-red-600">{syncError}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setSyncBlocked(false);
              void bootstrapRemote();
            }}
          >
            Recarregar
          </Button>
        </div>
      ) : null}
      {isSyncing && session ? (
        <p className="mt-1 text-center text-xs text-neutral-500">salvando...</p>
      ) : null}

      <EventDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSeedRange(null);
            setCreatingRange(null);
          }
        }}
        initialEvent={editingEvent}
        seedRange={seedRange}
        onSubmit={handleSubmit}
        onDelete={
          editingId
            ? () => {
                deleteEvent(editingId);
                setDialogOpen(false);
              }
            : undefined
        }
      />
      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
      {isDevBuildInfoVisible ? (
        <footer className="mt-4 text-center text-[11px] text-neutral-400">
          build: {buildLabel}
        </footer>
      ) : null}
    </main>
  );
}
