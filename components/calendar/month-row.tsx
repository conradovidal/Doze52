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
import { cn } from "@/lib/utils";
import { DayCell } from "./day-cell";
import { EventBar } from "./event-bar";

const COLUMNS = 37;
const EVENT_ROW_STEP = EVENT_ITEM_HEIGHT_PX + EVENT_ITEM_GAP_PX;

type MonthRowDensity = "year" | "quarter" | "month";

const MONTH_LAYOUT_BY_DENSITY: Record<
  MonthRowDensity,
  {
    labelWidthClass: string;
    monthRowBaseMinHeightPx: number;
    monthMultiDayTopOffsetPx: number;
    monthSingleDayTopOffsetNoMultiPx: number;
    monthEventsMinTopOffsetPx: number;
    monthRowBottomPaddingPx: number;
  }
> = {
  year: {
    labelWidthClass:
      "w-[2.8rem] min-[420px]:w-[3rem] md:w-[3.25rem] md:px-2",
    monthRowBaseMinHeightPx: MONTH_ROW_BASE_MIN_HEIGHT_PX + 8,
    monthMultiDayTopOffsetPx: MONTH_MULTI_DAY_TOP_OFFSET_PX + 2,
    monthSingleDayTopOffsetNoMultiPx: MONTH_SINGLE_DAY_TOP_OFFSET_NO_MULTI_PX + 2,
    monthEventsMinTopOffsetPx: MONTH_EVENTS_MIN_TOP_OFFSET_PX + 4,
    monthRowBottomPaddingPx: MONTH_ROW_BOTTOM_PADDING_PX + 4,
  },
  quarter: {
    labelWidthClass:
      "w-[3.2rem] min-[420px]:w-[3.45rem] md:w-[3.8rem] md:px-3",
    monthRowBaseMinHeightPx: MONTH_ROW_BASE_MIN_HEIGHT_PX + 16,
    monthMultiDayTopOffsetPx: MONTH_MULTI_DAY_TOP_OFFSET_PX + 5,
    monthSingleDayTopOffsetNoMultiPx: MONTH_SINGLE_DAY_TOP_OFFSET_NO_MULTI_PX + 4,
    monthEventsMinTopOffsetPx: MONTH_EVENTS_MIN_TOP_OFFSET_PX + 8,
    monthRowBottomPaddingPx: MONTH_ROW_BOTTOM_PADDING_PX + 8,
  },
  month: {
    labelWidthClass:
      "w-[3.45rem] min-[420px]:w-[3.7rem] md:w-[4.1rem] md:px-3.5",
    monthRowBaseMinHeightPx: MONTH_ROW_BASE_MIN_HEIGHT_PX + 24,
    monthMultiDayTopOffsetPx: MONTH_MULTI_DAY_TOP_OFFSET_PX + 9,
    monthSingleDayTopOffsetNoMultiPx: MONTH_SINGLE_DAY_TOP_OFFSET_NO_MULTI_PX + 8,
    monthEventsMinTopOffsetPx: MONTH_EVENTS_MIN_TOP_OFFSET_PX + 12,
    monthRowBottomPaddingPx: MONTH_ROW_BOTTOM_PADDING_PX + 12,
  },
};

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
  density = "year",
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
  onMonthLabelClick,
  monthLabelAriaLabel,
  monthLabelActive = false,
  isFirstVisibleMonth = false,
  isLastVisibleMonth = false,
  isFilteredView = false,
}: {
  year: number;
  todayIso: string;
  monthIndex: number;
  density?: MonthRowDensity;
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
  onMonthLabelClick?: () => void;
  monthLabelAriaLabel?: string;
  monthLabelActive?: boolean;
  isFirstVisibleMonth?: boolean;
  isLastVisibleMonth?: boolean;
  isFilteredView?: boolean;
}) {
  const daysGridRef = React.useRef<HTMLDivElement | null>(null);
  const interactionSurfaceRef = React.useRef<HTMLDivElement | null>(null);
  const activeCreatePointerIdRef = React.useRef<number | null>(null);
  const monthStart = startOfMonth(new Date(year, monthIndex, 1));
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const layoutDensity = MONTH_LAYOUT_BY_DENSITY[density];

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
      ? layoutDensity.monthMultiDayTopOffsetPx
      : layoutDensity.monthSingleDayTopOffsetNoMultiPx,
    layoutDensity.monthEventsMinTopOffsetPx
  );
  const eventBandHeightPx =
    rowsForHeightTotal * EVENT_ITEM_HEIGHT_PX +
    Math.max(0, rowsForHeightTotal - 1) * EVENT_ITEM_GAP_PX;
  const contentHeight =
    eventsTopOffset + eventBandHeightPx + layoutDensity.monthRowBottomPaddingPx;
  const minHeightPx = Math.max(layoutDensity.monthRowBaseMinHeightPx, contentHeight);

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

  const resolveNearestInMonthIsoFromGrid = React.useCallback(
    (gridElement: HTMLElement, clientX: number) => {
      const rect = gridElement.getBoundingClientRect();
      if (rect.width <= 0) return null;

      const cells = Array.from(
        gridElement.querySelectorAll<HTMLElement>("[data-day-iso]")
      );
      if (!cells.length) return null;

      const clampedX = Math.max(0, Math.min(clientX - rect.left, rect.width - 1));
      const rawIndex = Math.floor((clampedX / rect.width) * cells.length);
      const startIndex = Math.max(0, Math.min(rawIndex, cells.length - 1));

      const resolveIsoAtIndex = (index: number) => {
        const node = cells[index];
        if (!node?.matches("[data-day-cell][data-day-iso]")) return null;
        return node.dataset.dayIso ?? null;
      };

      const directIso = resolveIsoAtIndex(startIndex);
      if (directIso) return directIso;

      for (let offset = 1; offset < cells.length; offset += 1) {
        const leftIndex = startIndex - offset;
        if (leftIndex >= 0) {
          const leftIso = resolveIsoAtIndex(leftIndex);
          if (leftIso) return leftIso;
        }

        const rightIndex = startIndex + offset;
        if (rightIndex < cells.length) {
          const rightIso = resolveIsoAtIndex(rightIndex);
          if (rightIso) return rightIso;
        }
      }

      return null;
    },
    []
  );

  const resolveRangeTargetIsoFromPointer = React.useCallback(
    (clientX: number, clientY: number) => {
      if (typeof document === "undefined") return null;

      const elements = document.elementsFromPoint(clientX, clientY);
      for (const element of elements) {
        if (!(element instanceof HTMLElement)) continue;
        const dayCell = element.closest<HTMLElement>("[data-day-cell][data-day-iso]");
        const iso = dayCell?.dataset.dayIso ?? null;
        if (iso) return iso;
      }

      for (const element of elements) {
        if (!(element instanceof HTMLElement)) continue;
        const surface = element.closest<HTMLElement>("[data-month-interaction-surface]");
        const gridElement = surface?.querySelector<HTMLElement>("[data-days-grid]") ?? null;
        if (!gridElement) continue;
        const iso = resolveNearestInMonthIsoFromGrid(gridElement, clientX);
        if (iso) return iso;
      }

      const surfaces = Array.from(
        document.querySelectorAll<HTMLElement>("[data-month-interaction-surface]")
      );
      if (!surfaces.length) return null;

      let nearestSurface: HTMLElement | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const surface of surfaces) {
        const rect = surface.getBoundingClientRect();
        const verticalDistance =
          clientY < rect.top
            ? rect.top - clientY
            : clientY > rect.bottom
              ? clientY - rect.bottom
              : 0;
        if (verticalDistance < nearestDistance) {
          nearestDistance = verticalDistance;
          nearestSurface = surface;
        }
      }

      const fallbackGrid =
        nearestSurface?.querySelector<HTMLElement>("[data-days-grid]") ?? null;
      if (!fallbackGrid) return null;
      return resolveNearestInMonthIsoFromGrid(fallbackGrid, clientX);
    },
    [resolveNearestInMonthIsoFromGrid]
  );

  const resolveTargetDateFromPointer = (clientX: number) => {
    const rect = daysGridRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    const relativeX = Math.max(0, Math.min(clientX - rect.left, rect.width - 1));
    const col = Math.floor((relativeX / rect.width) * COLUMNS);
    return gridDays[Math.max(0, Math.min(col, COLUMNS - 1))] ?? null;
  };

  const resolveDayAnchorPoint = React.useCallback((iso: string): AnchorPoint | undefined => {
    const node = daysGridRef.current?.querySelector<HTMLElement>(
      `[data-day-cell][data-day-iso="${iso}"]`
    );
    if (!node) return undefined;
    const rect = node.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }, []);

  const releaseCreatePointerCapture = React.useCallback(
    (surface: HTMLDivElement | null, pointerId: number) => {
      if (!surface?.hasPointerCapture(pointerId)) return;
      try {
        surface.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture may already be gone if the browser cancelled the gesture.
      }
    },
    []
  );

  const updateRangeHoverFromPointer = React.useCallback(
    (clientX: number, clientY: number) => {
      const targetIso = resolveRangeTargetIsoFromPointer(clientX, clientY);
      if (!targetIso) return;
      onHoverCreateRange(targetIso);
    },
    [onHoverCreateRange, resolveRangeTargetIsoFromPointer]
  );

  const finishRangeFromPointer = React.useCallback(
    (clientX: number, clientY: number) => {
      const targetIso = resolveRangeTargetIsoFromPointer(clientX, clientY);
      if (!targetIso) {
        onFinishCreateRange();
        return;
      }
      onFinishCreateRange(
        targetIso,
        resolveDayAnchorPoint(targetIso) ?? {
          x: clientX,
          y: clientY,
        }
      );
    },
    [onFinishCreateRange, resolveDayAnchorPoint, resolveRangeTargetIsoFromPointer]
  );

  const monthLabelShapeClass = isFilteredView
    ? isFirstVisibleMonth && isLastVisibleMonth
      ? "rounded-[0.55rem]"
      : isFirstVisibleMonth
        ? "rounded-t-[0.55rem] rounded-b-[0.16rem]"
        : isLastVisibleMonth
          ? "rounded-b-[0.55rem] rounded-t-[0.16rem]"
          : "rounded-[0.16rem]"
    : isFirstVisibleMonth && isLastVisibleMonth
      ? "rounded-[0.95rem]"
      : isFirstVisibleMonth
        ? "rounded-t-[0.95rem] rounded-b-[0.45rem]"
        : isLastVisibleMonth
          ? "rounded-b-[0.95rem] rounded-t-[0.45rem]"
          : "rounded-[0.45rem]";

  const monthLabelContainerPaddingClass = isFilteredView
    ? "px-px py-px"
    : "px-[3px] py-[3px]";

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
    <div className="flex items-stretch border-b border-border/70 last:border-b-0">
      <div
        className={cn(
          "flex flex-none items-center justify-center overflow-hidden border-r border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(244,244,245,0.92))] text-muted-foreground dark:bg-[linear-gradient(180deg,rgba(38,38,38,0.9),rgba(28,28,30,0.98))]",
          monthLabelContainerPaddingClass,
          layoutDensity.labelWidthClass
        )}
        style={{ minHeight: `${minHeightPx}px` }}
      >
        {onMonthLabelClick ? (
          <button
            type="button"
            onClick={onMonthLabelClick}
            aria-label={monthLabelAriaLabel ?? monthLabel}
            title={monthLabelAriaLabel ?? monthLabel}
            aria-pressed={monthLabelActive}
            className={cn(
              "group flex h-full w-full cursor-pointer select-none items-center justify-center border px-1 py-2.5 transition-[transform,background-color,color,box-shadow,border-color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40 active:translate-y-[1px] active:scale-[0.985]",
              monthLabelShapeClass,
              monthLabelActive
                ? "border-border/72 bg-background/30 text-foreground/88 shadow-[inset_0_0_0_1px_rgba(63,63,70,0.08)] hover:border-border/82 hover:bg-background/58 hover:text-foreground active:bg-background/30 dark:bg-background/22 dark:hover:bg-background/42 dark:shadow-[inset_0_0_0_1px_rgba(244,244,245,0.08)]"
                : "border-transparent text-foreground/72 hover:border-border/64 hover:bg-background/54 hover:text-foreground/90 active:bg-transparent dark:hover:bg-background/34"
            )}
          >
            <span className="text-[9.5px] font-medium uppercase tracking-[0.12em] min-[420px]:text-[10px] min-[420px]:tracking-[0.14em] md:text-[10.5px]">
              {monthLabel}
            </span>
          </button>
        ) : (
          <span className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-foreground/72 min-[420px]:text-[10px] min-[420px]:tracking-[0.14em] md:text-[10.5px]">
            {monthLabel}
          </span>
        )}
      </div>

      <div
        ref={interactionSurfaceRef}
        data-month-interaction-surface
        className="relative w-full flex-1 bg-card/55"
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
        onPointerDown={(e) => {
          if (!e.isPrimary || e.button !== 0 || isDraggingAny) return;
          const target = e.target as HTMLElement | null;
          if (target?.closest("button, a, input, textarea, select, [role='button']")) return;
          const targetIso = resolveRangeTargetIsoFromPointer(e.clientX, e.clientY);
          if (!targetIso) return;
          e.preventDefault();
          activeCreatePointerIdRef.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          onStartCreateRange(targetIso);
        }}
        onPointerMove={(e) => {
          if (activeCreatePointerIdRef.current !== e.pointerId || isDraggingAny) return;
          e.preventDefault();
          updateRangeHoverFromPointer(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (activeCreatePointerIdRef.current !== e.pointerId || isDraggingAny) return;
          e.preventDefault();
          activeCreatePointerIdRef.current = null;
          releaseCreatePointerCapture(e.currentTarget, e.pointerId);
          finishRangeFromPointer(e.clientX, e.clientY);
        }}
        onPointerCancel={(e) => {
          if (activeCreatePointerIdRef.current !== e.pointerId) return;
          activeCreatePointerIdRef.current = null;
          releaseCreatePointerCapture(e.currentTarget, e.pointerId);
          onFinishCreateRange();
        }}
        onLostPointerCapture={(e) => {
          if (activeCreatePointerIdRef.current !== e.pointerId) return;
          activeCreatePointerIdRef.current = null;
        }}
      >
        <div
          ref={daysGridRef}
          data-days-grid
          className="grid w-full"
          style={{ gridTemplateColumns: "repeat(37, minmax(0, 1fr))" }}
        >
          {dayInfos.map((day) => (
            <div
              key={`${monthIndex}-${day.col}`}
              className={
                day.inMonth
                  ? `border-l border-border/20 ${day.col === COLUMNS ? "border-r border-border/30" : ""}`
                  : ""
              }
            >
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
                className="rounded-md bg-foreground/8 ring-1 ring-inset ring-border/80"
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
                className={`${EVENT_ITEM_RADIUS_CLASS} pointer-events-none z-20 bg-foreground/8 ring-1 ring-border/80`}
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
                            className={`${EVENT_ITEM_RADIUS_CLASS} bg-foreground/8 ring-1 ring-border/75`}
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
                          className={`absolute inset-x-0 z-20 ${EVENT_ITEM_RADIUS_CLASS} pointer-events-none bg-foreground/8 ring-1 ring-border/80`}
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
