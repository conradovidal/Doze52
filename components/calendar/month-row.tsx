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
import type { AnchorPoint, CalendarRenderEvent } from "@/lib/types";
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
  EVENT_ITEM_RADIUS_CLASS,
  MONTH_EVENTS_MIN_TOP_OFFSET_PX,
  MONTH_MIN_TOTAL_EVENT_ROWS_BEFORE_GROWTH,
  MONTH_MULTI_DAY_TOP_OFFSET_PX,
  MONTH_ROW_BASE_MIN_HEIGHT_PX,
  MONTH_ROW_BOTTOM_PADDING_PX,
  MONTH_SINGLE_DAY_TOP_OFFSET_NO_MULTI_PX,
} from "@/lib/calendar-layout";
import {
  compareEventsByVisualPriority,
  isRenderableEventDateRange,
} from "@/lib/event-order";
import { DayCell } from "./day-cell";
import { EventBar } from "./event-bar";

const COLUMNS = 37;
const EVENT_ROW_STEP = EVENT_ITEM_HEIGHT_PX + EVENT_ITEM_GAP_PX;

type ParsedEvent = CalendarRenderEvent & {
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

const sortByVisualPriority = (a: ParsedEvent, b: ParsedEvent) =>
  compareEventsByVisualPriority(a, b);

export function MonthRow({
  year,
  todayIso,
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
  todayIso: string;
  monthIndex: number;
  events: CalendarRenderEvent[];
  visibleCategoryIds: string[];
  multiDaySlotById: Map<string, number>;
  dragState: GlobalDragState;
  hasDragContext: boolean;
  onEditEvent: (payload: {
    eventId: string;
    sourceEventId: string;
    anchorPoint: AnchorPoint;
  }) => void;
  creatingRange: { startIso: string; hoverIso: string; isDragging: boolean } | null;
  onStartCreateRange: (startIso: string) => void;
  onHoverCreateRange: (hoverIso: string) => void;
  onFinishCreateRange: (endIso?: string, anchorPoint?: AnchorPoint) => void;
  onEventDragStart: (payload: {
    eventId: string;
    sourceEventId: string;
    startDate: string;
    endDate: string;
    recurrenceType?: "weekly" | "biweekly" | "monthly" | "yearly";
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

  const parsedEvents: ParsedEvent[] = globallyVisibleEvents
    .filter(isRenderableEventDateRange)
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

  const isDraggingAny = hasDragContext;
  const draggingSingleDay = Boolean(dragState.source && !dragState.source.isMultiDay);
  const draggingMultiDay = Boolean(dragState.source?.isMultiDay);
  const sourceDayIso = draggingSingleDay ? (dragState.source?.startDate ?? null) : null;

  const multiDayEvents = parsedEvents.filter((evt) => evt.isMultiDay).sort(sortByVisualPriority);
  const singleDayEvents = parsedEvents
    .filter((evt) => !evt.isMultiDay)
    .sort((a, b) => {
      if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
      return sortByVisualPriority(a, b);
    });

  const singleDayByIso = new Map<string, ParsedEvent[]>();
  for (const day of inMonthDays) {
    singleDayByIso.set(day.iso, []);
  }
  for (const evt of singleDayEvents) {
    singleDayByIso.get(evt.startDate)?.push(evt);
  }
  for (const [iso, bucket] of singleDayByIso.entries()) {
    singleDayByIso.set(iso, bucket.sort(sortByVisualPriority));
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

  const occupiedMultiLanesByDay = new Map<string, Set<number>>();
  for (const day of inMonthDays) {
    occupiedMultiLanesByDay.set(day.iso, new Set<number>());
  }
  for (const seg of segments) {
    const lane = Math.max(0, seg.row - 1);
    for (let col = seg.startCol; col <= seg.endCol; col += 1) {
      const day = dayInfos[col - 1];
      if (!day?.inMonth) continue;
      const occupied = occupiedMultiLanesByDay.get(day.iso);
      if (!occupied) continue;
      occupied.add(lane);
    }
  }

  const singleLaneByEventId = new Map<string, number>();
  let maxSingleLaneUsed = -1;
  for (const day of inMonthDays) {
    const dayEvents = singleDayByIso.get(day.iso) ?? [];
    const occupied = new Set(occupiedMultiLanesByDay.get(day.iso) ?? []);
    for (const event of dayEvents) {
      let lane = 0;
      while (occupied.has(lane)) {
        lane += 1;
      }
      occupied.add(lane);
      singleLaneByEventId.set(event.id, lane);
      maxSingleLaneUsed = Math.max(maxSingleLaneUsed, lane);
    }
  }

  const collectFreeLanes = (usedLanes: Set<number>, count: number) => {
    const lanes: number[] = [];
    let lane = 0;
    while (lanes.length < count) {
      if (!usedLanes.has(lane)) {
        lanes.push(lane);
      }
      lane += 1;
    }
    return lanes;
  };

  const maxMultiRows = segments.reduce((acc, seg) => Math.max(acc, seg.row), 0);
  const maxMultiLaneUsed = maxMultiRows > 0 ? maxMultiRows - 1 : -1;
  const maxLaneUsedInMonth = Math.max(maxMultiLaneUsed, maxSingleLaneUsed);
  const rowsForHeightTotal = Math.max(
    MONTH_MIN_TOTAL_EVENT_ROWS_BEFORE_GROWTH,
    maxLaneUsedInMonth + 1
  );
  const hasAnyMultiDayInMonth = maxMultiRows > 0;
  const eventsTopOffset = Math.max(
    hasAnyMultiDayInMonth
      ? MONTH_MULTI_DAY_TOP_OFFSET_PX
      : MONTH_SINGLE_DAY_TOP_OFFSET_NO_MULTI_PX,
    MONTH_EVENTS_MIN_TOP_OFFSET_PX
  );
  const eventBandHeightPx =
    rowsForHeightTotal * EVENT_ITEM_HEIGHT_PX +
    Math.max(0, rowsForHeightTotal - 1) * EVENT_ITEM_GAP_PX;
  const contentHeight =
    eventsTopOffset + eventBandHeightPx + MONTH_ROW_BOTTOM_PADDING_PX;
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

  const resolveDayAnchorPoint = (iso: string): AnchorPoint | undefined => {
    const node = daysGridRef.current?.querySelector<HTMLElement>(
      `[data-day-cell][data-day-iso="${iso}"]`
    );
    if (!node) return undefined;
    const rect = node.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
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
    <div className="flex items-stretch border-b border-border/65 last:border-b-0">
      <div
        className="flex w-11 flex-none items-start justify-start border-r border-border/60 bg-muted/45 px-2 py-3 text-muted-foreground md:w-12"
        style={{ minHeight: `${minHeightPx}px` }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{monthLabel}</span>
      </div>

      <div
        className="relative w-full flex-1 bg-card/40"
        onDragOver={(e) => {
          const dragPayload = readCalendarEventDndPayload(e.dataTransfer);
          const hasTransferType = hasCalendarEventDndPayloadType(e.dataTransfer);
          const hasAppDrag = Boolean(dragPayload || hasTransferType || hasDragContext);
          if (!hasAppDrag) return;
          e.preventDefault();
          e.stopPropagation();

          const targetDate = resolveTargetDateFromPointer(e.clientX);
          if (!targetDate) return;
          onDayHover(format(targetDate, "yyyy-MM-dd"));
          clearReorderTarget();
        }}
        onDrop={(e) => {
          const dragPayload = readCalendarEventDndPayload(e.dataTransfer);
          const hasTransferType = hasCalendarEventDndPayloadType(e.dataTransfer);
          const hasAppDrag = Boolean(dragPayload || hasTransferType || hasDragContext);
          if (!hasAppDrag) return;
          e.preventDefault();
          e.stopPropagation();

          const targetDate = resolveTargetDateFromPointer(e.clientX);
          if (!targetDate) return;
          onDayDrop(format(targetDate, "yyyy-MM-dd"), e.dataTransfer);
        }}
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
          const targetIso = format(targetDate, "yyyy-MM-dd");
          onFinishCreateRange(
            targetIso,
            resolveDayAnchorPoint(targetIso) ?? {
              x: e.clientX,
              y: e.clientY,
            }
          );
        }}
      >
        <div
          ref={daysGridRef}
          className="grid w-full"
          style={{ gridTemplateColumns: "repeat(37, minmax(0, 1fr))" }}
        >
          {dayInfos.map((day) => (
            <div key={`${monthIndex}-${day.col}`} className="border-l border-border">
              <DayCell
                date={day.date}
                dateIso={day.iso}
                todayIso={todayIso}
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
                className="rounded-sm bg-foreground/10 ring-1 ring-inset ring-border"
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
              paddingTop: `${eventsTopOffset}px`,
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
                  todayIso={todayIso}
                  onClick={({ anchorPoint }) =>
                    onEditEvent({
                      eventId: seg.event.id,
                      sourceEventId: seg.event.sourceEventId,
                      anchorPoint,
                    })
                  }
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
                      sourceEventId: seg.event.sourceEventId,
                      startDate: seg.event.startDate,
                      endDate: seg.event.endDate,
                      recurrenceType: seg.event.recurrenceType,
                      grabOffsetDays,
                      isMultiDay: true,
                    });
                    onEventDragStart({
                      eventId: seg.event.id,
                      sourceEventId: seg.event.sourceEventId,
                      startDate: seg.event.startDate,
                      endDate: seg.event.endDate,
                      recurrenceType: seg.event.recurrenceType,
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
                className={`${EVENT_ITEM_RADIUS_CLASS} pointer-events-none z-20 bg-foreground/12 ring-1 ring-border/90`}
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

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[9]">
          <div
            className="grid"
            style={{ gridTemplateColumns: "repeat(37, minmax(0, 1fr))" }}
          >
            {dayInfos.map((day) => {
              if (!day.inMonth) return null;
              const dayEvents = singleDayByIso.get(day.iso) ?? [];
              const draggedEventId = dragState.draggingEventId;
              const occupiedMultiLanes = occupiedMultiLanesByDay.get(day.iso) ?? new Set<number>();
              const getSingleLane = (eventId: string) => singleLaneByEventId.get(eventId) ?? 0;

              const previewIndex =
                dragState.reorderTarget?.dayIso === day.iso
                  ? dragState.reorderTarget.insertIndex
                  : null;
              const showMoveGhost =
                draggingSingleDay &&
                dragState.hoverDateIso === day.iso &&
                sourceDayIso !== null &&
                sourceDayIso !== day.iso &&
                previewIndex === null;

              let previewLane: number | null = null;
              if (previewIndex !== null) {
                const baseEvents = dayEvents.filter((event) => event.id !== draggedEventId);
                const usedForInsert = new Set<number>(occupiedMultiLanes);
                for (const event of baseEvents) {
                  usedForInsert.add(getSingleLane(event.id));
                }
                const insertLanes = collectFreeLanes(usedForInsert, baseEvents.length + 1);
                const clampedIndex = Math.max(0, Math.min(previewIndex, baseEvents.length));
                previewLane = insertLanes[clampedIndex] ?? null;
              }

              let moveGhostLane: number | null = null;
              if (showMoveGhost) {
                const usedForGhost = new Set<number>(occupiedMultiLanes);
                for (const event of dayEvents) {
                  if (event.id === draggedEventId) continue;
                  usedForGhost.add(getSingleLane(event.id));
                }
                moveGhostLane = collectFreeLanes(usedForGhost, 1)[0] ?? 0;
              }

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
                    style={{
                      top: `${eventsTopOffset}px`,
                      minHeight: `${eventBandHeightPx}px`,
                    }}
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
                      if (isSingleDayDrag !== true) {
                        clearReorderTarget();
                        return;
                      }
                      const recurrenceType =
                        dragPayload?.recurrenceType ?? dragState.source?.recurrenceType;
                      if (recurrenceType) {
                        clearReorderTarget();
                        return;
                      }
                      const sourceDayIso =
                        dragPayload?.startDate ?? dragState.source?.startDate ?? null;
                      if (!sourceDayIso || sourceDayIso !== day.iso) {
                        clearReorderTarget();
                        return;
                      }

                      const baseEvents = dayEvents.filter((event) => event.id !== draggedEventId);
                      const usedForInsert = new Set<number>(occupiedMultiLanes);
                      for (const event of baseEvents) {
                        usedForInsert.add(getSingleLane(event.id));
                      }
                      const insertLanes = collectFreeLanes(usedForInsert, baseEvents.length + 1);
                      if (!insertLanes.length) {
                        clearReorderTarget();
                        return;
                      }

                      const rect = e.currentTarget.getBoundingClientRect();
                      const relativeY = Math.max(0, e.clientY - rect.top);
                      const hoveredLane = Math.max(
                        0,
                        Math.floor((relativeY + EVENT_ROW_STEP / 2) / EVENT_ROW_STEP)
                      );
                      let insertIndex = 0;
                      let bestDistance = Number.POSITIVE_INFINITY;
                      for (let i = 0; i < insertLanes.length; i += 1) {
                        const distance = Math.abs(insertLanes[i] - hoveredLane);
                        if (distance < bestDistance) {
                          bestDistance = distance;
                          insertIndex = i;
                        }
                      }
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
                    <div className="relative" style={{ minHeight: `${eventBandHeightPx}px` }}>
                      {previewLane !== null ? (
                        <div
                          className="absolute inset-x-0 z-0"
                          style={{ top: `${previewLane * EVENT_ROW_STEP}px` }}
                        >
                          <div
                            className={`${EVENT_ITEM_RADIUS_CLASS} bg-foreground/10 ring-1 ring-border/80`}
                            style={{ minHeight: `${EVENT_ITEM_HEIGHT_PX}px` }}
                          />
                        </div>
                      ) : null}
                      {dayEvents.map((event) => {
                        const isDragged = event.id === draggedEventId;
                        const lane = getSingleLane(event.id);
                        return (
                          <div
                            key={`single-${day.iso}-${event.id}`}
                            className="absolute inset-x-0 z-10 pointer-events-auto"
                            style={{ top: `${lane * EVENT_ROW_STEP}px` }}
                          >
                            <EventBar
                              event={event}
                              todayIso={todayIso}
                              onClick={({ anchorPoint }) =>
                                onEditEvent({
                                  eventId: event.id,
                                  sourceEventId: event.sourceEventId,
                                  anchorPoint,
                                })
                              }
                              draggable
                              isDragging={isDragged}
                              className={
                                isDragged
                                  ? "opacity-40"
                                  : draggingSingleDay
                                    ? "pointer-events-none"
                                    : ""
                              }
                              onDragStart={(e) => {
                                writeCalendarEventDndPayload(e.dataTransfer, {
                                  eventId: event.id,
                                  sourceEventId: event.sourceEventId,
                                  startDate: event.startDate,
                                  endDate: event.endDate,
                                  recurrenceType: event.recurrenceType,
                                  grabOffsetDays: 0,
                                  isMultiDay: false,
                                });
                                onEventDragStart({
                                  eventId: event.id,
                                  sourceEventId: event.sourceEventId,
                                  startDate: event.startDate,
                                  endDate: event.endDate,
                                  recurrenceType: event.recurrenceType,
                                  grabOffsetDays: 0,
                                  isMultiDay: false,
                                });
                              }}
                              onDragEnd={onEventDragEnd}
                            />
                          </div>
                        );
                      })}
                      {showMoveGhost && moveGhostLane !== null ? (
                        <div
                          className={`absolute inset-x-0 z-20 ${EVENT_ITEM_RADIUS_CLASS} pointer-events-none bg-foreground/12 ring-1 ring-border/90`}
                          style={{
                            top: `${moveGhostLane * EVENT_ROW_STEP}px`,
                            minHeight: `${EVENT_ITEM_HEIGHT_PX}px`,
                          }}
                        />
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
