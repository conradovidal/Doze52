"use client";

import * as React from "react";
import {
  addDays,
  endOfYear,
  format,
  parseISO,
  startOfYear,
} from "date-fns";
import { useStore } from "@/lib/store";
import type { AnchorPoint, CalendarRenderEvent, CategoryItem } from "@/lib/types";
import {
  compareEventsByVisualPriority,
  isRenderableEventDateRange,
} from "@/lib/event-order";
import { getCategoryColorToken } from "@/lib/category-palette";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type MobileCalendarExperienceProps = {
  year: number;
  todayIso: string;
  events: CalendarRenderEvent[];
  activeDateIso: string;
  onActiveDateChange: (dateIso: string) => void;
  onYearChange: (year: number) => void;
  onEditEvent: (payload: {
    eventId: string;
    sourceEventId: string;
    anchorPoint: AnchorPoint;
  }) => void;
  guidedSelectionMode?: "date" | "period" | null;
  guidedRangeStart?: string | null;
  guidedSelectionRange?: { startDate: string; endDate: string } | null;
  onGuidedDaySelect?: (dateIso: string) => void;
  scrollToTodayRequestKey?: number;
};

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
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

const WEEKDAY_SHORT_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;
const DAY_ACTIVE_TOP_THRESHOLD = 12;
const TODAY_SCROLL_LEAD_DAYS = 3;

const toIsoDate = (date: Date) => format(date, "yyyy-MM-dd");

const getIsoYear = (dateIso: string) => Number(dateIso.slice(0, 4));

const getSafeDate = (dateIso: string, fallbackYear: number) => {
  const parsed = parseISO(dateIso);
  return Number.isNaN(parsed.getTime()) ? new Date(fallbackYear, 0, 1) : parsed;
};

const getYearDays = (year: number) => {
  const start = startOfYear(new Date(year, 0, 1));
  const end = endOfYear(start);
  const days: Date[] = [];
  let current = start;

  while (current <= end) {
    days.push(current);
    current = addDays(current, 1);
  }

  return days;
};

const getEventsForDay = (events: CalendarRenderEvent[], dayIso: string) =>
  events
    .filter((event) => event.startDate <= dayIso && event.endDate >= dayIso)
    .sort(compareEventsByVisualPriority);

const getEventAriaLabel = (event: CalendarRenderEvent, dayIso: string) => {
  if (event.startDate === event.endDate) return `Editar ${event.title}`;
  if (event.startDate === dayIso) return `Editar ${event.title}, comeca neste dia`;
  if (event.endDate === dayIso) return `Editar ${event.title}, termina neste dia`;
  return `Editar ${event.title}, continua neste dia`;
};

function MobileEventButton({
  event,
  dayIso,
  onEditEvent,
}: {
  event: CalendarRenderEvent;
  dayIso: string;
  onEditEvent: MobileCalendarExperienceProps["onEditEvent"];
}) {
  const { mode: themeMode } = useTheme();
  const colorToken = React.useMemo(
    () => getCategoryColorToken(event.color, themeMode),
    [event.color, themeMode]
  );

  return (
    <button
      type="button"
      data-calendar-event-id={event.sourceEventId}
      aria-label={getEventAriaLabel(event, dayIso)}
      className="block h-7 w-full overflow-hidden rounded-[8px] border text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.52)] transition-[transform,box-shadow,filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 hover:-translate-y-px hover:brightness-[0.99] hover:shadow-[0_10px_18px_-16px_rgba(15,23,42,0.32),inset_0_1px_0_rgba(255,255,255,0.62)]"
      style={{
        backgroundColor: colorToken.eventSoft,
        borderColor: colorToken.eventBorder,
        color: colorToken.text,
      }}
      onClick={(eventClick) => {
        const rect = eventClick.currentTarget.getBoundingClientRect();
        onEditEvent({
          eventId: event.id,
          sourceEventId: event.sourceEventId,
          anchorPoint: {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          },
        });
      }}
    >
      <span className="block min-w-0 truncate px-2.5 text-[12px] font-semibold leading-[26px]">
        {event.title}
      </span>
    </button>
  );
}

