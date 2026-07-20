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
  onGuidedDaySelect?: (dateIso: string) => void;
};

const MONTH_LABELS = [
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

const MONTH_SHORT_LABELS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

const WEEKDAY_SHORT_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;
const DAY_ACTIVE_TOP_THRESHOLD = 12;
const MONTH_REVEAL_MARGIN = 8;

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
  onGuidedDaySelect,
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
  const activeDate = React.useMemo(() => {
    if (getIsoYear(activeDateIso) === year) {
      return getSafeDate(activeDateIso, year);
    }

    return new Date(year, 0, 1);
  }, [activeDateIso, year]);
  const [activeMonthIndex, setActiveMonthIndex] = React.useState(
    activeDate.getMonth()
  );
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const monthScrollerRef = React.useRef<HTMLElement | null>(null);
  const monthButtonRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const activeDateRef = React.useRef(activeDateIso);
  const activeMonthRef = React.useRef(activeMonthIndex);
  const scrollAnimationFrameRef = React.useRef<number | null>(null);
  const programmaticScrollRef = React.useRef(false);

  React.useEffect(() => {
    activeDateRef.current = activeDateIso;
  }, [activeDateIso]);

  React.useEffect(() => {
    activeMonthRef.current = activeMonthIndex;
  }, [activeMonthIndex]);

  const setActiveFromDate = React.useCallback(
    (date: Date) => {
      const nextIso = toIsoDate(date);
      const nextMonth = date.getMonth();

      if (activeDateRef.current !== nextIso) {
        activeDateRef.current = nextIso;
        onActiveDateChange(nextIso);
      }

      if (activeMonthRef.current !== nextMonth) {
        activeMonthRef.current = nextMonth;
        setActiveMonthIndex(nextMonth);
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
    (date: Date, behavior: ScrollBehavior = "smooth") => {
      const list = listRef.current;
      if (!list) return;

      const iso = toIsoDate(date);
      const target = list.querySelector<HTMLElement>(
        `[data-mobile-day][data-date-iso="${iso}"]`
      );
      if (!target) return;

      setActiveFromDate(date);
      programmaticScrollRef.current = behavior !== "auto";
      scrollListTo(
        list,
        Math.max(0, target.offsetTop - list.offsetTop),
        behavior
      );
    },
    [scrollListTo, setActiveFromDate]
  );

  const revealMonthButton = React.useCallback(
    (monthIndex: number, behavior: ScrollBehavior = "smooth") => {
      const scroller = monthScrollerRef.current;
      const button = monthButtonRefs.current[monthIndex];
      if (!scroller || !button) return;

      const scrollerRect = scroller.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      let targetLeft = scroller.scrollLeft;
      const leftOverflow = buttonRect.left - scrollerRect.left - MONTH_REVEAL_MARGIN;
      const rightOverflow =
        buttonRect.right - scrollerRect.right + MONTH_REVEAL_MARGIN;

      if (leftOverflow < 0) {
        targetLeft += leftOverflow;
      } else if (rightOverflow > 0) {
        targetLeft += rightOverflow;
      } else {
        return;
      }

      const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;

      scroller.scrollTo({
        left: Math.max(0, Math.min(targetLeft, maxScrollLeft)),
        behavior,
      });
    },
    []
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
    revealMonthButton(today.getMonth(), "smooth");
    scrollToDate(today, "smooth");
  }, [
    onActiveDateChange,
    onYearChange,
    revealMonthButton,
    scrollToDate,
    todayIso,
    year,
  ]);

  React.useEffect(() => {
    revealMonthButton(activeMonthIndex, "smooth");
  }, [activeMonthIndex, revealMonthButton]);

  const syncActiveFromScroll = React.useCallback(() => {
    if (programmaticScrollRef.current) return;

    const list = listRef.current;
    if (!list) return;

    const anchorTop = list.scrollTop + DAY_ACTIVE_TOP_THRESHOLD;
    const dayNodes = Array.from(
      list.querySelectorAll<HTMLElement>("[data-mobile-day]")
    );
    let activeNode: HTMLElement | null = null;

    for (const node of dayNodes) {
      const nodeTop = Math.max(0, node.offsetTop - list.offsetTop);
      const nodeBottom = nodeTop + node.offsetHeight;

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

    scrollToDate(initialDate, "auto");
    revealMonthButton(initialDate.getMonth(), "auto");
    const frameId = window.requestAnimationFrame(() => {
      scrollToDate(initialDate, "auto");
      revealMonthButton(initialDate.getMonth(), "auto");
    });
    const timeoutId = window.setTimeout(() => {
      scrollToDate(initialDate, "auto");
      revealMonthButton(initialDate.getMonth(), "auto");
    }, 120);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [revealMonthButton, scrollToDate, year]);

  return (
    <section
      data-mobile-calendar-experience
      className="flex min-h-0 w-full flex-1 flex-col"
    >
      <div className="mx-auto flex w-full max-w-[31rem] shrink-0 items-center gap-1.5 rounded-[10px] border border-border/65 bg-muted/28 p-[3px]">
        <button
          type="button"
          className="inline-flex h-10 shrink-0 items-center rounded-[9px] border border-border bg-card px-3 text-[12px] font-semibold text-foreground shadow-none transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
          onClick={handleTodayClick}
        >
          <span className="mr-1.5 size-1.5 rounded-full bg-current" aria-hidden="true" />
          Hoje
        </button>

        <div className="relative min-w-0 flex-1 overflow-hidden rounded-[9px]">
          <nav
            ref={monthScrollerRef}
            className="min-w-0 overflow-x-auto overscroll-x-contain px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label={`Meses de ${year}`}
          >
            <div className="flex min-w-max items-center gap-1">
              {MONTH_LABELS.map((monthLabel, monthIndex) => {
                const active = monthIndex === activeMonthIndex;

                return (
                  <button
                    key={monthLabel}
                    ref={(node) => {
                      monthButtonRefs.current[monthIndex] = node;
                    }}
                    type="button"
                    aria-pressed={active}
                    aria-label={monthLabel}
                    className={cn(
                      "h-10 min-w-10 shrink-0 rounded-[8px] border px-3 text-[12px] font-semibold transition-[background-color,border-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-[0_10px_22px_-18px_rgba(15,23,42,0.55)]"
                        : "border-transparent bg-transparent text-foreground/62 hover:bg-background hover:text-foreground"
                    )}
                    onClick={() => {
                      revealMonthButton(monthIndex, "smooth");
                      scrollToDate(new Date(year, monthIndex, 1), "smooth");
                    }}
                  >
                    {MONTH_SHORT_LABELS[monthIndex]}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      <div
        data-mobile-calendar-divider
        aria-hidden="true"
        className="mt-2 mb-1 h-px w-full shrink-0 bg-border/45"
      />

      <div
        ref={listRef}
        onScroll={syncActiveFromScroll}
        onTouchMove={syncActiveFromScroll}
        onWheel={syncActiveFromScroll}
        className="mx-auto min-h-0 w-full max-w-[31rem] flex-1 overflow-y-auto overscroll-contain pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="space-y-1">
          {yearDays.map((day) => {
            const dayIso = toIsoDate(day);
            const dayEvents = getEventsForDay(visibleEvents, dayIso);
            const active = dayIso === activeDateIso;
            const today = Boolean(todayIso) && dayIso === todayIso;
            const isPast = Boolean(todayIso) && dayIso < todayIso;
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const weekday = WEEKDAY_SHORT_LABELS[day.getDay()];
            const guidedSelectable = Boolean(guidedSelectionMode && onGuidedDaySelect);
            const guidedStart = guidedRangeStart === dayIso;

            return (
              <article
                key={dayIso}
                data-mobile-day
                data-date-iso={dayIso}
                data-month-index={day.getMonth()}
                data-day-state={today ? "today" : isPast ? "past" : "future"}
                className={cn(
                  "grid min-h-[4.75rem] grid-cols-[3.75rem_minmax(0,1fr)] gap-2 rounded-[8px] border p-2 transition-[background-color,border-color,box-shadow]",
                  isPast
                    ? isWeekend
                      ? "bg-[hsl(var(--cal-cell-weekend-past))]"
                      : "bg-[hsl(var(--cal-cell-weekday-past))]"
                    : isWeekend
                      ? "bg-muted/38"
                      : "bg-card",
                  active
                    ? "border-foreground/70 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.55)]"
                    : "border-border",
                  guidedSelectable && "ring-1 ring-primary/15",
                  guidedStart && "border-primary bg-primary/8 ring-2 ring-primary/30"
                )}
              >
                <button
                  type="button"
                  className="grid h-full place-items-center rounded-[9px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
                  aria-label={
                    guidedSelectable
                      ? `Selecionar ${dayIso} para o onboarding`
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
                        ? "rounded-[10px] bg-foreground text-background shadow-[0_10px_20px_-16px_rgba(15,23,42,0.72)]"
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
                      className={cn(
                        "mt-0.5 text-[10px] font-semibold uppercase leading-3 tracking-[0.08em]",
                        today ? "text-background/72" : "text-muted-foreground"
                      )}
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
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
