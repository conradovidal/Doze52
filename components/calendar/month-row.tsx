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
const HEADER_OFFSET = 18;
const EVENT_ROW_HEIGHT = 14;
const EVENT_ROW_GAP = 2;
const EVENT_ROW_STEP = EVENT_ROW_HEIGHT + EVENT_ROW_GAP;
const SINGLE_DAY_GAP_FROM_BARS = 6;
const BOTTOM_PADDING = 4;
const DRAG_MODE_THRESHOLD = 10;

type ParsedEvent = CalendarEvent & {
  start: Date;
  end: Date;
  isMultiDay: boolean;
};

type RenderSegment = {
  event: ParsedEvent;
  row: number;
  startCol: number;
  endCol: number;
};

type DragIntent = "pending" | "move-date" | "reorder-day";

const sortMultiDayEvents = (a: ParsedEvent, b: ParsedEvent) => {
  if (a.dayOrder !== b.dayOrder) return a.dayOrder - b.dayOrder;
  if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
  if (a.endDate !== b.endDate) return a.endDate.localeCompare(b.endDate);
  return a.id.localeCompare(b.id);
};

const sortSingleDayEvents = (a: ParsedEvent, b: ParsedEvent) => {
  if (a.dayOrder !== b.dayOrder) return a.dayOrder - b.dayOrder;
  const byTitle = a.title.localeCompare(b.title);
  if (byTitle !== 0) return byTitle;
  return a.id.localeCompare(b.id);
};

