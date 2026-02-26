"use client";

import * as React from "react";
import {
  addDays,
  differenceInCalendarDays,
  endOfYear,
  format,
  parseISO,
  startOfYear,
} from "date-fns";
import type { CalendarEvent, CategoryItem } from "@/lib/types";
import { useStore } from "@/lib/store";
import { buildMultiDaySlotMap } from "@/lib/calendar-slotting";
import { readCalendarEventDndPayload } from "@/lib/calendar-dnd";
import {
  compareEventsByVisualPriority,
  isRenderableEventDateRange,
  isSingleDayEvent,
} from "@/lib/event-order";
import { MonthRow } from "./month-row";

type ReorderTarget = {
  dayIso: string;
  insertIndex: number;
};

type DragSource = {
  eventId: string;
  startDate: string;
  endDate: string;
  isMultiDay: boolean;
  grabOffsetDays: number;
  durationDaysInclusive: number;
};

export type GlobalDragState = {
  draggingEventId: string | null;
  hoverDateIso: string | null;
  reorderTarget: ReorderTarget | null;
  source: DragSource | null;
};

export function YearGrid({
  year,
  todayIso,
  events,
  onEditEvent,
  creatingRange,
  onStartCreateRange,
  onHoverCreateRange,
  onFinishCreateRange,
  onMoveEventByDelta,
  onApplyDayReorder,
}: {
  year: number;
  todayIso: string;
  events: CalendarEvent[];
  onEditEvent: (id: string) => void;
  creatingRange: { startIso: string; hoverIso: string; isDragging: boolean } | null;
  onStartCreateRange: (startIso: string) => void;
  onHoverCreateRange: (hoverIso: string) => void;
  onFinishCreateRange: (endIso?: string) => void;
  onMoveEventByDelta: (eventId: string, deltaDays: number) => void;
  onApplyDayReorder: (payload: {
    dayIso: string;
    eventId: string;
    toIndex: number;
    orderedIds: string[];
  }) => void;
}) {
  const categories = useStore((s) => s.categories as CategoryItem[]);
  const visibleCategoryIds = React.useMemo(
    () => categories.filter((c) => c.visible).map((c) => c.id),
    [categories]
  );

  const [dragState, setDragState] = React.useState<GlobalDragState>({
    draggingEventId: null,
    hoverDateIso: null,
    reorderTarget: null,
    source: null,
  });
  const dragSnapshotRef = React.useRef<GlobalDragState>({
    draggingEventId: null,
    hoverDateIso: null,
    reorderTarget: null,
    source: null,
  });
  const didDropRef = React.useRef(false);

  const visibleEvents = React.useMemo(
    () =>
      events.filter(
        (event) =>
          visibleCategoryIds.includes(event.categoryId) &&
          isRenderableEventDateRange(event)
      ),
    [events, visibleCategoryIds]
  );
  const eventById = React.useMemo(
    () => new Map(events.map((event) => [event.id, event])),
    [events]
  );

  const multiDaySlotById = React.useMemo(() => {
    const rangeStartIso = format(startOfYear(new Date(year, 0, 1)), "yyyy-MM-dd");
    const rangeEndIso = format(endOfYear(new Date(year, 0, 1)), "yyyy-MM-dd");
    return buildMultiDaySlotMap({
      events: visibleEvents,
      rangeStartIso,
      rangeEndIso,
    });
  }, [visibleEvents, year]);

  const clearDragState = React.useCallback(() => {
    const nextState: GlobalDragState = {
      draggingEventId: null,
      hoverDateIso: null,
      reorderTarget: null,
      source: null,
    };
    dragSnapshotRef.current = nextState;
    setDragState(nextState);
  }, []);

  const clearReorderTarget = React.useCallback(() => {
    setDragState((prev) => {
      const nextState = { ...prev, reorderTarget: null };
      dragSnapshotRef.current = nextState;
      return nextState;
    });
  }, []);

  const onEventDragStart = React.useCallback(
    (payload: {
      eventId: string;
      startDate: string;
      endDate: string;
      grabOffsetDays: number;
      isMultiDay: boolean;
    }) => {
      const durationDaysInclusive =
        differenceInCalendarDays(parseISO(payload.endDate), parseISO(payload.startDate)) + 1;
      didDropRef.current = false;
      const nextState: GlobalDragState = {
        draggingEventId: payload.eventId,
        hoverDateIso: format(
          addDays(parseISO(payload.startDate), payload.grabOffsetDays),
          "yyyy-MM-dd"
        ),
        reorderTarget: null,
        source: {
          ...payload,
          durationDaysInclusive: Math.max(1, durationDaysInclusive),
        },
      };
      dragSnapshotRef.current = nextState;
      setDragState(nextState);
    },
    []
  );

  const onDayHover = React.useCallback((dateIso: string) => {
    setDragState((prev) => {
      const nextState = { ...prev, hoverDateIso: dateIso, reorderTarget: null };
      dragSnapshotRef.current = nextState;
      return nextState;
    });
  }, []);

  const onSingleDayListHover = React.useCallback((dayIso: string, insertIndex: number) => {
    setDragState((prev) => {
      const nextState = {
        ...prev,
        hoverDateIso: dayIso,
        reorderTarget: { dayIso, insertIndex },
      };
      dragSnapshotRef.current = nextState;
      return nextState;
    });
  }, []);

  const onDayDrop = React.useCallback(
    (dropDateIso: string, transfer?: DataTransfer | null) => {
      const transferPayload = readCalendarEventDndPayload(transfer);
      const hasLiveState = Boolean(dragState.source && dragState.draggingEventId);
      const hasSnapshot = Boolean(
        dragSnapshotRef.current.source && dragSnapshotRef.current.draggingEventId
      );

      let currentSource: DragSource | null = null;
      let currentEventId: string | null = null;
      const currentReorderTarget = dragState.reorderTarget ?? dragSnapshotRef.current.reorderTarget;

      if (transferPayload) {
        const durationDaysInclusive =
          differenceInCalendarDays(
            parseISO(transferPayload.endDate),
            parseISO(transferPayload.startDate)
          ) + 1;
        currentSource = {
          ...transferPayload,
          durationDaysInclusive: Math.max(1, durationDaysInclusive),
        };
        currentEventId = transferPayload.eventId;
      } else if (hasLiveState) {
        currentSource = dragState.source;
        currentEventId = dragState.draggingEventId;
      } else if (hasSnapshot) {
        currentSource = dragSnapshotRef.current.source;
        currentEventId = dragSnapshotRef.current.draggingEventId;
      }
      if (!currentSource || !currentEventId) {
        clearDragState();
        return;
      }

      const sourceEvent = eventById.get(currentEventId);
      if (!sourceEvent) {
        clearDragState();
        return;
      }

      if (
        !currentSource.isMultiDay &&
        currentSource.startDate === dropDateIso &&
        currentReorderTarget &&
        currentReorderTarget.dayIso === dropDateIso &&
        Number.isInteger(currentReorderTarget.insertIndex)
      ) {
        const inDayIds = visibleEvents
          .filter((event) => event.startDate === dropDateIso && isSingleDayEvent(event))
          .sort(compareEventsByVisualPriority)
          .map((event) => event.id);

        const withoutMoved = inDayIds.filter((id) => id !== currentEventId);
        const insertAt = Math.max(
          0,
          Math.min(currentReorderTarget.insertIndex, withoutMoved.length)
        );
        withoutMoved.splice(insertAt, 0, currentEventId);

        onApplyDayReorder({
          dayIso: dropDateIso,
          eventId: currentEventId,
          toIndex: insertAt,
          orderedIds: withoutMoved,
        });
        didDropRef.current = true;
        clearDragState();
        return;
      }

      const newStartDate = addDays(
        parseISO(dropDateIso),
        -(currentSource.grabOffsetDays ?? 0)
      );
      const sourceStart = parseISO(currentSource.startDate);
      const deltaDays = differenceInCalendarDays(newStartDate, sourceStart);

      const expectedNewEnd = addDays(
        newStartDate,
        currentSource.durationDaysInclusive - 1
      );
      const checkDays =
        differenceInCalendarDays(expectedNewEnd, newStartDate) + 1;
      if (checkDays !== currentSource.durationDaysInclusive) {
        clearDragState();
        return;
      }

      onMoveEventByDelta(sourceEvent.id, deltaDays);
      didDropRef.current = true;
      clearDragState();
    },
    [
      clearDragState,
      dragState,
      eventById,
      onApplyDayReorder,
      onMoveEventByDelta,
      visibleEvents,
    ]
  );

  const onEventDragEnd = React.useCallback(() => {
    if (!didDropRef.current) {
      clearDragState();
    }
    didDropRef.current = false;
  }, [clearDragState]);

  const hasDragContext = Boolean(dragState.draggingEventId || dragState.source);

  React.useEffect(() => {
    if (!dragState.draggingEventId) return;

    const handleWindowDrop = () => {
      window.setTimeout(() => {
        if (!didDropRef.current) {
          clearDragState();
        }
      }, 0);
    };

    window.addEventListener("drop", handleWindowDrop, true);
    return () => {
      window.removeEventListener("drop", handleWindowDrop, true);
    };
  }, [clearDragState, dragState.draggingEventId]);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border">
      {Array.from({ length: 12 }).map((_, idx) => (
        <MonthRow
          key={idx}
          year={year}
          todayIso={todayIso}
          monthIndex={idx}
          events={events}
          visibleCategoryIds={visibleCategoryIds}
          multiDaySlotById={multiDaySlotById}
          dragState={dragState}
          hasDragContext={hasDragContext}
          onEditEvent={onEditEvent}
          creatingRange={creatingRange}
          onStartCreateRange={onStartCreateRange}
          onHoverCreateRange={onHoverCreateRange}
          onFinishCreateRange={onFinishCreateRange}
          onEventDragStart={onEventDragStart}
          onEventDragEnd={onEventDragEnd}
          onDayHover={onDayHover}
          onDayDrop={onDayDrop}
          onSingleDayListHover={onSingleDayListHover}
          clearReorderTarget={clearReorderTarget}
        />
      ))}
    </div>
  );
}
