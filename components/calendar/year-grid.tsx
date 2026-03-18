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
import { useStore, type CalendarViewMode } from "@/lib/store";
import { buildMultiDaySlotMap } from "@/lib/calendar-slotting";
import { readCalendarEventDndPayload } from "@/lib/calendar-dnd";
import {
  compareEventsByVisualPriority,
  isRenderableEventDateRange,
  isSingleDayEvent,
} from "@/lib/event-order";
import { cn } from "@/lib/utils";
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
type MonthGroup = {
  key: string;
  monthIndices: MonthIndex[];
};

const VIEW_MODE_OPTIONS: Array<{ value: CalendarViewMode; label: string }> = [
  { value: "year", label: "Ano" },
  { value: "quarter", label: "Trimestre" },
  { value: "month", label: "Mes" },
];

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
}) {
  const categories = useStore((s) => s.categories as CategoryItem[]);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const viewMode = useStore((s) => s.viewMode);
  const focusedQuarter = useStore((s) => s.focusedQuarter);
  const focusedMonth = useStore((s) => s.focusedMonth);
  const setCalendarViewMode = useStore((s) => s.setCalendarViewMode);
  const focusQuarter = useStore((s) => s.focusQuarter);
  const focusMonth = useStore((s) => s.focusMonth);
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

  const handleModeChange = React.useCallback(
    (mode: CalendarViewMode) => {
      if (mode === "year") {
        setCalendarViewMode("year");
        return;
      }

      if (mode === "quarter") {
        focusQuarter(resolvedQuarter);
        return;
      }

      const nextMonth =
        focusedMonth ??
        (focusedQuarter !== null
          ? ((focusedQuarter * 3) as MonthIndex)
          : currentMonthIndex);
      focusMonth(nextMonth);
    },
    [
      currentMonthIndex,
      focusMonth,
      focusQuarter,
      focusedMonth,
      focusedQuarter,
      resolvedQuarter,
      setCalendarViewMode,
    ]
  );

  const handleOpenQuarter = React.useCallback(
    (monthIndex: MonthIndex) => {
      focusQuarter(getQuarterFromMonth(monthIndex));
    },
    [focusQuarter]
  );

  const handleOpenMonth = React.useCallback(
    (monthIndex: MonthIndex) => {
      focusMonth(monthIndex);
    },
    [focusMonth]
  );

  const monthGroups = React.useMemo<MonthGroup[]>(() => {
    if (viewMode === "year") {
      return QUARTER_MONTH_GROUPS.map((months, quarterIndex) => ({
        key: `quarter-${quarterIndex}`,
        monthIndices: [...months] as MonthIndex[],
      }));
    }

    if (viewMode === "quarter") {
      return [
        {
          key: `quarter-focus-${resolvedQuarter}`,
          monthIndices: [...QUARTER_MONTH_GROUPS[resolvedQuarter]] as MonthIndex[],
        },
      ];
    }

    return [
      {
        key: `month-focus-${resolvedMonth}`,
        monthIndices: [resolvedMonth],
      },
    ];
  }, [resolvedMonth, resolvedQuarter, viewMode]);

  const density = viewMode;
  const canvasWidthClass =
    viewMode === "year"
      ? "min-w-[48rem] min-[420px]:min-w-[54rem] md:min-w-0"
      : viewMode === "quarter"
        ? "min-w-[42rem] min-[420px]:min-w-[46rem] md:min-w-0"
        : "min-w-[36rem] min-[420px]:min-w-[40rem] md:min-w-0";
  const contextTitle =
    viewMode === "year"
      ? "Ano inteiro"
      : viewMode === "quarter"
        ? QUARTER_LABELS[resolvedQuarter]
        : `${MONTH_TITLE_LABELS[resolvedMonth]} ${year}`;
  const contextDescription =
    viewMode === "year"
      ? "12 meses no mesmo plano, com agrupamento mais leve e leitura mais calma."
      : viewMode === "quarter"
        ? "Tres meses ampliados no mesmo eixo do calendario anual."
        : "Um unico mes ampliado, com o mesmo DNA visual do ano.";
  const focusMeta =
    viewMode === "year"
      ? "Visao principal"
      : viewMode === "quarter"
        ? "3 meses em foco"
        : "Mes em foco";

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-[1.75rem] border border-border/75 bg-card/94 shadow-[0_14px_28px_-22px_rgba(15,23,42,0.16),0_34px_72px_-54px_rgba(15,23,42,0.18)] backdrop-blur-sm",
        canvasWidthClass
      )}
    >
      <div className="border-b border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(250,250,250,0.72))] px-3 py-3 dark:bg-[linear-gradient(180deg,rgba(30,30,32,0.92),rgba(24,24,26,0.76))] sm:px-4 sm:py-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {focusMeta}
            </p>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 className="text-sm font-semibold text-foreground sm:text-base">
                {contextTitle}
              </h2>
              <p className="text-xs text-muted-foreground sm:text-[13px]">
                {contextDescription}
              </p>
            </div>
          </div>

          <div
            className="inline-flex w-full items-center rounded-full border border-border/80 bg-background/88 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] sm:w-auto"
            role="tablist"
            aria-label="Modo de foco do calendario"
          >
            {VIEW_MODE_OPTIONS.map((option) => {
              const isActive = option.value === viewMode;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleModeChange(option.value)}
                  className={cn(
                    "flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 sm:flex-none sm:px-3.5",
                    isActive
                      ? "bg-foreground text-background shadow-[0_12px_24px_-18px_rgba(15,23,42,0.4)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "p-2.5 sm:p-3.5",
          viewMode === "year" ? "space-y-3 sm:space-y-4" : "space-y-0"
        )}
      >
        {monthGroups.map((group) => (
          <section
            key={group.key}
            className={cn(
              "overflow-hidden rounded-[1.55rem] border border-border/70 transition-[background-color,box-shadow] duration-150",
              viewMode === "year"
                ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(248,248,249,0.92))] p-1.5 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.18)] dark:bg-[linear-gradient(180deg,rgba(34,34,36,0.9),rgba(27,27,29,0.96))]"
                : "bg-[linear-gradient(180deg,rgba(255,255,255,0.8),rgba(249,249,250,0.95))] p-2 shadow-[0_22px_50px_-40px_rgba(15,23,42,0.2)] dark:bg-[linear-gradient(180deg,rgba(33,33,35,0.92),rgba(26,26,28,0.98))] sm:p-2.5"
            )}
          >
            <div className="overflow-hidden rounded-[1.22rem] border border-white/40 dark:border-white/6">
              {group.monthIndices.map((monthIndex) => (
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
                  onDrilldown={
                    viewMode === "year"
                      ? () => handleOpenQuarter(monthIndex)
                      : viewMode === "quarter"
                        ? () => handleOpenMonth(monthIndex)
                        : undefined
                  }
                  drilldownLabel={
                    viewMode === "year"
                      ? `Abrir ${QUARTER_LABELS[getQuarterFromMonth(monthIndex)]}`
                      : viewMode === "quarter"
                        ? `Abrir ${MONTH_TITLE_LABELS[monthIndex]}`
                        : undefined
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
