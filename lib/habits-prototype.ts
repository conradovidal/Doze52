import {
  addDays,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfWeek,
  startOfYear,
} from "date-fns";
import type { Habit } from "@/lib/types";

export const HABITS_DESKTOP_MAX = 4;

export type DesktopHabitSlot =
  | "center"
  | "middle-left"
  | "middle-right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

const DESKTOP_HABIT_QUADRANTS: readonly DesktopHabitSlot[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

export const orderActiveHabits = (habits: Habit[]) =>
  habits
    .filter((habit) => !habit.archivedAt)
    .toSorted(
      (left, right) =>
        left.position - right.position ||
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id)
    );

export const getDesktopVisibleHabits = (habits: Habit[]) =>
  orderActiveHabits(habits).slice(0, HABITS_DESKTOP_MAX);

export const moveActiveHabit = (
  habits: Habit[],
  habitId: string,
  direction: -1 | 1,
  updatedAt: string
) => {
  const orderedIds = orderActiveHabits(habits).map((habit) => habit.id);
  const index = orderedIds.indexOf(habitId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= orderedIds.length) {
    return habits;
  }
  [orderedIds[index], orderedIds[targetIndex]] = [
    orderedIds[targetIndex],
    orderedIds[index],
  ];
  return habits.map((habit) => {
    const position = orderedIds.indexOf(habit.id);
    return position >= 0 ? { ...habit, position, updatedAt } : habit;
  });
};

export const setHabitArchived = (
  habits: Habit[],
  habitId: string,
  archivedAt: string | undefined,
  updatedAt: string,
  restoredPosition?: number
) =>
  habits.map((habit) =>
    habit.id === habitId
      ? {
          ...habit,
          archivedAt,
          position: restoredPosition ?? habit.position,
          updatedAt,
        }
      : habit
  );

export const applyActiveHabitOrder = (
  habits: Habit[],
  orderedIds: string[],
  updatedAt: string
) =>
  habits.map((habit) => {
    const position = orderedIds.indexOf(habit.id);
    return position >= 0 ? { ...habit, position, updatedAt } : habit;
  });

export const getDesktopHabitSlot = (
  totalVisibleHabits: number,
  habitIndex: number
): DesktopHabitSlot | null => {
  if (habitIndex < 0 || habitIndex >= totalVisibleHabits) return null;
  if (totalVisibleHabits === 1) return "center";
  if (totalVisibleHabits === 2) {
    return (["middle-left", "middle-right"] as const)[habitIndex] ?? null;
  }
  return DESKTOP_HABIT_QUADRANTS[habitIndex] ?? null;
};

export type DesktopHabitMarkerSize = "single" | "pair" | "grid";

export const getDesktopHabitMarkerSize = (
  totalVisibleHabits: number
): DesktopHabitMarkerSize => {
  if (totalVisibleHabits <= 1) return "single";
  if (totalVisibleHabits === 2) return "pair";
  return "grid";
};

export type HabitPrototypeDay = {
  dateIso: string;
  dayOfMonth: number;
  inYear: boolean;
  isFuture: boolean;
  isToday: boolean;
};

export type HabitPrototypeWeek = {
  id: string;
  monthLabel: string | null;
  days: HabitPrototypeDay[];
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

export const getHabitCheckInKey = (habitId: string, dateIso: string) =>
  `${habitId}:${dateIso}`;

export type HabitDayAction = "blocked" | "create" | "toggle";

export const getHabitDayAction = ({
  inYear,
  isFuture,
  hasSelectedHabit,
}: {
  inYear: boolean;
  isFuture: boolean;
  hasSelectedHabit: boolean;
}): HabitDayAction => {
  if (!inYear || isFuture) return "blocked";
  return hasSelectedHabit ? "toggle" : "create";
};

export const buildHabitPrototypeWeeks = (
  year: number,
  todayIso: string
): HabitPrototypeWeek[] => {
  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(yearStart);
  const gridStart = startOfWeek(yearStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(yearEnd, { weekStartsOn: 1 });
  const safeToday = parseISO(todayIso);
  const todayTime = Number.isNaN(safeToday.getTime())
    ? Number.POSITIVE_INFINITY
    : safeToday.getTime();
  const weeks: HabitPrototypeWeek[] = [];

  for (
    let weekStart = gridStart;
    weekStart <= gridEnd;
    weekStart = addDays(weekStart, 7)
  ) {
    const days = Array.from({ length: 7 }, (_, dayOffset) => {
      const date = addDays(weekStart, dayOffset);
      const dateIso = format(date, "yyyy-MM-dd");
      return {
        dateIso,
        dayOfMonth: date.getDate(),
        inYear: date.getFullYear() === year,
        isFuture: date.getTime() > todayTime,
        isToday: dateIso === todayIso,
      };
    });
    const firstOfMonth = days.find(
      (day) => day.inYear && day.dayOfMonth === 1
    );

    weeks.push({
      id: format(weekStart, "yyyy-MM-dd"),
      monthLabel: firstOfMonth
        ? MONTH_LABELS[Number(firstOfMonth.dateIso.slice(5, 7)) - 1] ?? null
        : null,
      days,
    });
  }

  return weeks;
};
