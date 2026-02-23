"use client";

import * as React from "react";
import type { CalendarEvent } from "@/lib/types";
import { useStore } from "@/lib/store";
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fmtMonthLabel } from "@/lib/date";
import { DayCell } from "./day-cell";
import { EventBar } from "./event-bar";

const COLUMNS = 37;
const BASE_MIN_HEIGHT_COMPACT = 48;
const HEADER_OFFSET = 20;
const EVENT_ROW_HEIGHT = 14;
const EVENT_ROW_GAP = 2;
const BOTTOM_PADDING = 4;
const DRAG_MODE_THRESHOLD = 10;
const EVENT_ROW_STEP = EVENT_ROW_HEIGHT + EVENT_ROW_GAP;

type ParsedEvent = CalendarEvent & {
  start: Date;
  end: Date;
};

type RenderSegment = {
  event: ParsedEvent;
  row: number;
  startCol: number;
  endCol: number;
};

type DragIntent = "pending" | "move-date" | "reorder-day";

export function MonthRow({
  year,
  monthIndex,
  events,
  visibleCategoryIds,
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
  monthIndex: number;
  events: CalendarEvent[];
  visibleCategoryIds: string[];
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
  const reorderEventInDay = useStore((s) => s.reorderEventInDay);
  const normalizeDayOrder = useStore((s) => s.normalizeDayOrder);

  const daysGridRef = React.useRef<HTMLDivElement | null>(null);
  const [dragIntent, setDragIntent] = React.useState<DragIntent | "idle">("idle");
  const dragStartPointRef = React.useRef<{ x: number; y: number } | null>(null);

  const [reorderPreview, setReorderPreview] = React.useState<{
    dayIso: string;
    row: number;
  } | null>(null);

  const monthStart = startOfMonth(new Date(year, monthIndex, 1));
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let cur = gridStart;
  while (cur <= gridEnd) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  while (days.length < COLUMNS) {
    days.push(addDays(days[days.length - 1], 1));
  }
  const gridDays = days.slice(0, COLUMNS);

  const dayInfos = gridDays.map((date, idx) => ({
    date,
    col: idx + 1,
    iso: format(date, "yyyy-MM-dd"),
    inMonth: isSameMonth(date, monthStart),
  }));
  const rangeBounds = React.useMemo(() => {
    if (!creatingRange) return null;
    const a = creatingRange.startIso;
    const b = creatingRange.hoverIso;
    return a <= b
      ? { startIso: a, endIso: b }
      : { startIso: b, endIso: a };
  }, [creatingRange]);
  const rangeColumns = (() => {
    if (!rangeBounds) return null;
    const selected = dayInfos
      .filter(
        (day) =>
          day.inMonth && day.iso >= rangeBounds.startIso && day.iso <= rangeBounds.endIso
      )
      .map((day) => day.col);
    if (!selected.length) return null;
    return { startCol: Math.min(...selected), endCol: Math.max(...selected) };
  })();
  const inMonthDays = dayInfos.filter((d) => d.inMonth);
  const monthLabel = fmtMonthLabel(monthStart);

  const parsedEvents: ParsedEvent[] = events
    .filter((e) => visibleCategoryIds.includes(e.categoryId))
    .map((e) => ({
      ...e,
      start: parseISO(e.startDate),
      end: parseISO(e.endDate),
    }))
    .filter((e) => !(e.end < monthStart || e.start > monthEnd));

  const sortForDay = React.useCallback((a: ParsedEvent, b: ParsedEvent, dayIso: string) => {
    const aOrder = a.dayOrder?.[dayIso];
    const bOrder = b.dayOrder?.[dayIso];
    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
    if (aOrder !== undefined) return -1;
    if (bOrder !== undefined) return 1;
    const aCreated = a.createdAt ?? "1970-01-01T00:00:00.000Z";
    const bCreated = b.createdAt ?? "1970-01-01T00:00:00.000Z";
    const byCreatedAt = aCreated.localeCompare(bCreated);
    if (byCreatedAt !== 0) return byCreatedAt;
    return a.id.localeCompare(b.id);
  }, []);

  const assignmentByDay = new Map<string, Map<string, number>>();
  let continuationRows = new Map<string, number>();
  let maxRowUsed = 1;

  for (const day of inMonthDays) {
    const active = parsedEvents
      .filter((evt) => evt.start <= day.date && evt.end >= day.date)
      .sort((a, b) => sortForDay(a, b, day.iso));

    const assigned = new Map<string, number>();
    const takenRows = new Set<number>();

    for (const evt of active) {
      const continuedRow = continuationRows.get(evt.id);
      if (!continuedRow || takenRows.has(continuedRow)) continue;
      assigned.set(evt.id, continuedRow);
      takenRows.add(continuedRow);
      maxRowUsed = Math.max(maxRowUsed, continuedRow);
    }

    for (const evt of active) {
      if (assigned.has(evt.id)) continue;
      let row = 1;
      while (takenRows.has(row)) row += 1;
      assigned.set(evt.id, row);
      takenRows.add(row);
      maxRowUsed = Math.max(maxRowUsed, row);
    }

    assignmentByDay.set(day.iso, assigned);

    const nextContinuation = new Map<string, number>();
    for (const evt of active) {
      const row = assigned.get(evt.id);
      if (!row) continue;
      if (evt.end > day.date) nextContinuation.set(evt.id, row);
    }
    continuationRows = nextContinuation;
  }

  const segments: RenderSegment[] = [];
  for (const evt of parsedEvents) {
    let openSegment: RenderSegment | null = null;
    for (const day of inMonthDays) {
      const dayRow = assignmentByDay.get(day.iso)?.get(evt.id);
      if (dayRow === undefined) {
        if (openSegment) {
          segments.push(openSegment);
          openSegment = null;
        }
        continue;
      }

      if (
        openSegment &&
        openSegment.row === dayRow &&
        openSegment.endCol + 1 === day.col
      ) {
        openSegment.endCol = day.col;
      } else {
        if (openSegment) segments.push(openSegment);
        openSegment = {
          event: evt,
          row: dayRow,
          startCol: day.col,
          endCol: day.col,
        };
      }
    }
    if (openSegment) segments.push(openSegment);
  }

  const segmentById = new Map(segments.map((seg) => [seg.event.id, seg]));
  if (draggingEventId && segmentById.has(draggingEventId)) {
    maxRowUsed = Math.max(maxRowUsed, segmentById.get(draggingEventId)!.row);
  }
  const rowCount = Math.max(maxRowUsed, reorderPreview?.row ?? 1);
  const contentHeight =
    HEADER_OFFSET +
    rowCount * EVENT_ROW_HEIGHT +
    Math.max(0, rowCount - 1) * EVENT_ROW_GAP +
    BOTTOM_PADDING;
  const minHeightPx = Math.max(BASE_MIN_HEIGHT_COMPACT, contentHeight);

  const resolveTargetDateFromPointer = (clientX: number) => {
    const rect = daysGridRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    const relativeX = Math.max(0, Math.min(clientX - rect.left, rect.width - 1));
    const col = Math.floor((relativeX / rect.width) * COLUMNS);
    return gridDays[Math.max(0, Math.min(col, COLUMNS - 1))] ?? null;
  };

  const resolveTargetRowFromPointer = (clientY: number) => {
    const rect = daysGridRef.current?.getBoundingClientRect();
    if (!rect) return 1;
    const relativeY = clientY - (rect.top + HEADER_OFFSET);
    const raw = Math.floor(Math.max(0, relativeY) / EVENT_ROW_STEP) + 1;
    return Math.max(1, Math.min(raw, rowCount + 1));
  };

  const clearLocalDragState = () => {
    setDragIntent("idle");
    dragStartPointRef.current = null;
    setReorderPreview(null);
  };

  let projectedPreview:
    | {
        startCol: number;
        endCol: number;
        row: number;
      }
    | null = null;

  if (
    draggingEventId &&
    dragHoverPointerDate &&
    dragGrabOffsetDays !== null &&
    dragDurationDays !== null &&
    dragIntent !== "reorder-day"
  ) {
    const projectedStart = addDays(parseISO(dragHoverPointerDate), -dragGrabOffsetDays);
    const projectedEnd = addDays(projectedStart, dragDurationDays);
    if (!(projectedEnd < monthStart || projectedStart > monthEnd)) {
      const startIndex = differenceInCalendarDays(
        projectedStart < monthStart ? monthStart : projectedStart,
        gridStart
      ) + 1;
      const endIndex = differenceInCalendarDays(
        projectedEnd > monthEnd ? monthEnd : projectedEnd,
        gridStart
      ) + 1;
      const startCol = Math.max(1, Math.min(startIndex, COLUMNS));
      const endCol = Math.max(1, Math.min(endIndex, COLUMNS));
      if (startCol <= endCol) {
        const occupied = segments.filter((seg) => seg.event.id !== draggingEventId);
        let row = 1;
        while (
          occupied.some(
            (seg) =>
              seg.row === row &&
              seg.startCol <= endCol &&
              seg.endCol >= startCol
          )
        ) {
          row += 1;
        }
        projectedPreview = { startCol, endCol, row };
      }
    }
  }

  return (
    <div
      className="flex items-stretch border-b border-neutral-200 last:border-b-0"
    >
      <div
        className="flex w-9 flex-none items-center justify-center text-neutral-600"
        style={{ minHeight: `${minHeightPx}px` }}
      >
        <span className="-rotate-90 text-[11px] font-medium tracking-wide">{monthLabel}</span>
      </div>
      <div
        className="relative flex-1 w-full"
        onMouseEnter={(e) => {
          if (!creatingRange || draggingEventId) return;
          const targetDate = resolveTargetDateFromPointer(e.clientX);
          if (!targetDate || !isSameMonth(targetDate, monthStart)) return;
          onHoverCreateRange(format(targetDate, "yyyy-MM-dd"));
        }}
        onMouseDown={(e) => {
          if (e.button !== 0 || draggingEventId) return;
          const target = e.target as HTMLElement | null;
          if (target?.closest("button[draggable='true']")) return;
          const targetDate = resolveTargetDateFromPointer(e.clientX);
          if (!targetDate || !isSameMonth(targetDate, monthStart)) return;
          e.preventDefault();
          onStartCreateRange(format(targetDate, "yyyy-MM-dd"));
        }}
        onMouseMove={(e) => {
          if (!creatingRange || draggingEventId) return;
          const targetDate = resolveTargetDateFromPointer(e.clientX);
          if (!targetDate || !isSameMonth(targetDate, monthStart)) return;
          onHoverCreateRange(format(targetDate, "yyyy-MM-dd"));
        }}
        onMouseUp={(e) => {
          if (e.button !== 0 || !creatingRange || draggingEventId) return;
          const targetDate = resolveTargetDateFromPointer(e.clientX);
          if (!targetDate || !isSameMonth(targetDate, monthStart)) {
            onFinishCreateRange();
            return;
          }
          onFinishCreateRange(format(targetDate, "yyyy-MM-dd"));
        }}
        onDragOver={(e) => {
          if (!draggingEventId) return;
          e.preventDefault();
          const targetDate = resolveTargetDateFromPointer(e.clientX);
          if (!targetDate || !isSameMonth(targetDate, monthStart)) return;
          const targetIso = format(targetDate, "yyyy-MM-dd");

          if (dragIntent === "idle") setDragIntent("pending");
          let nextIntent = dragIntent === "idle" ? "pending" : dragIntent;
          if (nextIntent === "pending" && dragStartPointRef.current) {
            const dx = Math.abs(e.clientX - dragStartPointRef.current.x);
            const dy = Math.abs(e.clientY - dragStartPointRef.current.y);
            if (dx - dy > DRAG_MODE_THRESHOLD) nextIntent = "move-date";
            else if (dy - dx > DRAG_MODE_THRESHOLD) nextIntent = "reorder-day";
            if (nextIntent !== dragIntent) setDragIntent(nextIntent);
          }

          if (nextIntent === "reorder-day") {
            const row = resolveTargetRowFromPointer(e.clientY);
            setReorderPreview({ dayIso: targetIso, row });
            return;
          }

          setReorderPreview(null);
          onDragEnterDate(targetIso);
        }}
        onDrop={(e) => {
          if (!draggingEventId) return;
          e.preventDefault();
          const targetDate = resolveTargetDateFromPointer(e.clientX);
          if (!targetDate || !isSameMonth(targetDate, monthStart)) {
            clearLocalDragState();
            onDragEndEvent();
            return;
          }

          const targetIso = format(targetDate, "yyyy-MM-dd");
          if (dragIntent === "reorder-day" && reorderPreview) {
            const dayDate = parseISO(reorderPreview.dayIso);
            const baseIds = parsedEvents
              .filter((evt) => evt.start <= dayDate && evt.end >= dayDate)
              .sort((a, b) => sortForDay(a, b, reorderPreview.dayIso))
              .map((evt) => evt.id)
              .filter((id, idx, arr) => arr.indexOf(id) === idx);

            const existing = baseIds.filter((id) => id !== draggingEventId);
            const insertAt = Math.max(0, Math.min(reorderPreview.row - 1, existing.length));
            existing.splice(insertAt, 0, draggingEventId);

            reorderEventInDay({
              eventId: draggingEventId,
              dayIso: reorderPreview.dayIso,
              toIndex: insertAt,
            });
            normalizeDayOrder(reorderPreview.dayIso, existing);
          } else {
            onDropOnDate(targetIso);
          }

          clearLocalDragState();
          onDragEndEvent();
        }}
      >
        <div
          ref={daysGridRef}
          className="grid w-full"
          style={{ gridTemplateColumns: "repeat(37, minmax(0, 1fr))" }}
        >
          {dayInfos.map((day) => (
            <div key={`${monthIndex}-${day.col}`} className="border-l border-neutral-200">
              <DayCell
                date={day.date}
                minHeightPx={minHeightPx}
                isRangeSelected={
                  !!rangeBounds &&
                  day.inMonth &&
                  day.iso >= rangeBounds.startIso &&
                  day.iso <= rangeBounds.endIso
                }
                isRangeStart={!!rangeBounds && day.iso === rangeBounds.startIso}
                isRangeEnd={!!rangeBounds && day.iso === rangeBounds.endIso}
                isInMonth={day.inMonth}
              />
              </div>
          ))}
        </div>

        {rangeColumns && !draggingEventId ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[6]">
            <div
              className="grid"
              style={{ gridTemplateColumns: "repeat(37, minmax(0, 1fr))" }}
            >
              <div
                className="rounded-sm bg-neutral-400/20 ring-1 ring-inset ring-neutral-600/45"
                style={{
                  gridColumn: `${rangeColumns.startCol} / ${rangeColumns.endCol + 1}`,
                  minHeight: `${minHeightPx}px`,
                }}
              />
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
          <div
            className="grid gap-y-[2px]"
            style={{
              paddingTop: `${HEADER_OFFSET}px`,
              gridTemplateColumns: "repeat(37, minmax(0, 1fr))",
              gridAutoRows: `${EVENT_ROW_HEIGHT}px`,
            }}
          >
            {segments.map((seg, idx) => (
              <div
                key={`${seg.event.id}-${seg.startCol}-${seg.endCol}-${idx}`}
                className="pointer-events-auto"
                style={{
                  gridColumn: `${seg.startCol} / ${seg.endCol + 1}`,
                  gridRow: seg.row,
                }}
              >
                <EventBar
                  event={seg.event}
                  onClick={() => onEditEvent(seg.event.id)}
                  draggable
                  isDragging={draggingEventId === seg.event.id}
                  onDragStart={(e) => {
                    const pointerDate = resolveTargetDateFromPointer(e.clientX);
                    const eventStart = parseISO(seg.event.startDate);
                    const eventDurationDays = differenceInCalendarDays(
                      parseISO(seg.event.endDate),
                      eventStart
                    );
                    const rawOffset = pointerDate
                      ? differenceInCalendarDays(pointerDate, eventStart)
                      : 0;
                    const grabOffsetDays = Math.max(0, Math.min(rawOffset, eventDurationDays));
                    setDragIntent("pending");
                    dragStartPointRef.current = { x: e.clientX, y: e.clientY };
                    setReorderPreview(null);
                    onDragStartEvent(
                      seg.event.id,
                      seg.event.startDate,
                      seg.event.endDate,
                      grabOffsetDays
                    );
                  }}
                  onDragEnd={() => {
                    clearLocalDragState();
                    onDragEndEvent();
                  }}
                />
              </div>
            ))}

            {projectedPreview ? (
              <div
                className="pointer-events-none z-20 rounded-sm bg-neutral-500/20 ring-1 ring-neutral-400/80"
                style={{
                  gridColumn: `${projectedPreview.startCol} / ${projectedPreview.endCol + 1}`,
                  gridRow: projectedPreview.row,
                }}
              />
            ) : null}

            {reorderPreview && draggingEventId ? (
              <div
                className="pointer-events-none z-20 rounded-sm bg-neutral-500/15 ring-1 ring-neutral-400/70"
                style={{
                  gridColumn: `${dayInfos.find((d) => d.iso === reorderPreview.dayIso)?.col ?? 1} / ${(dayInfos.find((d) => d.iso === reorderPreview.dayIso)?.col ?? 1) + 1}`,
                  gridRow: reorderPreview.row,
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
