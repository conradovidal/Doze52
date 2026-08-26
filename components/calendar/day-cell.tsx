"use client";

import { Check } from "lucide-react";
import {
  getDesktopHabitSlot,
  getDesktopHabitMarkerSize,
  getHabitDayAction,
  getHabitCheckInKey,
} from "@/lib/habits-prototype";
import type { Habit, HabitCheckIn } from "@/lib/types";
import { cn } from "@/lib/utils";

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
};

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
          isPast
            ? "bg-neutral-200/70 dark:bg-[hsl(var(--cal-cell-outside-past))]"
            : "bg-neutral-50/45 dark:bg-[hsl(var(--cal-cell-outside))]"
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
    : habitPresentation?.habits.filter((habit) =>
        Boolean(
          habitPresentation.checkIns[getHabitCheckInKey(habit.id, dateIso)]
            ?.completed
        )
      ) ?? [];
  const selectedHabitCompleted = habitPresentation?.selectedHabit
    ? Boolean(
        habitPresentation.checkIns[
          getHabitCheckInKey(habitPresentation.selectedHabit.id, dateIso)
        ]?.completed
      )
    : false;
  const completedNames = completedHabits.map((habit) => habit.name).join(", ");
  const registeredHabitCount =
    habitPresentation?.allHabits?.length ?? habitPresentation?.habits.length ?? 0;
  const usesHabitPicker = registeredHabitCount > 1 && Boolean(habitPresentation?.onOpenPicker);
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
      ? "bg-neutral-300/62 dark:bg-[hsl(var(--cal-cell-weekend-past))]"
      : "bg-neutral-200/82 dark:bg-[hsl(var(--cal-cell-weekday-past))]"
    : isWeekend
      ? "bg-neutral-100/78 dark:bg-[hsl(var(--cal-cell-weekend))]"
      : "bg-white dark:bg-[hsl(var(--cal-cell-weekday))]";
  const dayNumberToneClass = isPast
    ? "text-neutral-400 dark:text-neutral-500/75"
    : isWeekend
      ? "text-neutral-500 dark:text-neutral-200/86"
      : "text-muted-foreground dark:text-neutral-100/88";
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
          ? "ring-neutral-900 shadow-[inset_0_0_0_1px_rgba(23,23,23,0.06)] dark:ring-neutral-100 dark:shadow-none"
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
      <div
        className={`grid h-6 w-full flex-none place-items-center px-0.5 text-[12px] ${dayNumberToneClass} ${
          showCreateCue ? "pointer-events-none" : ""
        }`}
      >
        <span
          className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[12px] font-semibold leading-none tabular-nums transition-colors ${
            today
              ? "bg-neutral-900 text-white ring-1 ring-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:ring-neutral-100"
              : "group-hover:text-foreground dark:group-hover:text-white"
          }`}
        >
          {date.getDate()}
        </span>
      </div>
      <div className="mt-1 flex-1" />
      {habitPresentation && completedHabits.length > 0 ? (
        <div
          data-day-habit-markers
          className={cn(
            "pointer-events-none absolute inset-x-0 top-7 bottom-1 grid place-items-center",
            habitPresentation.habits.length === 2 &&
              "mx-auto w-fit grid-cols-2 grid-rows-1 gap-1",
            habitPresentation.habits.length > 2 &&
              "mx-auto w-fit grid-cols-2 grid-rows-2 gap-px"
          )}
          aria-hidden="true"
        >
          {habitPresentation.habits.map((habit, habitIndex) => {
            const completed = completedHabits.some((entry) => entry.id === habit.id);
            const slot = getDesktopHabitSlot(
              habitPresentation.habits.length,
              habitIndex
            );
            const markerSize = getDesktopHabitMarkerSize(
              habitPresentation.habits.length
            );
            return (
              <span
                key={habit.id}
                data-habit-marker={completed ? habit.id : undefined}
                data-habit-slot={slot ?? undefined}
                className={cn(
                  "grid place-items-center rounded-full border border-black/10 text-slate-950",
                  markerSize === "single"
                    ? "size-[clamp(12px,1.1vw,18px)]"
                    : markerSize === "pair"
                      ? "size-[clamp(10px,0.95vw,15px)]"
                      : "size-[clamp(7px,0.78vw,11px)]",
                  !completed && "invisible"
                )}
                style={completed ? { backgroundColor: habit.color } : undefined}
              >
                {completed ? (
                  <Check
                    className={cn(
                      markerSize === "single"
                        ? "size-[clamp(7px,0.66vw,11px)]"
                        : markerSize === "pair"
                          ? "size-[clamp(6px,0.58vw,9px)]"
                          : "size-[clamp(4px,0.46vw,7px)]"
                    )}
                    strokeWidth={3}
                  />
                ) : null}
              </span>
            );
          })}
        </div>
      ) : null}
      {showCreateCue ? (
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-transparent transition-all duration-150 group-hover:ring-neutral-300/45 dark:group-hover:ring-neutral-500/30" />
      ) : null}
    </div>
  );
}
