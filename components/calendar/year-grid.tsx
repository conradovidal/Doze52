"use client";

import * as React from "react";
import { AnimatePresence, m } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  differenceInCalendarDays,
  endOfYear,
  format,
  parseISO,
  startOfYear,
} from "date-fns";
import type {
  AnchorPoint,
  CalendarProfile,
  CalendarRenderEvent,
  CategoryItem,
} from "@/lib/types";
import { useStore, type CalendarViewMode } from "@/lib/store";
import { DEFAULT_PROFILE_ICON, type ProfileIconId } from "@/lib/profile-icons";
import { buildMultiDaySlotMap } from "@/lib/calendar-slotting";
import { readCalendarEventDndPayload } from "@/lib/calendar-dnd";
import {
  compareEventsByVisualPriority,
  isRenderableEventDateRange,
  isSingleDayEvent,
} from "@/lib/event-order";
import { cn } from "@/lib/utils";
import { getYearTransitionDirection } from "@/lib/calendar-year-transition";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  GuidedToolbarNoticeCard,
  type GuidedToolbarNotice,
} from "@/components/onboarding/guided-toolbar-notice";
import { GuidedTargetOutline } from "@/components/onboarding/guided-target-outline";
import {
  LATERAL_KEY_ACTIVE_CLASS,
  LATERAL_KEY_BASE_CLASS,
  LATERAL_KEY_REST_CLASS,
} from "./lateral-key-styles";
import { MonthRow } from "./month-row";
import type { DayCellHabitPresentation } from "./day-cell";

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
const CALENDAR_VERTICAL_ZOOM_MAX_PERCENT = 140;

