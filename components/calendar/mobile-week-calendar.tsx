"use client";

/**
 * PROTÓTIPO — visão mobile do Anual com a mesma estrutura do grid mobile de
 * Hábitos: cada semana é uma linha (7 colunas, segunda a domingo), com o
 * rótulo do mês na vertical à esquerda. Os eventos aparecem como barras sob
 * o número do dia, ocupando as colunas que cobrem (eventos de vários dias
 * atravessam a linha), em "faixas" empilhadas — por isso a linha cresce em
 * altura conforme a semana tem eventos.
 *
 * Mesmo contrato de props de MobileCalendarExperience, para poder trocar um
 * pelo outro em app/page.tsx sem mexer no resto.
 */

import { isCategoryShownInCalendar } from "@/lib/category-archive";
import * as React from "react";
import { X } from "lucide-react";
import {
  AnimatePresence,
  LazyMotion,
  useDragControls,
  type PanInfo,
} from "motion/react";
import * as m from "motion/react-m";
import { useStore } from "@/lib/store";
import type {
  AnchorPoint,
  CalendarRenderEvent,
  CategoryItem,
} from "@/lib/types";
import {
  compareEventsByVisualPriority,
  isRenderableEventDateRange,
} from "@/lib/event-order";
import { getCategoryColorToken } from "@/lib/category-palette";
import { MOTION_DURATION, MOTION_EASE, MOTION_SPRING } from "@/lib/motion";
import { buildHabitPrototypeWeeks } from "@/lib/habits-prototype";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type MobileWeekCalendarProps = {
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
  notice?: React.ReactNode;
};

/** Faixas de evento visíveis por semana; o que passar vira "+N" no dia. */
const MAX_VISIBLE_LANES = 3;

type WeekSegment = {
  event: CalendarRenderEvent;
  /** Colunas 0–6 (segunda = 0) cobertas dentro desta semana. */
  startCol: number;
  endCol: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
  lane: number;
};

const getEventAriaLabel = (event: CalendarRenderEvent) =>
  `Editar ${event.title}`;

function packWeekSegments(
  weekDates: string[],
  inYear: boolean[],
  events: CalendarRenderEvent[],
) {
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const inWeek = events
    .filter((event) => event.startDate <= weekEnd && event.endDate >= weekStart)
    .sort(compareEventsByVisualPriority);

  const laneOccupancy: boolean[][] = [];
  const segments: WeekSegment[] = [];

  for (const event of inWeek) {
    let startCol = weekDates.findIndex(
      (date, index) => inYear[index] && date >= event.startDate,
    );
    let endCol = -1;
    for (let index = 6; index >= 0; index -= 1) {
      if (inYear[index] && weekDates[index] <= event.endDate) {
        endCol = index;
        break;
      }
    }
    if (startCol === -1 || endCol === -1 || endCol < startCol) continue;
    // Um evento que só toca dias fora do ano (ex.: 30/12 na 1ª linha) não
    // entra; os que já começaram antes do ano recortam no primeiro dia.
    if (event.startDate > weekDates[endCol]) continue;
    startCol = Math.max(startCol, 0);

    let lane = 0;
    while (
      laneOccupancy[lane]?.slice(startCol, endCol + 1).some(Boolean) ??
      false
    ) {
      lane += 1;
    }
    laneOccupancy[lane] ??= Array(7).fill(false);
    for (let col = startCol; col <= endCol; col += 1) {
      laneOccupancy[lane][col] = true;
    }

    segments.push({
      event,
      startCol,
      endCol,
      continuesBefore: event.startDate < weekDates[startCol],
      continuesAfter: event.endDate > weekDates[endCol],
      lane,
    });
  }

  const hiddenByCol = Array<number>(7).fill(0);
  for (const segment of segments) {
    if (segment.lane < MAX_VISIBLE_LANES) continue;
    for (let col = segment.startCol; col <= segment.endCol; col += 1) {
      hiddenByCol[col] += 1;
    }
  }

  return {
    segments: segments.filter((segment) => segment.lane < MAX_VISIBLE_LANES),
    hiddenByCol,
    laneCount: Math.min(
      MAX_VISIBLE_LANES,
      segments.reduce((max, segment) => Math.max(max, segment.lane + 1), 0),
    ),
  };
}

