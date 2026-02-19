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
  const didDropRef = React.useRef(false);

  const visibleEvents = React.useMemo(
    () => events.filter((event) => visibleCategoryIds.includes(event.categoryId)),
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
    setDragState({
      draggingEventId: null,
      hoverDateIso: null,
      reorderTarget: null,
      source: null,
    });
  }, []);

  const clearReorderTarget = React.useCallback(() => {
    setDragState((prev) => ({ ...prev, reorderTarget: null }));
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
      setDragState({
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
      });
    },
    []
  );

  const onDayHover = React.useCallback((dateIso: string) => {
    setDragState((prev) => ({ ...prev, hoverDateIso: dateIso, reorderTarget: null }));
  }, []);

  const onSingleDayListHover = React.useCallback((dayIso: string, insertIndex: number) => {
    setDragState((prev) => ({
      ...prev,
      hoverDateIso: dayIso,
      reorderTarget: { dayIso, insertIndex },
    }));
  }, []);

  const onDayDrop = React.useCallback(
    (dropDateIso: string) => {
      const currentState = dragState;
      if (!currentState.source || !currentState.draggingEventId) {
        clearDragState();
        return;
      }

      const sourceEvent = eventById.get(currentState.draggingEventId);
      if (!sourceEvent) {
        clearDragState();
        return;
      }

      if (
        !currentState.source.isMultiDay &&
        currentState.source.startDate === dropDateIso &&
        currentState.reorderTarget &&
        currentState.reorderTarget.dayIso === dropDateIso &&
        Number.isInteger(currentState.reorderTarget.insertIndex)
      ) {
        const inDayIds = visibleEvents
          .filter((event) => event.startDate === dropDateIso && event.endDate === dropDateIso)
          .sort((a, b) => {
            if (a.dayOrder !== b.dayOrder) return a.dayOrder - b.dayOrder;
            const byTitle = a.title.localeCompare(b.title);
            if (byTitle !== 0) return byTitle;
            return a.id.localeCompare(b.id);
          })
          .map((event) => event.id);

        const withoutMoved = inDayIds.filter((id) => id !== currentState.draggingEventId);
        const insertAt = Math.max(
          0,
          Math.min(currentState.reorderTarget.insertIndex, withoutMoved.length)
        );
        withoutMoved.splice(insertAt, 0, currentState.draggingEventId);

        onApplyDayReorder({
          dayIso: dropDateIso,
          eventId: currentState.draggingEventId,
          toIndex: insertAt,
          orderedIds: withoutMoved,
        });
        didDropRef.current = true;
        clearDragState();
        return;
      }

      const newStartDate = addDays(
        parseISO(dropDateIso),
        -(currentState.source.grabOffsetDays ?? 0)
      );
      const sourceStart = parseISO(currentState.source.startDate);
      const deltaDays = differenceInCalendarDays(newStartDate, sourceStart);

      const expectedNewEnd = addDays(
        newStartDate,
        currentState.source.durationDaysInclusive - 1
      );
      const checkDays =
        differenceInCalendarDays(expectedNewEnd, newStartDate) + 1;
      if (checkDays !== currentState.source.durationDaysInclusive) {
        clearDragState();
        return;
      }

      onMoveEventByDelta(sourceEvent.id, deltaDays);
      didDropRef.current = true;
      clearDragState();
    },
    [clearDragState, dragState, eventById, onApplyDayReorder, onMoveEventByDelta, visibleEvents]
  );

  const onEventDragEnd = React.useCallback(() => {
    if (!didDropRef.current) {
      clearDragState();
    }
    didDropRef.current = false;
  }, [clearDragState]);

  React.useEffect(() => {
    if (!dragState.draggingEventId) return;

    const handleWindowDrop = () => {
      window.setTimeout(() => {
        if (!didDropRef.current) {
          clearDragState();
        }
      }, 0);
    };

    const handleWindowDragEnd = () => {
      if (!didDropRef.current) {
        clearDragState();
      }
      didDropRef.current = false;
    };

    window.addEventListener("drop", handleWindowDrop, true);
    window.addEventListener("dragend", handleWindowDragEnd, true);
    return () => {
      window.removeEventListener("drop", handleWindowDrop, true);
      window.removeEventListener("dragend", handleWindowDragEnd, true);
    };
  }, [clearDragState, dragState.draggingEventId]);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-neutral-200">
      {Array.from({ length: 12 }).map((_, idx) => (
        <MonthRow
          key={idx}
          year={year}
          monthIndex={idx}
          events={events}
          visibleCategoryIds={visibleCategoryIds}
          multiDaySlotById={multiDaySlotById}
          dragState={dragState}
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
