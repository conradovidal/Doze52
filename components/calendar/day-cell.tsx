"use client";

import {
  getCompletedHabitsForDate,
  getHabitDayAction,
  getHabitDayMarkers,
  getHabitCheckInKey,
} from "@/lib/habits-prototype";
import type { Habit, HabitCheckIn } from "@/lib/types";

export type DayCellHabitPresentation = {
  habits: Habit[];
  allHabits?: Habit[];
  checkIns: Record<string, HabitCheckIn>;
  selectedHabit: Habit | null;
  onToggle: (dateIso: string) => void;
  onOpenPicker?: (dateIso: string, anchor: HTMLElement) => void;
  onCreateRequest: () => void;
  isEditing?: boolean;
  readOnly?: boolean;
  retrospectiveDates?: ReadonlySet<string>;
  retrospectiveHighlighted?: boolean;
  /**
   * Foco num hábito só: o dia marcado vira um círculo na cor dele, ligado aos
   * dias vizinhos também marcados — a mesma sequência do mobile.
   */
  streak?: boolean;
};

const toIsoDate = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

const ACCESSIBLE_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "full",
  timeZone: "UTC",
});

const formatAccessibleDate = (dateIso: string) =>
  ACCESSIBLE_DATE_FORMATTER.format(new Date(`${dateIso}T12:00:00Z`));