const CALENDAR_VIEW_OPTIONS = [
  { value: "year", label: "Ano" },
  { value: "quarter", label: "Trimestre" },
  { value: "month", label: "Mês" },
] as const satisfies ReadonlyArray<{
  value: CalendarViewMode;
  label: string;
}>;

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
  focusedRenderEventId,
  creatingRange,
  guidedSelectionRange,
  onStartCreateRange,
  onHoverCreateRange,
  onFinishCreateRange,
  onMoveEventByDelta,
  onApplyDayReorder,
  isMobileInteractionMode = false,
  habitPresentation,
  onYearChange,
  guidedYearNotice,
  onDismissGuidedYearNotice,
  onGuidedYearAction,
  guidedPeriodNotice,
  onDismissGuidedPeriodNotice,
  onGuidedPeriodAction,
  onGuidedPeriodInteraction,
  guidedPeriodInteracted = false,
  showScaleControl = true,
}: {
  year: number;
  todayIso: string;
  events: CalendarRenderEvent[];
  onEditEvent: (payload: {
    eventId: string;
    sourceEventId: string;
    anchorPoint: AnchorPoint;
  }) => void;
  focusedRenderEventId?: string | null;
  creatingRange: { startIso: string; hoverIso: string; isDragging: boolean } | null;
  guidedSelectionRange?: { startDate: string; endDate: string } | null;
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
  habitPresentation?: DayCellHabitPresentation;
  onYearChange: (year: number) => void;
  guidedYearNotice?: GuidedToolbarNotice | null;
  onDismissGuidedYearNotice?: () => void;
  onGuidedYearAction?: () => void;
  guidedPeriodNotice?: GuidedToolbarNotice | null;
  onDismissGuidedPeriodNotice?: () => void;
  onGuidedPeriodAction?: () => void;
  onGuidedPeriodInteraction?: () => void;
  guidedPeriodInteracted?: boolean;
  showScaleControl?: boolean;
}) {
  const profiles = useStore((s) => s.profiles as CalendarProfile[]);
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
  const [yearDirection, setYearDirection] = React.useState<1 | -1>(1);
  const [isYearTransitioning, setIsYearTransitioning] = React.useState(false);
  const guidedYearLocked = guidedYearNotice?.target === "year";
  const requestYearChange = React.useCallback(
    (nextYear: number) => {
      if (guidedYearLocked || isYearTransitioning || nextYear === year) return;
      setYearDirection(getYearTransitionDirection(year, nextYear));
      setIsYearTransitioning(true);
      onYearChange(nextYear);
    },
    [guidedYearLocked, isYearTransitioning, onYearChange, year]
  );
  const visibleCategoryIds = React.useMemo(
    () => {
      const selectedProfiles = new Set(selectedProfileIds);
      return categories
        .filter((category) => category.visible && selectedProfiles.has(category.profileId))
        .map((category) => category.id);
    },
    [categories, selectedProfileIds]
  );
  const profileIconByCategoryId = React.useMemo(() => {
    const iconByProfileId = new Map<string, ProfileIconId>(
      profiles.map((profile) => [profile.id, profile.icon])
    );
    return new Map<string, ProfileIconId>(
      categories.map((category) => [
        category.id,
        iconByProfileId.get(category.profileId) ?? DEFAULT_PROFILE_ICON,
      ])
    );
  }, [categories, profiles]);
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
      habitPresentation
        ? []
        : events.filter(
            (event) =>
              visibleCategoryIds.includes(event.categoryId) &&
              isRenderableEventDateRange(event)
          ),
    [events, habitPresentation, visibleCategoryIds]
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
      if (guidedPeriodNotice?.target === "period-navigation") {
        onGuidedPeriodInteraction?.();
      }
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
    [focusQuarter, guidedPeriodNotice?.target, onGuidedPeriodInteraction, resolvedQuarter, setCalendarViewMode, viewMode]
  );

  const handleMonthLabelClick = React.useCallback(
    (monthIndex: MonthIndex) => {
      if (guidedPeriodNotice?.target === "period-navigation") {
        onGuidedPeriodInteraction?.();
      }
      if (viewMode === "month" && monthIndex === resolvedMonth) {
        focusQuarter(resolvedQuarter);
        return;
      }
      focusMonth(monthIndex);
    },
    [focusMonth, focusQuarter, guidedPeriodNotice?.target, onGuidedPeriodInteraction, resolvedMonth, resolvedQuarter, viewMode]
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
  const verticalZoomPercent = hasFocusZoom
    ? Math.round(
        CALENDAR_ZOOM_MIN_PERCENT +
          ((effectiveZoomPercent - CALENDAR_ZOOM_MIN_PERCENT) /
            (CALENDAR_ZOOM_MAX_PERCENT - CALENDAR_ZOOM_MIN_PERCENT)) *
            (CALENDAR_VERTICAL_ZOOM_MAX_PERCENT - CALENDAR_ZOOM_MIN_PERCENT)
      )
    : CALENDAR_ZOOM_MIN_PERCENT;
  const verticalZoomScale = verticalZoomPercent / CALENDAR_ZOOM_MIN_PERCENT;

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

  const handleViewModeChange = React.useCallback(
    (nextMode: CalendarViewMode) => {
      if (nextMode === "year") {
        setCalendarViewMode("year");
      } else if (nextMode === "quarter") {
        focusQuarter(resolvedQuarter);
      } else {
        focusMonth(currentMonthIndex);
      }
    }, [currentMonthIndex, focusMonth, focusQuarter, resolvedQuarter, setCalendarViewMode]
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

      const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      if (maxScrollLeft <= 1) return;

      const horizontalDelta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.shiftKey
            ? event.deltaY
            : 0;
      if (horizontalDelta === 0) return;

      const nextScrollLeft = Math.max(
        0,
        Math.min(maxScrollLeft, viewport.scrollLeft + horizontalDelta)
      );
      if (nextScrollLeft === viewport.scrollLeft) return;

      event.preventDefault();
      viewport.scrollLeft = nextScrollLeft;
    },
    [creatingRange?.isDragging, hasDragContext, hasFocusZoom]
  );

  const annualContent = (
    <div className="relative overflow-hidden">
      {guidedPeriodNotice?.target === "period-navigation" ? (
        <div
          data-onboarding-period-anchor
          data-onboarding-period-outline={!guidedPeriodInteracted ? "true" : undefined}
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-[60] w-[5.05rem] rounded-l-[1.25rem] min-[420px]:w-[5.1rem] md:w-[5.5rem]",
            !guidedPeriodInteracted && "border border-foreground/32"
          )}
          aria-hidden="true"
        />
      ) : null}
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
            className="relative flex items-stretch border-b border-border/70 last:border-b-0"
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
                "h-auto self-stretch w-[1.95rem] shrink-0 border-r border-border px-0 min-[420px]:w-[2.1rem] md:w-[2.25rem]",
                quarterRailShapeClass,
                isQuarterSelected ? LATERAL_KEY_ACTIVE_CLASS : LATERAL_KEY_REST_CLASS
              )}
              data-onboarding-period-control={
                guidedPeriodNotice?.target === "period-navigation" ? "true" : undefined
              }
            >
              <span
                className="block -rotate-90 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.04em] min-[420px]:text-[10.5px] md:text-[11px]"
              >
                {QUARTER_SHORT_LABELS[group.quarterIndex]}
              </span>
            </button>
            {isFirstVisibleGroup &&
            guidedPeriodNotice?.target === "period-navigation" &&
            onDismissGuidedPeriodNotice ? (
              <GuidedToolbarNoticeCard
                notice={guidedPeriodNotice}
                onClose={onDismissGuidedPeriodNotice}
                onAction={onGuidedPeriodAction}
                placement="viewport"
                portaled
                anchorSelector="[data-onboarding-period-anchor]"
                anchorPlacement="right-center"
              />
            ) : null}

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
                    verticalScale={verticalZoomScale}
                    events={habitPresentation ? [] : events}
                    visibleCategoryIds={visibleCategoryIds}
                    profileIconByCategoryId={profileIconByCategoryId}
                    multiDaySlotById={multiDaySlotById}
                    dragState={dragState}
                    hasDragContext={hasDragContext}
                    onEditEvent={onEditEvent}
                    focusedRenderEventId={focusedRenderEventId}
                    creatingRange={creatingRange}
                    guidedSelectionRange={guidedSelectionRange}
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
                    monthLabelHighlighted={false}
                    isMobileInteractionMode={isMobileInteractionMode}
                    onDayCellActivate={
                      isMobileInteractionMode && viewMode !== "month"
                        ? handleMobileDayCellActivate
                        : undefined
                    }
                    habitPresentation={habitPresentation}
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
      data-year-grid
      data-year-grid-surface={habitPresentation ? "habits" : "calendar"}
      className={cn(
        "w-full overflow-hidden rounded-[1.35rem] border border-border bg-card shadow-[0_18px_42px_-34px_rgba(15,23,42,0.24)]",
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
          <AnimatePresence initial={false} custom={yearDirection} mode="popLayout">
            <m.div
              key={year}
              custom={yearDirection}
              initial={{ opacity: 0, x: yearDirection * 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: yearDirection * -10 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className={cn(isYearTransitioning && "pointer-events-none")}
              onAnimationComplete={() => setIsYearTransitioning(false)}
            >
              {annualContent}
            </m.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-t border-border bg-card px-3 py-2.5 md:px-4 md:py-3">
        <span aria-hidden="true" />
        <div data-calendar-footer-center className="flex items-center justify-center gap-2 justify-self-center">
          <div
            data-calendar-year-stepper
            data-onboarding-highlighted={
              guidedYearNotice?.target === "year" ? "true" : undefined
            }
            className={cn(
              "relative inline-flex h-8 items-center overflow-visible rounded-[10px] border border-border bg-card"
            )}
          >
            <button
              type="button"
              data-onboarding-year-control
              aria-label={`Voltar para ${year - 1}`}
              title={`Voltar para ${year - 1}`}
              disabled={guidedYearLocked || isYearTransitioning}
              className="grid size-8 place-items-center rounded-[9px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-45"
              onClick={() => requestYearChange(year - 1)}
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span
              aria-label={`Ano ${year}`}
              aria-live="polite"
              className="min-w-11 text-center text-xs font-semibold tabular-nums text-foreground"
            >
              {year}
            </span>
            <button
              type="button"
              aria-label={`Avançar para ${year + 1}`}
              title={`Avançar para ${year + 1}`}
              disabled={guidedYearLocked || isYearTransitioning}
              className="grid size-8 place-items-center rounded-[9px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-45"
              onClick={() => requestYearChange(year + 1)}
            >
              <ChevronRight className="size-3.5" />
            </button>
            {guidedYearNotice?.target === "year" && onDismissGuidedYearNotice ? (
              <>
                <GuidedTargetOutline selector="[data-calendar-year-stepper]" />
                <GuidedToolbarNoticeCard
                  notice={guidedYearNotice}
                  onClose={onDismissGuidedYearNotice}
                  onAction={onGuidedYearAction}
                  placement="above"
                />
              </>
            ) : null}
          </div>
          {showScaleControl ? (
            <div data-calendar-scale-control>
              <SegmentedControl
                value={viewMode}
                options={CALENDAR_VIEW_OPTIONS}
                onValueChange={handleViewModeChange}
                aria-label={
                  habitPresentation ? "Escala dos hábitos" : "Escala do calendário"
                }
              />
            </div>
          ) : null}
        </div>
        {hasFocusZoom ? (
          <label className="flex w-[10.75rem] items-center justify-end justify-self-end gap-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground min-[420px]:w-[11.5rem] md:w-[12.25rem] max-[900px]:col-span-3 max-[900px]:row-start-2">
            <span className="shrink-0">Zoom</span>
            <input
              type="range"
              min={CALENDAR_ZOOM_MIN_PERCENT}
              max={CALENDAR_ZOOM_MAX_PERCENT}
              step={1}
              value={effectiveZoomPercent}
              onChange={handleZoomChange}
              aria-label="Zoom do calendário"
              aria-valuetext={`${effectiveZoomPercent}% na horizontal e ${verticalZoomPercent}% na vertical`}
              className="h-1.5 w-full cursor-ew-resize accent-foreground"
            />
            <span className="w-[2.75rem] shrink-0 text-right tabular-nums text-foreground/82">
              {effectiveZoomPercent}%
            </span>
          </label>
        ) : null}
      </div>
    </div>
  );
}
