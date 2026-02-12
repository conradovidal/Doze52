"use client";

import * as React from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { YearGrid } from "@/components/calendar/year-grid";
import { EventDialog } from "@/components/event-dialog";
import { CategoryBar } from "@/components/category-bar";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { UserMenu } from "@/components/auth/user-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useStore, type EventInput } from "@/lib/store";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const initialYear = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    return currentYear >= 2025 && currentYear <= 2027 ? currentYear : 2026;
  }, []);
  const [year, setYear] = React.useState<number>(initialYear);
  const events = useStore((s) => s.events);
  const ensureEventMetadata = useStore((s) => s.ensureEventMetadata);
  const addEvent = useStore((s) => s.addEvent);
  const updateEvent = useStore((s) => s.updateEvent);
  const deleteEvent = useStore((s) => s.deleteEvent);
  const moveEventByDelta = useStore((s) => s.moveEventByDelta);
  const getEventById = useStore((s) => s.getEventById);
  const { session, loading: authLoading } = useAuth();

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

  const editingEvent = editingId ? getEventById(editingId) : null;

  React.useEffect(() => {
    ensureEventMetadata();
  }, [ensureEventMetadata]);

  const handleEditEvent = (id: string) => {
    setEditingId(id);
    setSeedRange(null);
    setCreatingRange(null);
    setDialogOpen(true);
  };

  const handleSubmit = (payload: EventInput) => {
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
      <header className="mb-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end">
          <div />
          <div className="flex flex-col items-center gap-1.5">
            <div className="inline-flex w-fit flex-col items-center">
              <div className="inline-flex w-full items-baseline justify-between leading-none">
                <span className="font-sans text-2xl font-semibold tracking-tight text-neutral-900">
                  Doze 52
                </span>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger className="relative top-[1px] h-8 min-w-[84px] align-middle border-0 bg-neutral-200 px-2.5 font-sans text-xl leading-none font-normal text-neutral-700 shadow-none hover:bg-neutral-200 focus-visible:ring-neutral-300 [&_svg]:opacity-80 [&_svg]:text-neutral-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                    <SelectItem value="2027">2027</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="w-full text-center text-xs font-light tracking-wide text-neutral-500">
                Sistema anual de estruturação de foco.
              </p>
            </div>
            <CategoryBar compact />
          </div>
          <div className="self-end justify-self-end">
            {authLoading ? null : session ? (
              <UserMenu />
            ) : (
              <Button size="sm" className="h-8" onClick={() => setAuthDialogOpen(true)}>
                Entrar
              </Button>
            )}
          </div>
        </div>
      </header>

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
    </main>
  );
}