export function DayCell({
  date,
  dateIso,
  todayIso,
  minHeightPx,
  isRangeSelected,
  isRangeStart,
  isRangeEnd,
  isInMonth,
  isOutsidePast = false,
  isDropActive = false,
  showCreateCue = false,
  onDayHover,
  onDayDrop,
  onActivate,
  habitPresentation,
}: {
  date: Date;
  dateIso: string;
  todayIso: string;
  minHeightPx: number;
  isRangeSelected: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isInMonth: boolean;
  /** Célula fora do mês: esquerda passa a ser passado quando o mês começa, direita quando termina. */
  isOutsidePast?: boolean;
  isDropActive?: boolean;
  showCreateCue?: boolean;
  onDayHover?: (dateIso: string) => void;
  onDayDrop?: (dateIso: string, transfer?: DataTransfer | null) => void;
  onActivate?: (dateIso: string) => void;
  habitPresentation?: DayCellHabitPresentation;
}) {
  const isPast = dateIso < todayIso;
  const isHabitMode = Boolean(habitPresentation);

  if (!isInMonth) {
    return (
      <div
        data-day-iso={dateIso}
        className={`w-full transition-colors ${
          isOutsidePast
            ? "bg-[hsl(var(--cal-cell-outside-past))]"
            : "bg-[hsl(var(--cal-cell-outside))]"
        } ${isDropActive ? "ring-1 ring-inset ring-border/70 bg-foreground/6" : ""}`}
        style={{ minHeight: `${minHeightPx}px` }}
        onDragOver={(e) => {
          if (!onDayHover) return;
          e.preventDefault();
          e.stopPropagation();
          onDayHover(dateIso);
        }}
        onDrop={(e) => {
          if (!onDayDrop) return;
          e.preventDefault();
          e.stopPropagation();
          onDayDrop(dateIso, e.dataTransfer);
        }}
      />
    );
  }

  const dayOfWeek = date.getDay(); // 0..6
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const today = dateIso === todayIso;
  const isFuture = dateIso > todayIso;
  const completedHabits = isFuture
    ? []
    : habitPresentation
      ? getCompletedHabitsForDate(
          habitPresentation.habits,
          habitPresentation.checkIns,
          dateIso
        )
      : [];
  const selectedHabitCompleted = habitPresentation?.selectedHabit
    ? Boolean(
        habitPresentation.checkIns[
          getHabitCheckInKey(habitPresentation.selectedHabit.id, dateIso)
        ]?.completed
      )
    : false;
  // Sequência: só liga vizinhos do mesmo mês — o mês seguinte é outra linha.
  const streakHabit =
    habitPresentation?.streak && !isFuture ? habitPresentation.selectedHabit : null;
  const streakCompleted = Boolean(streakHabit) && selectedHabitCompleted;
  const isStreakNeighborDone = (offset: -1 | 1) => {
    if (!streakHabit || !habitPresentation) return false;
    const neighbor = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
    if (neighbor.getMonth() !== date.getMonth()) return false;
    const neighborIso = toIsoDate(neighbor);
    if (neighborIso > todayIso) return false;
    return Boolean(
      habitPresentation.checkIns[getHabitCheckInKey(streakHabit.id, neighborIso)]?.completed
    );
  };
  const streakJoinLeft = streakCompleted && isStreakNeighborDone(-1);
  const streakJoinRight = streakCompleted && isStreakNeighborDone(1);
  const completedNames = completedHabits.map((habit) => habit.name).join(", ");
  const registeredHabitCount =
    habitPresentation?.allHabits?.length ?? habitPresentation?.habits.length ?? 0;
  const usesHabitPicker =
    !habitPresentation?.selectedHabit &&
    registeredHabitCount > 1 &&
    Boolean(habitPresentation?.onOpenPicker);
  const isRetrospectiveDate = Boolean(
    habitPresentation?.retrospectiveDates?.has(dateIso)
  );
  const habitAriaLabel = habitPresentation
    ? isFuture
      ? `${formatAccessibleDate(dateIso)}: data futura, indisponível para hábitos`
      : habitPresentation.readOnly
        ? `${formatAccessibleDate(dateIso)}: exemplo de hábitos do guia inicial`
      : habitPresentation.isEditing
        ? `${formatAccessibleDate(dateIso)}: finalize a edição para registrar hábitos`
      : usesHabitPicker
        ? `Abrir hábitos de ${formatAccessibleDate(dateIso)}.${completedNames ? ` Concluídos visíveis: ${completedNames}.` : " Nenhum hábito visível concluído."}`
      : habitPresentation.selectedHabit
        ? `${selectedHabitCompleted ? "Desmarcar" : "Marcar"} ${habitPresentation.selectedHabit.name} em ${formatAccessibleDate(dateIso)}.${completedNames ? ` Concluídos: ${completedNames}.` : " Nenhum hábito concluído."}`
        : `${formatAccessibleDate(dateIso)}: crie um hábito para fazer check-in`
    : undefined;
  const dayToneClass = isPast
    ? isWeekend
      ? "bg-[hsl(var(--cal-cell-weekend-past))]"
      : "bg-[hsl(var(--cal-cell-weekday-past))]"
    : isWeekend
      ? "bg-[hsl(var(--cal-cell-weekend))]"
      : "bg-[hsl(var(--cal-cell-weekday))]";
  // O passado recua pelo fundo, não pelo número: o número precisa manter
  // contraste AA (>= 4.5:1) porque dias passados continuam editáveis. O
  // futuro sobe um tom para seguir mais forte que o passado.
  const dayNumberToneClass = isPast
    ? "text-neutral-600 dark:text-neutral-400"
    : isWeekend
      ? "text-neutral-600 dark:text-neutral-200/86"
      : "text-neutral-700 dark:text-neutral-100/88";
  const showCenterCreateCue =
    !isHabitMode && showCreateCue && !today && !isRangeSelected;
  const habitDayAction = habitPresentation
    ? getHabitDayAction({
        inYear: true,
        isFuture,
        hasSelectedHabit: Boolean(habitPresentation.selectedHabit),
      })
    : null;
  const habitCanToggle = habitDayAction === "toggle";
  const habitCanActivate =
    !habitPresentation?.readOnly &&
    !habitPresentation?.isEditing &&
    habitDayAction !== "blocked" &&
    (usesHabitPicker || habitDayAction === "toggle" || habitDayAction === "create");

  return (
    <div
      data-day-cell
      data-day-iso={dateIso}
      role="button"
      tabIndex={0}
      aria-label={habitAriaLabel ?? `Adicionar evento em ${dateIso}`}
      aria-disabled={isHabitMode && !habitCanActivate ? true : undefined}
      data-range-selected={isRangeSelected ? "true" : undefined}
      data-onboarding-retrospective-date={isRetrospectiveDate ? "true" : undefined}
      data-onboarding-retrospective-highlighted={
        isRetrospectiveDate && habitPresentation?.retrospectiveHighlighted
          ? "true"
          : undefined
      }
      className={`group relative flex w-full flex-col px-1 py-1 ring-1 ring-inset transition-[background-color,box-shadow] duration-150 ${dayToneClass} ${
        isHabitMode
          ? habitCanActivate
            ? "cursor-pointer"
            : "cursor-not-allowed"
          : "cursor-pointer"
      } ${
        today
          ? "ring-[#b2554c] shadow-[inset_0_0_0_1px_rgba(178,85,76,0.2)]"
          : showCreateCue
            ? "ring-transparent hover:ring-neutral-400/85 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5),0_12px_24px_-20px_rgba(15,23,42,0.3)] dark:hover:bg-white/7 dark:hover:ring-neutral-400/70"
            : "ring-transparent hover:ring-neutral-300/80 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.46),0_10px_18px_-18px_rgba(15,23,42,0.26)] dark:hover:bg-white/6 dark:hover:ring-neutral-500/60"
      } ${
        isRangeSelected
          ? "bg-neutral-300/35 ring-neutral-400/80 dark:bg-neutral-700/45 dark:ring-neutral-500/85"
          : ""
      } ${
        isRangeStart || isRangeEnd
          ? "ring-neutral-700 shadow-[inset_0_0_0_1px_rgba(38,38,38,0.12)] dark:ring-neutral-300 dark:shadow-none"
          : ""
      } ${
        isDropActive ? "bg-foreground/8 ring-border" : ""
      } ${
        isRetrospectiveDate && habitPresentation?.retrospectiveHighlighted
          ? "bg-foreground/8 ring-foreground/45"
          : ""
      } select-none`}
      style={{ minHeight: `${minHeightPx}px` }}
      onDragOver={(e) => {
        if (!onDayHover) return;
        e.preventDefault();
        e.stopPropagation();
        onDayHover(dateIso);
      }}
      onDrop={(e) => {
        if (!onDayDrop) return;
        e.preventDefault();
        e.stopPropagation();
        onDayDrop(dateIso, e.dataTransfer);
      }}
      onClick={(event) => {
        event.currentTarget.focus();
         if (isHabitMode) {
           if (usesHabitPicker && habitCanActivate) {
             habitPresentation?.onOpenPicker?.(dateIso, event.currentTarget);
           } else if (habitCanToggle) {
             habitPresentation?.onToggle(dateIso);
          } else if (habitCanActivate) {
            habitPresentation?.onCreateRequest();
           }
           return;
         }
        onActivate?.(dateIso);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
         if (isHabitMode) {
           if (usesHabitPicker && habitCanActivate) {
             habitPresentation?.onOpenPicker?.(dateIso, event.currentTarget);
           } else if (habitCanToggle) {
             habitPresentation?.onToggle(dateIso);
          } else if (habitCanActivate) {
            habitPresentation?.onCreateRequest();
           }
           return;
         }
        onActivate?.(dateIso);
      }}
    >
      {showCenterCreateCue ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <span className="text-[18px] font-medium leading-none text-foreground/28 dark:text-neutral-100/26">
            +
          </span>
        </div>
      ) : null}
      {streakCompleted && streakHabit ? (
        <>
          {streakJoinLeft ? (
            <span
              aria-hidden="true"
              data-habit-streak-join="left"
              className="pointer-events-none absolute -left-px top-4 h-2.5 w-1/2 -translate-y-1/2"
              style={{ backgroundColor: streakHabit.color }}
            />
          ) : null}
          {streakJoinRight ? (
            <span
              aria-hidden="true"
              data-habit-streak-join="right"
              className="pointer-events-none absolute -right-px top-4 h-2.5 w-1/2 -translate-y-1/2"
              style={{ backgroundColor: streakHabit.color }}
            />
          ) : null}
          <span
            aria-hidden="true"
            data-habit-marker={streakHabit.id}
            className="pointer-events-none absolute left-1/2 top-4 size-[clamp(20px,1.7vw,24px)] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ backgroundColor: streakHabit.color }}
          />
        </>
      ) : null}
      <div
        className={`relative grid h-6 w-full flex-none place-items-center px-0.5 text-[12px] ${
          streakCompleted && !today ? "text-neutral-950" : dayNumberToneClass
        } ${
          showCreateCue ? "pointer-events-none" : ""
        }`}
      >
        <span
          data-day-number
          className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[12px] font-semibold leading-none tabular-nums transition-colors ${
            today
              ? "bg-[#b2554c] text-white ring-1 ring-[#b2554c]"
              : streakCompleted
                ? ""
                : "group-hover:text-foreground dark:group-hover:text-white"
          }`}
        >
          {date.getDate()}
        </span>
      </div>
      <div className="mt-1 flex-1" />
      {habitPresentation && !habitPresentation.streak && completedHabits.length > 0 ? (
        <div
          data-day-habit-markers
          className="pointer-events-none absolute inset-x-0 top-[30px] bottom-1 flex flex-col items-center justify-start gap-0.5 overflow-visible"
          aria-hidden="true"
        >
          {getHabitDayMarkers(completedHabits).visible.map((habit, completedIndex) => {
            return (
              <span
                key={habit.id}
                data-habit-marker={habit.id}
                data-habit-slot={`stack-${completedIndex + 1}`}
                className="size-[clamp(12px,1.1vw,18px)] shrink-0 rounded-full border border-black/10"
                style={{ backgroundColor: habit.color }}
              />
            );
          })}
          {getHabitDayMarkers(completedHabits).overflow > 0 ? (
            // Mais hábitos no dia do que a pilha comporta: o último espaço
            // vira a contagem do resto (os nomes estão no aria-label do dia).
            <span
              data-habit-marker-overflow
              className="grid h-[clamp(12px,1.1vw,18px)] min-w-[clamp(12px,1.1vw,18px)] shrink-0 place-items-center rounded-full bg-foreground/12 px-0.5 text-[9px] font-semibold leading-none tabular-nums text-foreground/75"
            >
              +{getHabitDayMarkers(completedHabits).overflow}
            </span>
          ) : null}
        </div>
      ) : null}
      {showCreateCue ? (
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-transparent transition-all duration-150 group-hover:ring-neutral-300/45 dark:group-hover:ring-neutral-500/30" />
      ) : null}
    </div>
  );
}
