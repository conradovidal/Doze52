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
import type { AnchorPoint, CalendarRenderEvent, CategoryItem } from "@/lib/types";
import { useStore } from "@/lib/store";
import { buildMultiDaySlotMap } from "@/lib/calendar-slotting";
import { readCalendarEventDndPayload } from "@/lib/calendar-dnd";
import {
  compareEventsByVisualPriority,
  isRenderableEventDateRange,
  isSingleDayEvent,
} from "@/lib/event-order";
import { cn } from "@/lib/utils";
import {
  LATERAL_KEY_ACTIVE_CLASS,
  LATERAL_KEY_BASE_CLASS,
  LATERAL_KEY_REST_CLASS,
} from "./lateral-key-styles";
import { MonthRow } from "./month-row";

type ReorderTarget = {
  dayIso: string;
  insertIndex: number;
};

type DragSource = {
  eventId: string;
  sourceEventId: string;
  startDate: string;
  endDate: string;
  recurrenceType?: "weekly" | "biweekly" | "monthly" | "yearly";
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

type QuarterIndex = 0 | 1 | 2 | 3;
type MonthIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
type QuarterGroup = {
  key: string;
  quarterIndex: QuarterIndex;
  monthIndices: MonthIndex[];
};

const CALENDAR_ZOOM_MIN_PERCENT = 100;
const CALENDAR_ZOOM_MAX_PERCENT = 180;

const QUARTER_MONTH_GROUPS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [9, 10, 11],
] as const satisfies readonly MonthIndex[][];

const QUARTER_LABELS = [
  "1o trimestre",
  "2o trimestre",
  "3o trimestre",
  "4o trimestre",
] as const;

const QUARTER_SHORT_LABELS = ["Q1", "Q2", "Q3", "Q4"] as const;

const MONTH_TITLE_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