export function MobileCalendarExperience({
  year,
  todayIso,
  events,
  activeDateIso,
  onActiveDateChange,
  onYearChange,
  onEditEvent,
  guidedSelectionMode = null,
  guidedRangeStart = null,
  guidedSelectionRange = null,
  onGuidedDaySelect,
  scrollToTodayRequestKey = 0,
}: MobileCalendarExperienceProps) {
  const categories = useStore((s) => s.categories as CategoryItem[]);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const selectedProfiles = React.useMemo(
    () => new Set(selectedProfileIds),
    [selectedProfileIds]
  );
  const visibleCategoryIds = React.useMemo(
    () =>
      new Set(
        categories
          .filter(
            (category) =>
              category.visible && selectedProfiles.has(category.profileId)
          )
          .map((category) => category.id)
      ),
    [categories, selectedProfiles]
  );
  const visibleEvents = React.useMemo(
    () =>
      events.filter(
        (event) =>
          visibleCategoryIds.has(event.categoryId) &&
          isRenderableEventDateRange(event)
      ),
    [events, visibleCategoryIds]
  );
  const yearDays = React.useMemo(() => getYearDays(year), [year]);
  const monthGroups = React.useMemo(() => {
    const groups: { monthIndex: number; days: Date[] }[] = [];
    for (const day of yearDays) {
      const monthIndex = day.getMonth();
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.monthIndex === monthIndex) {
        lastGroup.days.push(day);
      } else {
        groups.push({ monthIndex, days: [day] });
      }
    }
    return groups;
  }, [yearDays]);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const activeDateRef = React.useRef(activeDateIso);
  const scrollAnimationFrameRef = React.useRef<number | null>(null);
  const programmaticScrollRef = React.useRef(false);

  React.useEffect(() => {
    activeDateRef.current = activeDateIso;
  }, [activeDateIso]);

  const setActiveFromDate = React.useCallback(
    (date: Date) => {
      const nextIso = toIsoDate(date);

      if (activeDateRef.current !== nextIso) {
        activeDateRef.current = nextIso;
        onActiveDateChange(nextIso);
      }

      const nextYear = date.getFullYear();
      if (nextYear !== year) {
        onYearChange(nextYear);
      }
    },
    [onActiveDateChange, onYearChange, year]
  );

  const cancelScrollAnimation = React.useCallback(() => {
    if (scrollAnimationFrameRef.current === null) return;

    window.cancelAnimationFrame(scrollAnimationFrameRef.current);
    scrollAnimationFrameRef.current = null;
    programmaticScrollRef.current = false;
  }, []);

  const scrollListTo = React.useCallback(
    (
      list: HTMLDivElement,
      targetTop: number,
      behavior: ScrollBehavior = "smooth"
    ) => {
      cancelScrollAnimation();

      const startTop = list.scrollTop;
      const delta = targetTop - startTop;
      const shouldReduceMotion =
        window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ??
        false;

      if (behavior === "auto" || shouldReduceMotion || Math.abs(delta) < 2) {
        list.scrollTop = targetTop;
        programmaticScrollRef.current = false;
        return;
      }

      const duration = Math.min(900, Math.max(360, Math.abs(delta) * 0.035));
      const startedAt = window.performance.now();
      const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;

      const step = (timestamp: number) => {
        const elapsed = timestamp - startedAt;
        const progress = Math.min(1, elapsed / duration);
        list.scrollTop = startTop + delta * easeOutCubic(progress);

        if (progress < 1) {
          scrollAnimationFrameRef.current = window.requestAnimationFrame(step);
          return;
        }

        list.scrollTop = targetTop;
        scrollAnimationFrameRef.current = null;
        programmaticScrollRef.current = false;
      };

      scrollAnimationFrameRef.current = window.requestAnimationFrame(step);
    },
    [cancelScrollAnimation]
  );

  React.useEffect(() => cancelScrollAnimation, [cancelScrollAnimation]);

  const scrollToDate = React.useCallback(
    (date: Date, behavior: ScrollBehavior = "smooth", leadDays = 0) => {
      const list = listRef.current;
      if (!list) return;

      const preferredIso = toIsoDate(
        leadDays > 0 ? addDays(date, -leadDays) : date
      );
      const fallbackIso = toIsoDate(date);
      const target =
        list.querySelector<HTMLElement>(
          `[data-mobile-day][data-date-iso="${preferredIso}"]`
        ) ??
        list.querySelector<HTMLElement>(
          `[data-mobile-day][data-date-iso="${fallbackIso}"]`
        );
      if (!target) return;

      setActiveFromDate(date);
      programmaticScrollRef.current = behavior !== "auto";
      const listRect = list.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      scrollListTo(
        list,
        Math.max(0, list.scrollTop + (targetRect.top - listRect.top)),
        behavior
      );
    },
    [scrollListTo, setActiveFromDate]
  );

  const handleTodayClick = React.useCallback(() => {
    if (!todayIso) return;

    const todayYear = getIsoYear(todayIso);
    if (todayYear !== year) {
      onActiveDateChange(todayIso);
      onYearChange(todayYear);
      return;
    }

    const today = getSafeDate(todayIso, year);
    scrollToDate(today, "smooth", TODAY_SCROLL_LEAD_DAYS);
  }, [onActiveDateChange, onYearChange, scrollToDate, todayIso, year]);

  const handledScrollToTodayRequestRef = React.useRef(0);
  React.useEffect(() => {
    if (
      scrollToTodayRequestKey <= 0 ||
      scrollToTodayRequestKey === handledScrollToTodayRequestRef.current
    ) {
      return;
    }
    handledScrollToTodayRequestRef.current = scrollToTodayRequestKey;
    handleTodayClick();
  }, [scrollToTodayRequestKey, handleTodayClick]);

  const syncActiveFromScroll = React.useCallback(() => {
    if (programmaticScrollRef.current) return;

    const list = listRef.current;
    if (!list) return;

    const anchorTop = list.scrollTop + DAY_ACTIVE_TOP_THRESHOLD;
    const listRect = list.getBoundingClientRect();
    const dayNodes = Array.from(
      list.querySelectorAll<HTMLElement>("[data-mobile-day]")
    );
    let activeNode: HTMLElement | null = null;

    for (const node of dayNodes) {
      const nodeRect = node.getBoundingClientRect();
      const nodeTop = Math.max(
        0,
        list.scrollTop + (nodeRect.top - listRect.top)
      );
      const nodeBottom = nodeTop + nodeRect.height;

      if (nodeTop <= anchorTop && nodeBottom > anchorTop) {
        activeNode = node;
        break;
      }
      if (!activeNode && nodeTop > anchorTop) {
        activeNode = node;
        break;
      }
    }

    const iso = activeNode?.dataset.dateIso;
    if (!iso) return;

    setActiveFromDate(getSafeDate(iso, year));
  }, [setActiveFromDate, year]);

  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    let frameId: number | null = null;
    let lastScrollTop = list.scrollTop;
    const requestSync = () => {
      if (frameId !== null) return;

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        syncActiveFromScroll();
      });
    };
    const scrollWatchId = window.setInterval(() => {
      const nextScrollTop = list.scrollTop;
      if (nextScrollTop === lastScrollTop) return;

      lastScrollTop = nextScrollTop;
      requestSync();
    }, 150);
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(requestSync, {
            root: list,
            threshold: 0,
          });

    syncActiveFromScroll();
    list.addEventListener("scroll", requestSync, { passive: true });
    list
      .querySelectorAll<HTMLElement>("[data-mobile-day]")
      .forEach((node) => observer?.observe(node));

    return () => {
      list.removeEventListener("scroll", requestSync);
      observer?.disconnect();
      window.clearInterval(scrollWatchId);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [syncActiveFromScroll, year]);

  React.useLayoutEffect(() => {
    const currentIso = activeDateRef.current;
    const initialDate =
      getIsoYear(currentIso) === year
        ? getSafeDate(currentIso, year)
        : new Date(year, 0, 1);

    scrollToDate(initialDate, "auto", TODAY_SCROLL_LEAD_DAYS);
    const frameId = window.requestAnimationFrame(() => {
      scrollToDate(initialDate, "auto", TODAY_SCROLL_LEAD_DAYS);
    });
    const timeoutId = window.setTimeout(() => {
      scrollToDate(initialDate, "auto", TODAY_SCROLL_LEAD_DAYS);
    }, 120);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [scrollToDate, year]);

  return (
    <section
      data-mobile-calendar-experience
      className="flex min-h-0 w-full flex-1 flex-col"
    >
      <div
        ref={listRef}
        onScroll={syncActiveFromScroll}
        onTouchMove={syncActiveFromScroll}
        onWheel={syncActiveFromScroll}
        className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
      >
        <div className="mx-auto flex max-w-[31rem] flex-col gap-3">
          {monthGroups.map((group) => (
            <div key={group.monthIndex} className="flex items-stretch">
              <div className="w-5 shrink-0 sm:w-6">
                <div className="sticky top-2">
                  <span
                    aria-hidden="true"
                    className="block whitespace-nowrap [writing-mode:vertical-rl] rotate-180 text-[13px] font-semibold uppercase leading-none tracking-[0.08em] text-muted-foreground/40 sm:text-sm"
                  >
                    {MONTH_LABELS[group.monthIndex]}
                  </span>
                </div>
              </div>

              <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-border/60">
                {group.days.map((day, dayIndex) => {
                  const dayIso = toIsoDate(day);
                  const dayEvents = getEventsForDay(visibleEvents, dayIso);
                  const hasEvents = dayEvents.length > 0;
                  const active = dayIso === activeDateIso;
                  const today = Boolean(todayIso) && dayIso === todayIso;
                  const isPast = Boolean(todayIso) && dayIso < todayIso;
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const weekday = WEEKDAY_SHORT_LABELS[day.getDay()];
                  const isFirstInMonth = dayIndex === 0;
                  const isLastInMonth = dayIndex === group.days.length - 1;
                  const guidedSelectable = Boolean(
                    guidedSelectionMode && onGuidedDaySelect
                  );
                  const guidedStart = guidedRangeStart === dayIso;
                  const guidedSelected = Boolean(
                    guidedSelectionRange &&
                      dayIso >= guidedSelectionRange.startDate &&
                      dayIso <= guidedSelectionRange.endDate
                  );

                  return (
                    <article
                      key={dayIso}
                      data-mobile-day
                      data-date-iso={dayIso}
                      data-month-index={day.getMonth()}
                      data-day-state={today ? "today" : isPast ? "past" : "future"}
                      data-guided-selected={guidedSelected ? "true" : undefined}
                      className={cn(
                        "relative transition-[background-color,box-shadow]",
                        isFirstInMonth && "rounded-t-2xl",
                        isLastInMonth && "rounded-b-2xl",
                        !isLastInMonth && "border-b border-border/40",
                        hasEvents
                          ? "grid min-h-[4.75rem] grid-cols-[3.75rem_minmax(0,1fr)] gap-2 p-2"
                          : "flex min-h-[2.25rem] items-center px-1.5",
                        isPast
                          ? isWeekend
                            ? "bg-[hsl(var(--cal-cell-weekend-past))]"
                            : "bg-[hsl(var(--cal-cell-weekday-past))]"
                          : isWeekend
                            ? "bg-[hsl(var(--cal-cell-weekend))]"
                            : "bg-card",
                        active && "ring-1 ring-inset ring-foreground/25",
                        guidedSelectable && "ring-1 ring-inset ring-primary/15",
                        (guidedStart || guidedSelected) &&
                          "bg-primary/8 ring-2 ring-inset ring-primary/40",
                        today && "z-10 ring-2 ring-inset ring-destructive"
                      )}
                    >
                      {hasEvents ? (
                        <>
                          <button
                            type="button"
                            className="grid h-full place-items-center rounded-[9px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
                            aria-label={
                              guidedSelectable
                                ? `Selecionar ${dayIso} no guia inicial`
                                : undefined
                            }
                            onClick={() => {
                              setActiveFromDate(day);
                              if (guidedSelectable) onGuidedDaySelect?.(dayIso);
                            }}
                          >
                            <span
                              className={cn(
                                "flex h-[3.55rem] w-[3.55rem] flex-col items-center justify-center text-center tabular-nums transition-[background-color,color,box-shadow]",
                                today
                                  ? "text-foreground"
                                  : active
                                    ? "text-foreground"
                                    : isPast
                                      ? "text-foreground/72"
                                      : "text-foreground"
                              )}
                            >
                              <span className="text-[21px] font-semibold leading-6">
                                {day.getDate()}
                              </span>
                              <span
                                className="mt-0.5 text-[10px] font-semibold uppercase leading-3 tracking-[0.08em] text-muted-foreground"
                              >
                                {weekday}
                              </span>
                            </span>
                          </button>

                          <div className="flex min-w-0 flex-col justify-start gap-1">
                            {dayEvents.map((event) => (
                              <MobileEventButton
                                key={`${event.id}-${dayIso}`}
                                event={event}
                                dayIso={dayIso}
                                onEditEvent={onEditEvent}
                              />
                            ))}
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="flex h-full w-full items-center gap-2 rounded-[7px] py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
                          aria-label={
                            guidedSelectable
                              ? `Selecionar ${dayIso} no guia inicial`
                              : undefined
                          }
                          onClick={() => {
                            setActiveFromDate(day);
                            if (guidedSelectable) onGuidedDaySelect?.(dayIso);
                          }}
                        >
                          <span
                            className={cn(
                              "flex h-6 min-w-6 items-center justify-center rounded-[6px] px-1 text-[13px] font-semibold tabular-nums transition-[background-color,color,box-shadow]",
                              today
                                ? "text-foreground"
                                : active
                                  ? "text-foreground"
                                  : isPast
                                    ? "text-foreground/72"
                                    : "text-foreground"
                            )}
                          >
                            {day.getDate()}
                          </span>
                          <span className="text-[10px] font-semibold uppercase leading-3 tracking-[0.08em] text-muted-foreground">
                            {weekday}
                          </span>
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