export function MonthRow({
  year,
  monthIndex,
  events,
  visibleCategoryIds,
  multiDaySlotById,
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
  multiDaySlotById: Map<string, number>;
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

  const inMonthDays = dayInfos.filter((d) => d.inMonth);
  const monthLabel = fmtMonthLabel(monthStart);

  const parsedEvents: ParsedEvent[] = events
    .filter((evt) => visibleCategoryIds.includes(evt.categoryId))
    .map((evt) => {
      const start = parseISO(evt.startDate);
      const end = parseISO(evt.endDate);
      return {
        ...evt,
        start,
        end,
        isMultiDay: evt.endDate > evt.startDate,
      };
    })
    .filter((evt) => !(evt.end < monthStart || evt.start > monthEnd));

  const eventById = new Map(parsedEvents.map((evt) => [evt.id, evt]));
  const draggingEvent = draggingEventId ? eventById.get(draggingEventId) : undefined;
  const draggingIsSingleDay = Boolean(draggingEvent && !draggingEvent.isMultiDay);

  const multiDayEvents = parsedEvents.filter((evt) => evt.isMultiDay).sort(sortMultiDayEvents);
  const singleDayEvents = parsedEvents
    .filter((evt) => !evt.isMultiDay)
    .sort((a, b) => {
      if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
      return sortSingleDayEvents(a, b);
    });

  const singleDayByIso = new Map<string, ParsedEvent[]>();
  for (const day of inMonthDays) {
    singleDayByIso.set(day.iso, []);
  }
  for (const evt of singleDayEvents) {
    const bucket = singleDayByIso.get(evt.startDate);
    if (!bucket) continue;
    bucket.push(evt);
  }
  for (const [iso, bucket] of singleDayByIso.entries()) {
    singleDayByIso.set(iso, bucket.sort(sortSingleDayEvents));
  }

  const segments: RenderSegment[] = [];
  for (const evt of multiDayEvents) {
    const clampedStart = evt.start < monthStart ? monthStart : evt.start;
    const clampedEnd = evt.end > monthEnd ? monthEnd : evt.end;
    if (clampedEnd < clampedStart) continue;
    const startCol = differenceInCalendarDays(clampedStart, gridStart) + 1;
    const endCol = differenceInCalendarDays(clampedEnd, gridStart) + 1;
    const slot = multiDaySlotById.get(evt.id) ?? 0;
    segments.push({
      event: evt,
      row: slot + 1,
      startCol: Math.max(1, Math.min(startCol, COLUMNS)),
      endCol: Math.max(1, Math.min(endCol, COLUMNS)),
    });
  }

  const maxMultiRowsBase = segments.reduce((acc, seg) => Math.max(acc, seg.row), 0);
  const maxSingleRowsBase = Math.max(
    0,
    ...Array.from(singleDayByIso.values()).map((bucket) => bucket.length)
  );
  const singleDayRows = Math.max(maxSingleRowsBase, reorderPreview?.row ?? 0);
  const singleDayStartOffset =
    HEADER_OFFSET +
    (maxMultiRowsBase > 0
      ? maxMultiRowsBase * EVENT_ROW_HEIGHT +
        Math.max(0, maxMultiRowsBase - 1) * EVENT_ROW_GAP +
        SINGLE_DAY_GAP_FROM_BARS
      : 2);
  const singleDayContentRows = Math.max(1, singleDayRows);
  const singleDayContentHeight =
    singleDayContentRows * EVENT_ROW_HEIGHT +
    Math.max(0, singleDayContentRows - 1) * EVENT_ROW_GAP;
  const contentHeight = singleDayStartOffset + singleDayContentHeight + BOTTOM_PADDING;
  const minHeightPx = Math.max(BASE_MIN_HEIGHT_COMPACT, contentHeight);

  const rangeBounds = React.useMemo(() => {
    if (!creatingRange) return null;
    const a = creatingRange.startIso;
    const b = creatingRange.hoverIso;
    return a <= b ? { startIso: a, endIso: b } : { startIso: b, endIso: a };
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

  const resolveTargetDateFromPointer = (clientX: number) => {
    const rect = daysGridRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    const relativeX = Math.max(0, Math.min(clientX - rect.left, rect.width - 1));
    const col = Math.floor((relativeX / rect.width) * COLUMNS);
    return gridDays[Math.max(0, Math.min(col, COLUMNS - 1))] ?? null;
  };

  const resolveSingleDayRowFromPointer = (clientY: number) => {
    const rect = daysGridRef.current?.getBoundingClientRect();
    if (!rect) return 1;
    const relativeY = clientY - (rect.top + singleDayStartOffset);
    const raw = Math.floor(Math.max(0, relativeY) / EVENT_ROW_STEP) + 1;
    return Math.max(1, Math.min(raw, singleDayContentRows + 1));
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
    draggingEvent?.isMultiDay &&
    dragHoverPointerDate &&
    dragGrabOffsetDays !== null &&
    dragDurationDays !== null &&
    dragIntent !== "reorder-day"
  ) {
    const projectedStart = addDays(parseISO(dragHoverPointerDate), -dragGrabOffsetDays);
    const projectedEnd = addDays(projectedStart, dragDurationDays);
    if (!(projectedEnd < monthStart || projectedStart > monthEnd)) {
      const startIndex =
        differenceInCalendarDays(
          projectedStart < monthStart ? monthStart : projectedStart,
          gridStart
        ) + 1;
      const endIndex =
        differenceInCalendarDays(
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
            (seg) => seg.row === row && seg.startCol <= endCol && seg.endCol >= startCol
          )
        ) {
          row += 1;
        }
        projectedPreview = { startCol, endCol, row };
      }
    }
  }

  return (
    <div className="flex items-stretch border-b border-neutral-200 last:border-b-0">
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

          if (nextIntent === "reorder-day" && draggingIsSingleDay) {
            const row = resolveSingleDayRowFromPointer(e.clientY);
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
          if (dragIntent === "reorder-day" && reorderPreview && draggingIsSingleDay) {
            const baseIds = (singleDayByIso.get(reorderPreview.dayIso) ?? []).map(
              (entry) => entry.id
            );
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
            <div className="grid" style={{ gridTemplateColumns: "repeat(37, minmax(0, 1fr))" }}>
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
            className="grid gap-y-[2px] pt-[18px]"
            style={{
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
                    const grabOffsetDays = Math.max(
                      0,
                      Math.min(rawOffset, eventDurationDays)
                    );
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
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[11]">
          <div className="grid" style={{ gridTemplateColumns: "repeat(37, minmax(0, 1fr))" }}>
            {dayInfos.map((day) => {
              if (!day.inMonth) return null;
              const dayEvents = singleDayByIso.get(day.iso) ?? [];
              const visibleEvents = dayEvents.filter(
                (event) => !(dragIntent === "reorder-day" && event.id === draggingEventId)
              );
              const previewIndex =
                reorderPreview?.dayIso === day.iso ? reorderPreview.row - 1 : null;

              return (
                <div
                  key={`single-${monthIndex}-${day.iso}`}
                  className="relative"
                  style={{
                    gridColumn: `${day.col} / ${day.col + 1}`,
                    minHeight: `${minHeightPx}px`,
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-x-0"
                    style={{ top: `${singleDayStartOffset}px` }}
                  >
                    <div className="space-y-[2px]">
                      {visibleEvents.map((event, index) => (
                        <React.Fragment key={`single-${day.iso}-${event.id}`}>
                          {previewIndex === index ? (
                            <div className="h-[14px] rounded-sm bg-neutral-500/15 ring-1 ring-neutral-400/70" />
                          ) : null}
                          <div className="pointer-events-auto">
                            <EventBar
                              event={event}
                              onClick={() => onEditEvent(event.id)}
                              draggable
                              isDragging={draggingEventId === event.id}
                              onDragStart={(e) => {
                                setDragIntent("pending");
                                dragStartPointRef.current = { x: e.clientX, y: e.clientY };
                                setReorderPreview(null);
                                onDragStartEvent(
                                  event.id,
                                  event.startDate,
                                  event.endDate,
                                  0
                                );
                              }}
                              onDragEnd={() => {
                                clearLocalDragState();
                                onDragEndEvent();
                              }}
                            />
                          </div>
                        </React.Fragment>
                      ))}
                      {previewIndex !== null && previewIndex >= visibleEvents.length ? (
                        <div className="h-[14px] rounded-sm bg-neutral-500/15 ring-1 ring-neutral-400/70" />
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