const getQuarterFromMonth = (monthIndex: MonthIndex): QuarterIndex =>
  Math.floor(monthIndex / 3) as QuarterIndex;

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
  isMobileInteractionMode = false,
}: {
  year: number;
  todayIso: string;
  events: CalendarRenderEvent[];
  onEditEvent: (payload: {
    eventId: string;
    sourceEventId: string;
    anchorPoint: AnchorPoint;
  }) => void;
  creatingRange: { startIso: string; hoverIso: string; isDragging: boolean } | null;
  onStartCreateRange: (startIso: string) => void;
  onHoverCreateRange: (hoverIso: string) => void;
  onFinishCreateRange: (endIso?: string, anchorPoint?: AnchorPoint) => void;
  onMoveEventByDelta: (eventId: string, deltaDays: number) => void;
  onApplyDayReorder: (payload: {
    dayIso: string;
    eventId: string;
    toIndex: number;
    orderedIds: string[];
  }) => void;
  isMobileInteractionMode?: boolean;
}) {
  const categories = useStore((s) => s.categories as CategoryItem[]);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const viewMode = useStore((s) => s.viewMode);
  const focusedQuarter = useStore((s) => s.focusedQuarter);
  const focusedMonth = useStore((s) => s.focusedMonth);
  const calendarZoomPercent = useStore((s) => s.calendarZoomPercent);
  const setCalendarViewMode = useStore((s) => s.setCalendarViewMode);
  const focusQuarter = useStore((s) => s.focusQuarter);
  const focusMonth = useStore((s) => s.focusMonth);
  const setCalendarZoomPercent = useStore((s) => s.setCalendarZoomPercent);
  const visibleCategoryIds = React.useMemo(
    () => {
      const selectedProfiles = new Set(selectedProfileIds);
      return categories
        .filter((category) => category.visible && selectedProfiles.has(category.profileId))
        .map((category) => category.id);
    },
    [categories, selectedProfileIds]
  );
  const currentMonthIndex = React.useMemo(
    () => new Date().getMonth() as MonthIndex,
    []
  );
  const currentQuarterIndex = React.useMemo(
    () => getQuarterFromMonth(currentMonthIndex),
    [currentMonthIndex]
  );
  const resolvedQuarter = React.useMemo<QuarterIndex>(
    () =>
      focusedQuarter ??
      (focusedMonth !== null ? getQuarterFromMonth(focusedMonth) : currentQuarterIndex),
    [currentQuarterIndex, focusedMonth, focusedQuarter]
  );
  const resolvedMonth = React.useMemo<MonthIndex>(
    () =>
      focusedMonth ??
      (focusedQuarter !== null
        ? ((focusedQuarter * 3) as MonthIndex)
        : currentMonthIndex),
    [currentMonthIndex, focusedMonth, focusedQuarter]
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
  const zoomViewportRef = React.useRef<HTMLDivElement | null>(null);
  const pendingViewportRatioRef = React.useRef<number | null>(null);

  const visibleEvents = React.useMemo(
    () =>
      events.filter(
        (event) =>
          visibleCategoryIds.includes(event.categoryId) &&
          isRenderableEventDateRange(event)
      ),
    [events, visibleCategoryIds]
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
      sourceEventId: string;
      startDate: string;
      endDate: string;
      recurrenceType?: "weekly" | "biweekly" | "monthly" | "yearly";
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
      let currentSourceEventId: string | null = null;
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
        currentSourceEventId = transferPayload.sourceEventId;
      } else if (hasLiveState) {
        currentSource = dragState.source;
        currentEventId = dragState.draggingEventId;
        currentSourceEventId = dragState.source?.sourceEventId ?? null;
      } else if (hasSnapshot) {
        currentSource = dragSnapshotRef.current.source;
        currentEventId = dragSnapshotRef.current.draggingEventId;
        currentSourceEventId = dragSnapshotRef.current.source?.sourceEventId ?? null;
      }
      if (!currentSource || !currentEventId || !currentSourceEventId) {
        clearDragState();
        return;
      }

      if (
        !currentSource.isMultiDay &&
        !currentSource.recurrenceType &&
        currentSource.startDate === dropDateIso &&
        currentReorderTarget &&
        currentReorderTarget.dayIso === dropDateIso &&
        Number.isInteger(currentReorderTarget.insertIndex)
      ) {
        const inDayIds = visibleEvents
          .filter(
            (event) =>
              event.startDate === dropDateIso &&
              isSingleDayEvent(event) &&
              !event.recurrenceType
          )
          .sort(compareEventsByVisualPriority)
          .map((event) => event.sourceEventId);

        const withoutMoved = inDayIds.filter((id) => id !== currentSourceEventId);
        const insertAt = Math.max(
          0,
          Math.min(currentReorderTarget.insertIndex, withoutMoved.length)
        );
        withoutMoved.splice(insertAt, 0, currentSourceEventId);

        onApplyDayReorder({
          dayIso: dropDateIso,
          eventId: currentSourceEventId,
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

      onMoveEventByDelta(currentSourceEventId, deltaDays);
      didDropRef.current = true;
      clearDragState();
    },
    [
      clearDragState,
      dragState,
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

  const handleQuarterRailClick = React.useCallback(
    (quarterIndex: QuarterIndex) => {
      if (quarterIndex === resolvedQuarter && viewMode === "quarter") {
        setCalendarViewMode("year");
        return;
      }

      if (quarterIndex === resolvedQuarter && viewMode === "month") {
        focusQuarter(quarterIndex);
        return;
      }

      focusQuarter(quarterIndex);
    },
    [focusQuarter, resolvedQuarter, setCalendarViewMode, viewMode]
  );

  const handleMonthLabelClick = React.useCallback(
    (monthIndex: MonthIndex) => {
      if (viewMode === "month" && monthIndex === resolvedMonth) {
        focusQuarter(resolvedQuarter);
        return;
      }
      focusMonth(monthIndex);
    },
    [focusMonth, focusQuarter, resolvedMonth, resolvedQuarter, viewMode]
  );

  const handleMobileDayCellActivate = React.useCallback(
    ({ monthIndex }: { monthIndex: number; dateIso: string }) => {
      if (!isMobileInteractionMode || viewMode === "month") return;
      focusMonth(monthIndex as MonthIndex);
    },
    [focusMonth, isMobileInteractionMode, viewMode]
  );

  const quarterGroups = React.useMemo<QuarterGroup[]>(() => {
    if (viewMode === "year") {
      return QUARTER_MONTH_GROUPS.map((months, quarterIndex) => ({
        key: `quarter-${quarterIndex}`,
        quarterIndex: quarterIndex as QuarterIndex,
        monthIndices: [...months] as MonthIndex[],
      }));
    }

    if (viewMode === "quarter") {
      return [
        {
          key: `quarter-focus-${resolvedQuarter}`,
          quarterIndex: resolvedQuarter,
          monthIndices: [...QUARTER_MONTH_GROUPS[resolvedQuarter]] as MonthIndex[],
        },
      ];
    }

    return [
      {
        key: `month-focus-${resolvedMonth}`,
        quarterIndex: resolvedQuarter,
        monthIndices: [resolvedMonth],
      },
    ];
  }, [resolvedMonth, resolvedQuarter, viewMode]);

  const density = "year";
  const canvasWidthClass = "min-w-[49rem] min-[420px]:min-w-[55rem] md:min-w-0";
  const hasFocusZoom = viewMode !== "year";
  const effectiveZoomPercent = hasFocusZoom
    ? calendarZoomPercent
    : CALENDAR_ZOOM_MIN_PERCENT;

  const handleZoomChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextPercent = Number(event.target.value);
      const viewport = zoomViewportRef.current;
      if (viewport) {
        const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        pendingViewportRatioRef.current =
          maxScrollLeft > 0 ? viewport.scrollLeft / maxScrollLeft : 0;
      }
      setCalendarZoomPercent(nextPercent);
    },
    [setCalendarZoomPercent]
  );

  React.useLayoutEffect(() => {
    const viewport = zoomViewportRef.current;
    const pendingRatio = pendingViewportRatioRef.current;
    if (!viewport || pendingRatio === null) return;

    const rafId = window.requestAnimationFrame(() => {
      const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      viewport.scrollLeft = maxScrollLeft > 0 ? maxScrollLeft * pendingRatio : 0;
      pendingViewportRatioRef.current = null;
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [effectiveZoomPercent]);

  const handleViewportWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!hasFocusZoom || event.ctrlKey) return;
      if (hasDragContext || creatingRange?.isDragging) return;

      const viewport = zoomViewportRef.current;
      if (!viewport) return;

      const hasOverflow =
        viewport.scrollWidth - viewport.clientWidth > 1;
      if (!hasOverflow) return;

      const horizontalDelta =
        Math.abs(event.deltaX) > 0 ? event.deltaX : event.deltaY;
      if (horizontalDelta === 0) return;

      event.preventDefault();
      viewport.scrollLeft += horizontalDelta;
    },
    [creatingRange?.isDragging, hasDragContext, hasFocusZoom]
  );

  const annualContent = (
    <div className="overflow-hidden">
      {quarterGroups.map((group, groupIndex) => {
        const isActiveQuarter = viewMode !== "year" && group.quarterIndex === resolvedQuarter;
        const isQuarterSelected = isActiveQuarter;
        const isFirstVisibleGroup = groupIndex === 0;
        const isLastVisibleGroup = groupIndex === quarterGroups.length - 1;
        const quarterRailShapeClass =
          isFirstVisibleGroup && isLastVisibleGroup
            ? "rounded-l-[1.35rem]"
            : isFirstVisibleGroup
              ? "rounded-tl-[1.35rem]"
              : isLastVisibleGroup
                ? "rounded-bl-[1.35rem]"
                : "";
        return (
          <div
            key={group.key}
            className="flex items-stretch border-b border-border/70 last:border-b-0"
          >
            <button
              type="button"
              onClick={() => handleQuarterRailClick(group.quarterIndex)}
              aria-label={
                isActiveQuarter
                  ? viewMode === "quarter"
                    ? `Voltar para o ano inteiro a partir de ${QUARTER_LABELS[group.quarterIndex]}`
                    : `Mostrar ${QUARTER_LABELS[group.quarterIndex]}`
                  : `Abrir ${QUARTER_LABELS[group.quarterIndex]}`
              }
              aria-pressed={isActiveQuarter}
              title={QUARTER_LABELS[group.quarterIndex]}
              className={cn(
                LATERAL_KEY_BASE_CLASS,
                "h-auto self-stretch w-[1.95rem] shrink-0 border-r border-border/85 px-0 shadow-[inset_-1px_0_0_rgba(255,255,255,0.3)] min-[420px]:w-[2.1rem] md:w-[2.25rem] dark:shadow-[inset_-1px_0_0_rgba(255,255,255,0.05)]",
                quarterRailShapeClass,
                isQuarterSelected ? LATERAL_KEY_ACTIVE_CLASS : LATERAL_KEY_REST_CLASS
              )}
            >
              <span
                className="block -rotate-90 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.04em] min-[420px]:text-[10.5px] md:text-[11px]"
              >
                {QUARTER_SHORT_LABELS[group.quarterIndex]}
              </span>
            </button>

            <div className="min-w-0 flex-1">
              {group.monthIndices.map((monthIndex) => {
                const isActiveMonth = viewMode === "month" && monthIndex === resolvedMonth;
                return (
                  <MonthRow
                    key={monthIndex}
                    year={year}
                    todayIso={todayIso}
                    monthIndex={monthIndex}
                    density={density}
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
                    onMonthLabelClick={() => handleMonthLabelClick(monthIndex)}
                    monthLabelAriaLabel={
                      isActiveMonth
                        ? `Voltar para ${QUARTER_LABELS[group.quarterIndex]}`
                        : `Abrir ${MONTH_TITLE_LABELS[monthIndex]}`
                    }
                    monthLabelActive={isActiveMonth}
                    isMobileInteractionMode={isMobileInteractionMode}
                    onDayCellActivate={
                      isMobileInteractionMode && viewMode !== "month"
                        ? handleMobileDayCellActivate
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-[1.75rem] border border-border/75 bg-card/94 shadow-[0_14px_28px_-22px_rgba(15,23,42,0.16),0_34px_72px_-54px_rgba(15,23,42,0.18)] backdrop-blur-sm",
        canvasWidthClass
      )}
    >
      <div
        ref={zoomViewportRef}
        className={cn(
          "overflow-y-hidden",
          hasFocusZoom ? "overflow-x-auto overscroll-x-contain" : "overflow-x-hidden"
        )}
        onWheel={handleViewportWheel}
      >
        <div
          style={
            hasFocusZoom
              ? {
                  width: `${effectiveZoomPercent}%`,
                  minWidth: `${effectiveZoomPercent}%`,
                }
              : undefined
          }
        >
          {annualContent}
        </div>
      </div>

      {hasFocusZoom ? (
        <div className="flex justify-end border-t border-border/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.52),rgba(249,249,250,0.88))] px-3 py-2.5 dark:bg-[linear-gradient(180deg,rgba(31,31,35,0.72),rgba(22,22,25,0.96))] md:px-4 md:py-3">
          <label className="flex w-[10.75rem] items-center justify-end gap-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground min-[420px]:w-[11.5rem] md:w-[12.25rem]">
            <span className="shrink-0">Zoom</span>
            <input
              type="range"
              min={CALENDAR_ZOOM_MIN_PERCENT}
              max={CALENDAR_ZOOM_MAX_PERCENT}
              step={1}
              value={effectiveZoomPercent}
              onChange={handleZoomChange}
              aria-label="Zoom horizontal do calendario"
              className="h-1.5 w-full cursor-ew-resize accent-foreground"
            />
            <span className="w-[2.75rem] shrink-0 text-right tabular-nums text-foreground/82">
              {effectiveZoomPercent}%
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}
