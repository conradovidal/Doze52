"use client";

import * as React from "react";
import type { CalendarEvent, CategoryItem } from "@/lib/types";
import { useStore } from "@/lib/store";
import { endOfYear, format, startOfYear } from "date-fns";
import { buildMultiDaySlotMap } from "@/lib/calendar-slotting";
import { MonthRow } from "./month-row";

export function YearGrid({
  year,
  events,
  onEditEvent,
  creatingRange,
  onStartCreateRange,
  onHoverCreateRange,
  onFinishCreateRange,
  onDragStartEvent,
  onDragEnterDate,
  onDropOnDate,
  onDragEndEvent,
  draggingEventId,
  dragHoverPointerDate,
  dragGrabOffsetDays,
  dragDurationDays,
}: {
  year: number;
  events: CalendarEvent[];
  onEditEvent: (id: string) => void;
  creatingRange: { startIso: string; hoverIso: string; isDragging: boolean } | null;
  onStartCreateRange: (startIso: string) => void;
  onHoverCreateRange: (hoverIso: string) => void;
  onFinishCreateRange: (endIso?: string) => void;
  onDragStartEvent: (
    eventId: string,
    startDateIso: string,
    endDateIso: string,
    grabOffsetDays: number
  ) => void;
  onDragEnterDate: (dateIso: string) => void;
  onDropOnDate: (dateIso: string) => void;
  onDragEndEvent: () => void;
  draggingEventId: string | null;
  dragHoverPointerDate: string | null;
  dragGrabOffsetDays: number | null;
  dragDurationDays: number | null;
}) {
  const categories = useStore((s) => s.categories as CategoryItem[]);
  const visibleCategoryIds = React.useMemo(
    () => categories.filter((c) => c.visible).map((c) => c.id),
    [categories]
  );
  const multiDaySlotById = React.useMemo(() => {
    const rangeStartIso = format(startOfYear(new Date(year, 0, 1)), "yyyy-MM-dd");
    const rangeEndIso = format(endOfYear(new Date(year, 0, 1)), "yyyy-MM-dd");
    return buildMultiDaySlotMap({
      events: events.filter((event) => visibleCategoryIds.includes(event.categoryId)),
      rangeStartIso,
      rangeEndIso,
    });
  }, [events, visibleCategoryIds, year]);

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
          onEditEvent={onEditEvent}
          creatingRange={creatingRange}
          onStartCreateRange={onStartCreateRange}
          onHoverCreateRange={onHoverCreateRange}
          onFinishCreateRange={onFinishCreateRange}
          onDragStartEvent={onDragStartEvent}
          onDragEnterDate={onDragEnterDate}
          onDropOnDate={onDropOnDate}
          onDragEndEvent={onDragEndEvent}
          draggingEventId={draggingEventId}
          dragHoverPointerDate={dragHoverPointerDate}
          dragGrabOffsetDays={dragGrabOffsetDays}
          dragDurationDays={dragDurationDays}
        />
      ))}
    </div>
  );
}
