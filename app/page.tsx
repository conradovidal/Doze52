"use client";

import * as React from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { YearGrid } from "@/components/calendar/year-grid";
import { EventDialog } from "@/components/event-dialog";
import { AppHeader } from "@/components/app-header";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import { useStore, type EventInput } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { loadRemoteData, saveSnapshot, SyncError } from "@/lib/sync";
import { logDevError, logProdError } from "@/lib/safe-log";
import { hasSupabaseEnv } from "@/lib/supabase";

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
  const [draggingEventId, setDraggingEventId] = React.useState<string | null>(null);
  const [dragOriginStart, setDragOriginStart] = React.useState<string | null>(null);
  const [dragDurationDays, setDragDurationDays] = React.useState<number | null>(null);
  const [dragGrabOffsetDays, setDragGrabOffsetDays] = React.useState<number | null>(null);
  const [dragHoverPointerDate, setDragHoverPointerDate] = React.useState<string | null>(null);
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [remoteReady, setRemoteReady] = React.useState(false);
  const [syncBlocked, setSyncBlocked] = React.useState(false);
  const lastSyncedHashRef = React.useRef<string>("");
  const saveTimerRef = React.useRef<number | null>(null);

  const editingEvent = editingId ? getEventById(editingId) : null;

  React.useEffect(() => {
    ensureEventMetadata();
  }, [ensureEventMetadata]);

  React.useEffect(() => {
    if (hasSupabaseEnv) return;
    const message =
      "Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY neste ambiente.";
    logDevError("app.page.supabase-env", { message });
    logProdError("Supabase nao configurado neste ambiente.");
  }, []);

  React.useEffect(() => {
    if (!session?.user.id) {
      setRemoteReady(false);
      setSyncBlocked(false);
      setSyncError(null);
      lastSyncedHashRef.current = "";
      return;
    }
  }, [session?.user.id]);

  const bootstrapRemote = React.useCallback(() => {
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
        const message = error instanceof SyncError ? error.userMessage : "Falhou ao carregar dados.";
        logDevError("app.page.bootstrap-remote", { message });
        logProdError("Falha ao carregar dados remotos.");
        setSyncError(message);
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
  }, [replaceAllData, session?.user.id]);

  React.useEffect(() => {
    const cleanup = bootstrapRemote();
    return cleanup;
  }, [bootstrapRemote]);

  React.useEffect(() => {
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
        const message =
          error instanceof SyncError
            ? error.userMessage
            : "Falhou ao salvar. Tente novamente.";
        logDevError("app.page.save-snapshot", { message });
        logProdError("Falha ao salvar dados.");
        setSyncError(message);
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
  }, [categories, events, remoteReady, session?.user.id, syncBlocked, syncError]);

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

  const handleDragStartEvent = (
    eventId: string,
    startDateIso: string,
    endDateIso: string,
    grabOffsetDays: number
  ) => {
    setDraggingEventId(eventId);
    setDragOriginStart(startDateIso);
    setDragDurationDays(
      differenceInCalendarDays(parseISO(endDateIso), parseISO(startDateIso))
    );
    setDragGrabOffsetDays(grabOffsetDays);
    setDragHoverPointerDate(format(addDays(parseISO(startDateIso), grabOffsetDays), "yyyy-MM-dd"));
  };

  const handleDragEnterDate = (dateIso: string) => {
    if (!draggingEventId) return;
    setDragHoverPointerDate(dateIso);
  };

  const handleStartCreateRange = (startIso: string) => {
    if (draggingEventId) return;
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
    const onWindowMouseUp = () => {
      if (!creatingRange || draggingEventId) return;
      handleFinishCreateRange();
    };
    window.addEventListener("mouseup", onWindowMouseUp);
    return () => window.removeEventListener("mouseup", onWindowMouseUp);
  }, [creatingRange, draggingEventId, handleFinishCreateRange]);

  const clearDragState = () => {
    setDraggingEventId(null);
    setDragOriginStart(null);
    setDragDurationDays(null);
    setDragGrabOffsetDays(null);
    setDragHoverPointerDate(null);
    setCreatingRange(null);
  };

  const handleDropOnDate = (targetDateIso: string) => {
    if (!draggingEventId || !dragOriginStart) {
      clearDragState();
      return;
    }
    const offsetDays = dragGrabOffsetDays ?? 0;
    const projectedStart = addDays(parseISO(targetDateIso), -offsetDays);
    const deltaDays = differenceInCalendarDays(
      projectedStart,
      parseISO(dragOriginStart)
    );
    moveEventByDelta(draggingEventId, deltaDays);
    clearDragState();
  };

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
        onDragStartEvent={handleDragStartEvent}
        onDragEnterDate={handleDragEnterDate}
        onDropOnDate={handleDropOnDate}
        onDragEndEvent={clearDragState}
        draggingEventId={draggingEventId}
        dragHoverPointerDate={dragHoverPointerDate}
        dragGrabOffsetDays={dragGrabOffsetDays}
        dragDurationDays={dragDurationDays}
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