function WeekEventBar({
  segment,
  onEditEvent,
}: {
  segment: WeekSegment;
  onEditEvent: MobileWeekCalendarProps["onEditEvent"];
}) {
  const { event } = segment;
  const { mode: themeMode } = useTheme();
  const colorToken = React.useMemo(
    () => getCategoryColorToken(event.color, themeMode),
    [event.color, themeMode],
  );

  return (
    <m.button
      type="button"
      data-calendar-event-id={event.sourceEventId}
      aria-label={getEventAriaLabel(event)}
      title={event.title}
      className={cn(
        "pointer-events-auto mx-[2px] block h-[18px] min-w-0 overflow-hidden border text-left active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55",
        segment.continuesBefore
          ? "-ml-[3px] rounded-l-none border-l-0"
          : "rounded-l-[5px]",
        segment.continuesAfter
          ? "-mr-[3px] rounded-r-none border-r-0"
          : "rounded-r-[5px]",
      )}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: MOTION_DURATION.transition, ease: MOTION_EASE }}
      whileTap={{ scale: 0.97 }}
      style={{
        gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}`,
        gridRow: segment.lane + 2,
        backgroundColor: colorToken.eventSoft,
        borderColor: colorToken.eventBorder,
        color: colorToken.text,
      }}
      onClick={(click) => {
        const rect = click.currentTarget.getBoundingClientRect();
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
      <span className="block truncate px-1 text-[10px] font-semibold leading-[16px]">
        {event.title}
      </span>
    </m.button>
  );
}

export function MobileWeekCalendar({
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
  notice = null,
}: MobileWeekCalendarProps) {
  const categories = useStore((s) => s.categories as CategoryItem[]);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const visibleEvents = React.useMemo(() => {
    const profiles = new Set(selectedProfileIds);
    const visibleCategoryIds = new Set(
      categories
        .filter(
          (category) =>
            isCategoryShownInCalendar(category) &&
            profiles.has(category.profileId),
        )
        .map((category) => category.id),
    );
    return events.filter(
      (event) =>
        visibleCategoryIds.has(event.categoryId) &&
        isRenderableEventDateRange(event),
    );
  }, [categories, selectedProfileIds, events]);

  const weeks = React.useMemo(
    () => buildHabitPrototypeWeeks(year, todayIso),
    [year, todayIso],
  );
  const layouts = React.useMemo(
    () =>
      weeks.map((week) =>
        packWeekSegments(
          week.days.map((day) => day.dateIso),
          week.days.map((day) => day.inYear),
          visibleEvents,
        ),
      ),
    [weeks, visibleEvents],
  );

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  // Sentido da troca de ano (+1 = o ano seguinte entra pela direita).
  // Ajustado durante o render (padrão do React para estado derivado de prop),
  // para o novo bloco já montar com o sentido certo.
  const [yearMotion, setYearMotion] = React.useState({ year, direction: 0 });
  if (yearMotion.year !== year) {
    setYearMotion({
      year,
      direction: year > yearMotion.year ? 1 : -1,
    });
  }

  const scrollToToday = React.useCallback((behavior: ScrollBehavior) => {
    const list = scrollRef.current;
    if (!list) return;
    const row = list.querySelector<HTMLElement>("[data-week-current]");
    if (!row) return;
    const top =
      list.scrollTop +
      (row.getBoundingClientRect().top - list.getBoundingClientRect().top);
    // Deixa ~1 semana de contexto acima da semana atual.
    list.scrollTo({ top: Math.max(0, top - 56), behavior });
  }, []);

  React.useLayoutEffect(() => {
    scrollToToday("auto");
    const id = window.setTimeout(() => scrollToToday("auto"), 120);
    return () => window.clearTimeout(id);
  }, [scrollToToday, year]);

  const handledTodayKeyRef = React.useRef(0);
  React.useEffect(() => {
    if (
      scrollToTodayRequestKey <= 0 ||
      scrollToTodayRequestKey === handledTodayKeyRef.current
    ) {
      return;
    }
    handledTodayKeyRef.current = scrollToTodayRequestKey;
    const todayYear = Number(todayIso.slice(0, 4));
    if (todayIso && todayYear !== year) {
      onActiveDateChange(todayIso);
      onYearChange(todayYear);
      return;
    }
    scrollToToday("smooth");
  }, [
    scrollToTodayRequestKey,
    scrollToToday,
    todayIso,
    year,
    onActiveDateChange,
    onYearChange,
  ]);

  const guidedSelectable = Boolean(guidedSelectionMode && onGuidedDaySelect);

  // A data fica guardada depois de fechar para o conteúdo não sumir no meio
  // da animação de saída; quem manda em "aberta ou não" é sheetOpen.
  const [sheetDateIso, setSheetDateIso] = React.useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const sheetEvents = React.useMemo(
    () =>
      sheetDateIso
        ? visibleEvents
            .filter(
              (event) =>
                event.startDate <= sheetDateIso &&
                event.endDate >= sheetDateIso,
            )
            .sort(compareEventsByVisualPriority)
        : [],
    [sheetDateIso, visibleEvents],
  );

  const handleDayClick = (dateIso: string) => {
    onActiveDateChange(dateIso);
    if (guidedSelectable) {
      onGuidedDaySelect?.(dateIso);
      return;
    }
    // Toque no dia abre a folha com os títulos completos (a grade corta
    // títulos longos em colunas de ~49px). Dia vazio só marca o dia.
    const hasEvents = visibleEvents.some(
      (event) => event.startDate <= dateIso && event.endDate >= dateIso,
    );
    if (hasEvents) {
      setSheetDateIso(dateIso);
      setSheetOpen(true);
    } else {
      setSheetOpen(false);
    }
  };

  return (
    <section
      data-mobile-calendar-experience
      data-mobile-week-calendar
      className="flex min-h-0 w-full flex-1 flex-col"
    >
      {notice}

      <div
        ref={scrollRef}
        className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
      >
        <m.div
          key={year}
          className="mx-auto max-w-[31rem]"
          initial={{ opacity: 0, x: yearMotion.direction * 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: MOTION_DURATION.transition,
            ease: MOTION_EASE,
          }}
        >
          <div className="flex items-stretch">
            <div className="flex w-5 shrink-0 flex-col sm:w-6">
              {weeks.map((week) => (
                <WeekLabelCell
                  key={week.id}
                  label={week.monthLabel}
                  laneCount={layouts[weeks.indexOf(week)]?.laneCount ?? 0}
                />
              ))}
            </div>

            <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-border/60 bg-card">
              {weeks.map((week, weekIndex) => {
                const layout = layouts[weekIndex];
                const isCurrentWeek = week.days.some((day) => day.isToday);
                const isLastWeek = weekIndex === weeks.length - 1;

                return (
                  <div
                    key={week.id}
                    data-week-row
                    data-week-current={isCurrentWeek ? "true" : undefined}
                    className={cn(
                      "relative transition-[height] duration-200 ease-out",
                      !isLastWeek && "border-b-[1.5px] border-border/40",
                    )}
                    style={{ height: WeekRowHeight(layout.laneCount) }}
                  >
                    {/* Fundo: uma célula por dia (fundo, divisórias, toque). */}
                    <div className="absolute inset-0 grid grid-cols-7">
                      {week.days.map((day, dayIndex) => {
                        const isWeekend = dayIndex >= 5;
                        const isPast = !day.isToday && !day.isFuture;
                        const selected = Boolean(
                          guidedSelectionRange &&
                          day.dateIso >= guidedSelectionRange.startDate &&
                          day.dateIso <= guidedSelectionRange.endDate,
                        );
                        const guidedStart = guidedRangeStart === day.dateIso;
                        const active = day.dateIso === activeDateIso;
                        const sheetHighlighted =
                          sheetOpen && day.dateIso === sheetDateIso;

                        if (!day.inYear) {
                          return (
                            <span
                              key={day.dateIso}
                              aria-hidden="true"
                              className={cn(
                                dayIndex < 6 &&
                                  "border-r-[1.5px] border-r-border/40",
                              )}
                              style={{
                                backgroundColor: `hsl(var(${
                                  isPast
                                    ? "--cal-cell-outside-past"
                                    : "--cal-cell-outside"
                                }))`,
                              }}
                            />
                          );
                        }

                        return (
                          <button
                            key={day.dateIso}
                            type="button"
                            data-mobile-day
                            data-date-iso={day.dateIso}
                            aria-label={
                              guidedSelectable
                                ? `Selecionar ${day.dateIso} no guia inicial`
                                : day.dateIso
                            }
                            onClick={() => handleDayClick(day.dateIso)}
                            className={cn(
                              "relative transition-shadow duration-200 active:brightness-95 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60",
                              dayIndex < 6 &&
                                "border-r-[1.5px] border-r-border/40",
                              active && "ring-1 ring-inset ring-foreground/25",
                              sheetHighlighted &&
                                "z-10 ring-2 ring-inset ring-foreground/60",
                              guidedSelectable &&
                                "ring-1 ring-inset ring-primary/15",
                              (guidedStart || selected) &&
                                "ring-2 ring-inset ring-primary/40",
                              day.isToday &&
                                "z-10 ring-2 ring-inset ring-destructive",
                            )}
                            style={{
                              backgroundColor: `hsl(var(${
                                isPast
                                  ? "--cal-cell-weekday-past"
                                  : "--cal-cell-weekday"
                              }))`,
                            }}
                          >
                            {isWeekend ? (
                              <span
                                aria-hidden="true"
                                className="absolute inset-0 bg-foreground/[0.08]"
                              />
                            ) : null}
                            {guidedStart || selected ? (
                              <span
                                aria-hidden="true"
                                className="absolute inset-0 bg-primary/10"
                              />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    {/* Frente: números dos dias + faixas de evento. */}
                    <div
                      className="pointer-events-none relative z-20 grid grid-cols-7 gap-y-[2px] pb-1"
                      style={{ gridTemplateRows: "1.75rem" }}
                    >
                      {week.days.map((day, dayIndex) => {
                        if (!day.inYear) return <span key={day.dateIso} />;
                        const hidden = layout.hiddenByCol[dayIndex];
                        return (
                          <span
                            key={day.dateIso}
                            style={{ gridColumn: dayIndex + 1, gridRow: 1 }}
                            className="relative flex items-start justify-center pt-1"
                          >
                            <span
                              className={cn(
                                "text-[11px] font-medium tabular-nums leading-5 text-foreground/85",
                                day.isToday &&
                                  "grid h-5 min-w-5 place-items-center rounded-full bg-[#b2554c] px-1 font-semibold text-white",
                              )}
                            >
                              {day.dayOfMonth}
                            </span>
                            {hidden > 0 ? (
                              <span className="absolute right-1 top-1 text-[9px] font-semibold leading-5 text-muted-foreground">
                                +{hidden}
                              </span>
                            ) : null}
                          </span>
                        );
                      })}
                      <AnimatePresence initial={false}>
                        {layout.segments.map((segment) => (
                          <WeekEventBar
                            key={`${segment.event.id}-${week.id}`}
                            segment={segment}
                            onEditEvent={onEditEvent}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </m.div>
      </div>
      <AnimatePresence>
        {sheetOpen && sheetDateIso && sheetEvents.length > 0 ? (
          <DayEventsSheet
            key="day-events-sheet"
            dateIso={sheetDateIso}
            events={sheetEvents}
            onClose={() => setSheetOpen(false)}
            onEditEvent={(payload) => {
              setSheetOpen(false);
              onEditEvent(payload);
            }}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
}

const WEEK_NUMBER_ROW_PX = 28;
const WEEK_LANE_PX = 20;
const WEEK_ROW_PADDING_PX = 4;
const WEEK_ROW_MIN_PX = 40;

function WeekRowHeight(laneCount: number) {
  return Math.max(
    WEEK_ROW_MIN_PX,
    WEEK_NUMBER_ROW_PX + laneCount * WEEK_LANE_PX + WEEK_ROW_PADDING_PX,
  );
}

/** Coluna do mês: acompanha a altura (variável) da linha da semana. */
function WeekLabelCell({
  label,
  laneCount,
}: {
  label: string | null;
  laneCount: number;
}) {
  return (
    <div
      className="relative transition-[height] duration-200 ease-out"
      style={{ height: WeekRowHeight(laneCount) }}
    >
      {label ? (
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 [writing-mode:vertical-rl] rotate-180 whitespace-nowrap text-[13px] font-semibold uppercase leading-none tracking-[0.08em] text-muted-foreground/40 sm:text-sm"
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}

// Arrastar a folha para fechar precisa do módulo de gestos (domMax), que o
// provider global não carrega — entra só quando a folha abre.
const loadDragFeatures = () =>
  import("motion/react").then((module) => module.domMax);

const SHEET_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const formatIsoDate = (iso: string, formatter: Intl.DateTimeFormat) =>
  formatter.format(new Date(`${iso}T12:00:00Z`));

function DayEventRow({
  event,
  index,
  onEditEvent,
}: {
  event: CalendarRenderEvent;
  index: number;
  onEditEvent: MobileWeekCalendarProps["onEditEvent"];
}) {
  const { mode: themeMode } = useTheme();
  const colorToken = React.useMemo(
    () => getCategoryColorToken(event.color, themeMode),
    [event.color, themeMode],
  );
  const range =
    event.startDate === event.endDate
      ? null
      : `${formatIsoDate(event.startDate, SHORT_DATE_FORMATTER)} – ${formatIsoDate(event.endDate, SHORT_DATE_FORMATTER)}`;

  return (
    <m.button
      type="button"
      aria-label={getEventAriaLabel(event)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: MOTION_DURATION.transition,
        ease: MOTION_EASE,
        delay: 0.06 + Math.min(index, 6) * 0.04,
      }}
      whileTap={{ scale: 0.98 }}
      className="flex w-full items-center gap-3 rounded-[10px] border px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
      style={{
        backgroundColor: colorToken.eventSoft,
        borderColor: colorToken.eventBorder,
        color: colorToken.text,
      }}
      onClick={(click) => {
        const rect = click.currentTarget.getBoundingClientRect();
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
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold leading-5">
          {event.title}
        </span>
        {range ? (
          <span className="block text-[11px] leading-4 opacity-70">
            {range}
          </span>
        ) : null}
      </span>
    </m.button>
  );
}

/** Folha inferior com todos os eventos do dia tocado, em título completo. */
function DayEventsSheet({
  dateIso,
  events,
  onClose,
  onEditEvent,
}: {
  dateIso: string;
  events: CalendarRenderEvent[];
  onClose: () => void;
  onEditEvent: MobileWeekCalendarProps["onEditEvent"];
}) {
  React.useEffect(() => {
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const dragControls = useDragControls();
  const handleDragEnd = (_: PointerEvent, info: PanInfo) => {
    if (info.offset.y > 90 || info.velocity.y > 500) onClose();
  };

  return (
    <LazyMotion features={loadDragFeatures}>
      <div className="fixed inset-0 z-[60]" data-day-events-sheet>
        <m.button
          type="button"
          aria-label="Fechar"
          className="absolute inset-0 bg-black/35"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: MOTION_DURATION.transition,
            ease: MOTION_EASE,
          }}
          onClick={onClose}
        />
        <m.div
          role="dialog"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={MOTION_SPRING}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.7 }}
          onDragEnd={handleDragEnd}
          aria-label={formatIsoDate(dateIso, SHEET_DATE_FORMATTER)}
          className="absolute inset-x-0 bottom-0 max-h-[65vh] overflow-y-auto rounded-t-2xl border border-b-0 border-border bg-card px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-4 shadow-[0_-18px_36px_-24px_rgba(15,23,42,0.45)]"
        >
          <div
            className="-mx-4 -mt-4 mb-1 flex cursor-grab touch-none justify-center px-4 pb-2 pt-2.5 active:cursor-grabbing"
            onPointerDown={(pointerEvent) => dragControls.start(pointerEvent)}
            aria-hidden="true"
          >
            <span className="h-1 w-9 rounded-full bg-foreground/20" />
          </div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[13px] font-semibold text-foreground first-letter:uppercase">
              {formatIsoDate(dateIso, SHEET_DATE_FORMATTER)}
            </h2>
            <button
              type="button"
              aria-label="Fechar"
              className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {events.map((event, index) => (
              <DayEventRow
                key={`${event.id}-${dateIso}`}
                index={index}
                event={event}
                onEditEvent={onEditEvent}
              />
            ))}
          </div>
        </m.div>
      </div>
    </LazyMotion>
  );
}
