"use client";

import * as React from "react";
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
import type { CalendarEvent } from "@/lib/types";
import type { GlobalDragState } from "./year-grid";
import { fmtMonthLabel } from "@/lib/date";
import {
  hasCalendarEventDndPayloadType,
  readCalendarEventDndPayload,
  writeCalendarEventDndPayload,
} from "@/lib/calendar-dnd";
import {
  EVENT_ITEM_GAP_PX,
  EVENT_ITEM_HEIGHT_PX,
  EVENT_ITEM_LINE_HEIGHT_CLASS,
  EVENT_ITEM_PADDING_X_CLASS,
  EVENT_ITEM_RADIUS_CLASS,
  EVENT_ITEM_TEXT_CLASS,
  MONTH_MULTI_DAY_TOP_OFFSET_PX,
  MONTH_ROW_BASE_MIN_HEIGHT_PX,
  MONTH_ROW_BOTTOM_PADDING_PX,
  MONTH_SINGLE_DAY_GAP_FROM_BARS_PX,
  MONTH_SINGLE_DAY_TOP_OFFSET_NO_MULTI_PX,
} from "@/lib/calendar-layout";
import { DayCell } from "./day-cell";
import { EventBar } from "./event-bar";

const COLUMNS = 37;
const EVENT_ROW_STEP = EVENT_ITEM_HEIGHT_PX + EVENT_ITEM_GAP_PX;

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
  dragState,
  hasDragContext,
  onEditEvent,
  creatingRange,
  onStartCreateRange,
  onHoverCreateRange,
  onFinishCreateRange,
  onEventDragStart,
  onEventDragEnd,
  onDayHover,
  onDayDrop,
  onSingleDayListHover,
  clearReorderTarget,
}: {
  year: number;
  monthIndex: number;
  events: CalendarEvent[];
  visibleCategoryIds: string[];
  multiDaySlotById: Map<string, number>;
  dragState: GlobalDragState;
  hasDragContext: boolean;
  onEditEvent: (id: string) => void;
  creatingRange: { startIso: string; hoverIso: string; isDragging: boolean } | null;
  onStartCreateRange: (startIso: string) => void;
  onHoverCreateRange: (hoverIso: string) => void;
  onFinishCreateRange: (endIso?: string) => void;
  onEventDragStart: (payload: {
    eventId: string;
    startDate: string;
    endDate: string;
    grabOffsetDays: number;
    isMultiDay: boolean;
  }) => void;
  onEventDragEnd: () => void;
  onDayHover: (dateIso: string) => void;
  onDayDrop: (dateIso: string, transfer?: DataTransfer | null) => void;
  onSingleDayListHover: (dayIso: string, insertIndex: number) => void;
  clearReorderTarget: () => void;
}) {
  const daysGridRef = React.useRef<HTMLDivElement | null>(null);
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

  const globallyVisibleEvents = React.useMemo(
    () => events.filter((evt) => visibleCategoryIds.includes(evt.categoryId)),
    [events, visibleCategoryIds]
  );
  const globalEventById = React.useMemo(
    () => new Map(globallyVisibleEvents.map((evt) => [evt.id, evt])),
    [globallyVisibleEvents]
  );

  const parsedEvents: ParsedEvent[] = globallyVisibleEvents
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

  const draggingEvent = dragState.draggingEventId
    ? globalEventById.get(dragState.draggingEventId)
    : undefined;
  const isDraggingAny = hasDragContext;
  const draggingSingleDay = Boolean(dragState.source && !dragState.source.isMultiDay);
  const draggingMultiDay = Boolean(dragState.source?.isMultiDay);

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
    singleDayByIso.get(evt.startDate)?.push(evt);
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

  const maxMultiRows = segments.reduce((acc, seg) => Math.max(acc, seg.row), 0);
  const maxSingleRows = Math.max(
    1,
    ...Array.from(singleDayByIso.values()).map((bucket) => bucket.length)
  );
  const singleDayStartOffset =
    MONTH_MULTI_DAY_TOP_OFFSET_PX +
    (maxMultiRows > 0
      ? maxMultiRows * EVENT_ITEM_HEIGHT_PX +
        Math.max(0, maxMultiRows - 1) * EVENT_ITEM_GAP_PX +
        MONTH_SINGLE_DAY_GAP_FROM_BARS_PX
      : MONTH_SINGLE_DAY_TOP_OFFSET_NO_MULTI_PX);
  const singleDayContentHeight =
    maxSingleRows * EVENT_ITEM_HEIGHT_PX +
    Math.max(0, maxSingleRows - 1) * EVENT_ITEM_GAP_PX;
  const contentHeight =
    singleDayStartOffset + singleDayContentHeight + MONTH_ROW_BOTTOM_PADDING_PX;
  const minHeightPx = Math.max(MONTH_ROW_BASE_MIN_HEIGHT_PX, contentHeight);

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

  let projectedMultiPreview:
    | { row: number; startCol: number; endCol: number }
    | null = null;

  if (dragState.source?.isMultiDay && dragState.hoverDateIso && dragState.draggingEventId) {
    const projectedStart = addDays(
      parseISO(dragState.hoverDateIso),
      -(dragState.source.grabOffsetDays ?? 0)
    );
    const projectedEnd = addDays(
      projectedStart,
      dragState.source.durationDaysInclusive - 1
    );
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
        const occupied = segments.filter(
          (seg) => seg.event.id !== dragState.draggingEventId
        );
        let row = 1;
        while (
          occupied.some(
            (seg) => seg.row === row && seg.startCol <= endCol && seg.endCol >= startCol
          )
        ) {
          row += 1;
        }
        projectedMultiPreview = { row, startCol, endCol };
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
          if (!creatingRange || isDraggingAny) return;
          const targetDate = resolveTargetDateFromPointer(e.clientX);
          if (!targetDate || !isSameMonth(targetDate, monthStart)) return;
          onHoverCreateRange(format(targetDate, "yyyy-MM-dd"));
        }}
        onMouseDown={(e) => {
          if (e.button !== 0 || isDraggingAny) return;
          const target = e.target as HTMLElement | null;
          if (target?.closest("button[draggable='true']")) return;
          const targetDate = resolveTargetDateFromPointer(e.clientX);
          if (!targetDate || !isSameMonth(targetDate, monthStart)) return;
          e.preventDefault();
          onStartCreateRange(format(targetDate, "yyyy-MM-dd"));
        }}
        onMouseMove={(e) => {
          if (!creatingRange || isDraggingAny) return;
          const targetDate = resolveTargetDateFromPointer(e.clientX);
          if (!targetDate || !isSameMonth(targetDate, monthStart)) return;
          onHoverCreateRange(format(targetDate, "yyyy-MM-dd"));
        }}
        onMouseUp={(e) => {
          if (e.button !== 0 || !creatingRange || isDraggingAny) return;
          const targetDate = resolveTargetDateFromPointer(e.clientX);
          if (!targetDate || !isSameMonth(targetDate, monthStart)) {
            onFinishCreateRange();
            return;
          }
          onFinishCreateRange(format(targetDate, "yyyy-MM-dd"));
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
                dateIso={day.iso}
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
                isDropActive={isDraggingAny && dragState.hoverDateIso === day.iso}
                onDayHover={onDayHover}
                onDayDrop={onDayDrop}
              />
            </div>
          ))}
        </div>

        {rangeColumns && !isDraggingAny ? (
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
            className="grid"
            style={{
              gridTemplateColumns: "repeat(37, minmax(0, 1fr))",
              gap: `${EVENT_ITEM_GAP_PX}px 0px`,
              gridAutoRows: `${EVENT_ITEM_HEIGHT_PX}px`,
              paddingTop: `${MONTH_MULTI_DAY_TOP_OFFSET_PX}px`,
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
                  isDragging={dragState.draggingEventId === seg.event.id}
                  className={
                    isDraggingAny && dragState.draggingEventId !== seg.event.id
                      ? "pointer-events-none"
                      : ""
                  }
                  onDragStart={(e) => {
                    const pointerDate = resolveTargetDateFromPointer(e.clientX);
                    const eventStart = parseISO(seg.event.startDate);
                    const rawOffset = pointerDate
                      ? differenceInCalendarDays(pointerDate, eventStart)
                      : 0;
                    const eventDuration =
                      differenceInCalendarDays(parseISO(seg.event.endDate), eventStart) + 1;
                    const grabOffsetDays = Math.max(
                      0,
                      Math.min(rawOffset, Math.max(0, eventDuration - 1))
                    );
                    writeCalendarEventDndPayload(e.dataTransfer, {
                      eventId: seg.event.id,
                      startDate: seg.event.startDate,
                      endDate: seg.event.endDate,
                      grabOffsetDays,
                      isMultiDay: true,
                    });
                    onEventDragStart({
                      eventId: seg.event.id,
                      startDate: seg.event.startDate,
                      endDate: seg.event.endDate,
                      grabOffsetDays,
                      isMultiDay: true,
                    });
                  }}
                  onDragEnd={onEventDragEnd}
                />
              </div>
            ))}

            {projectedMultiPreview ? (
              <div
                className={`${EVENT_ITEM_RADIUS_CLASS} pointer-events-none z-20 bg-neutral-500/20 ring-1 ring-neutral-400/80`}
                style={{
                  gridColumn: `${projectedMultiPreview.startCol} / ${
                    projectedMultiPreview.endCol + 1
                  }`,
                  gridRow: projectedMultiPreview.row,
                  minHeight: `${EVENT_ITEM_HEIGHT_PX}px`,
                }}
              />
            ) : null}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[11]">
          <div
            className="grid"
            style={{ gridTemplateColumns: "repeat(37, minmax(0, 1fr))" }}
          >
            {dayInfos.map((day) => {
              if (!day.inMonth) return null;
              const dayEvents = singleDayByIso.get(day.iso) ?? [];
              const draggedEventId = dragState.draggingEventId;

              const previewIndex =
                dragState.reorderTarget?.dayIso === day.iso
                  ? dragState.reorderTarget.insertIndex
                  : null;
              const showMoveGhost =
                draggingSingleDay &&
                dragState.hoverDateIso === day.iso &&
                (previewIndex === null || previewIndex < 0);
              const baseCountInDay = dayEvents.filter(
                (event) => event.id !== draggedEventId
              ).length;

              return (
                <div
                  key={`single-${monthIndex}-${day.iso}`}
                  className="relative pointer-events-none"
                  style={{
                    gridColumn: `${day.col} / ${day.col + 1}`,
                    minHeight: `${minHeightPx}px`,
                  }}
                >
                  <div
                    className={`absolute inset-x-0 ${
                      draggingMultiDay
                        ? "pointer-events-none"
                        : "pointer-events-auto"
                    }`}
                    style={{ top: `${singleDayStartOffset}px` }}
                    onDragOver={(e) => {
                      // Keep the target droppable even if drag context detection is flaky.
                      e.preventDefault();
                      e.stopPropagation();

                      const dragPayload = readCalendarEventDndPayload(e.dataTransfer);
                      const hasTransferType = hasCalendarEventDndPayloadType(e.dataTransfer);
                      const hasAppDrag = Boolean(dragPayload || hasTransferType || hasDragContext);
                      if (!hasAppDrag) {
                        clearReorderTarget();
                        return;
                      }

                      onDayHover(day.iso);
                      const draggedEventId = dragPayload?.eventId ?? dragState.draggingEventId;
                      const isSingleDayDrag = dragPayload
                        ? !dragPayload.isMultiDay
                        : dragState.source
                          ? !dragState.source.isMultiDay
                          : null;
                      if (!isSingleDayDrag) {
                        clearReorderTarget();
                        return;
                      }
                      const rect = e.currentTarget.getBoundingClientRect();
                      const relativeY = Math.max(0, e.clientY - rect.top);
                      const baseIds = dayEvents
                        .map((event) => event.id)
                        .filter((id) => id !== draggedEventId);
                      const step = EVENT_ROW_STEP;
                      const insertIndex = Math.max(
                        0,
                        Math.min(Math.floor((relativeY + step / 2) / step), baseIds.length)
                      );
                      onSingleDayListHover(day.iso, insertIndex);
                    }}
                    onDragLeave={(e) => {
                      const related = e.relatedTarget as Node | null;
                      if (related && e.currentTarget.contains(related)) return;
                      clearReorderTarget();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDayDrop(day.iso, e.dataTransfer);
                    }}
                  >
                    <div
                      className="flex flex-col"
                      style={{ gap: `${EVENT_ITEM_GAP_PX}px` }}
                    >
                      {(() => {
                        let nonDraggedSeen = 0;
                        let placeholderRendered = false;
                        return dayEvents.map((event) => {
                          const isDragged = event.id === draggedEventId;
                          const shouldRenderPlaceholderBefore =
                            !placeholderRendered &&
                            previewIndex !== null &&
                            previewIndex === nonDraggedSeen;
                          if (shouldRenderPlaceholderBefore) {
                            placeholderRendered = true;
                          }
                          if (!isDragged) {
                            nonDraggedSeen += 1;
                          }
                          return (
                            <React.Fragment key={`single-${day.iso}-${event.id}`}>
                              {shouldRenderPlaceholderBefore ? (
                                <div
                                  className={`${EVENT_ITEM_RADIUS_CLASS} bg-neutral-500/15 ring-1 ring-neutral-400/70`}
                                  style={{ minHeight: `${EVENT_ITEM_HEIGHT_PX}px` }}
                                />
                              ) : null}
                              <EventBar
                                event={event}
                                onClick={() => onEditEvent(event.id)}
                                draggable
                                isDragging={isDragged}
                                className={
                                  isDragged
                                    ? "pointer-events-none opacity-40"
                                    : draggingSingleDay
                                      ? "pointer-events-none"
                                      : ""
                                }
                                onDragStart={(e) => {
                                  writeCalendarEventDndPayload(e.dataTransfer, {
                                    eventId: event.id,
                                    startDate: event.startDate,
                                    endDate: event.endDate,
                                    grabOffsetDays: 0,
                                    isMultiDay: false,
                                  });
                                  onEventDragStart({
                                    eventId: event.id,
                                    startDate: event.startDate,
                                    endDate: event.endDate,
                                    grabOffsetDays: 0,
                                    isMultiDay: false,
                                  });
                                }}
                                onDragEnd={onEventDragEnd}
                              />
                            </React.Fragment>
                          );
                        });
                      })()}
                      {previewIndex !== null && previewIndex >= baseCountInDay ? (
                        <div
                          className={`${EVENT_ITEM_RADIUS_CLASS} bg-neutral-500/15 ring-1 ring-neutral-400/70`}
                          style={{ minHeight: `${EVENT_ITEM_HEIGHT_PX}px` }}
                        />
                      ) : null}
                      {showMoveGhost ? (
                        <div
                          className={`pointer-events-none ${EVENT_ITEM_RADIUS_CLASS} ${EVENT_ITEM_PADDING_X_CLASS} ${EVENT_ITEM_TEXT_CLASS} ${EVENT_ITEM_LINE_HEIGHT_CLASS} truncate text-white opacity-75`}
                          style={{
                            backgroundColor: draggingEvent?.color ?? "#6b7280",
                            minHeight: `${EVENT_ITEM_HEIGHT_PX}px`,
                          }}
                        >
                          {draggingEvent?.title ?? "Movendo..."}
                        </div>
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
