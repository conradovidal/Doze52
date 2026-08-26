import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfWeek,
  startOfYear,
} from "date-fns";
import {
  CATEGORY_COLOR_BASE_BLUE,
  CATEGORY_COLOR_BASE_TEAL,
  CATEGORY_COLOR_BASE_VIOLET,
  CATEGORY_COLOR_BASE_YELLOW,
} from "@/lib/category-palette";
import type {
  CalendarEvent,
  CategoryItem,
  Habit,
  HabitCheckIn,
} from "@/lib/types";

export const HABITS_DESKTOP_MAX = 4;

export type OnboardingHabitShowcase = {
  habits: Habit[];
  checkIns: Record<string, HabitCheckIn>;
  visibleHabitIds: string[];
};

const ONBOARDING_HABIT_SHOWCASE_DEFINITIONS = [
  {
    id: "onboarding-habit-exercise",
    name: "Exercício",
    color: CATEGORY_COLOR_BASE_BLUE,
  },
  {
    id: "onboarding-habit-reading",
    name: "Ler 20 minutos",
    color: CATEGORY_COLOR_BASE_VIOLET,
  },
  {
    id: "onboarding-habit-sleep",
    name: "Dormir antes das 23h",
    color: CATEGORY_COLOR_BASE_TEAL,
  },
  {
    id: "onboarding-habit-smoke-free",
    name: "Dia sem fumar",
    color: CATEGORY_COLOR_BASE_YELLOW,
  },
] as const;

const normalizeShowcaseLabel = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

const addEventDates = (
  target: Set<string>,
  event: Pick<CalendarEvent, "startDate" | "endDate">,
  yearStartIso: string,
  cutoffIso: string
) => {
  const startIso = event.startDate < yearStartIso ? yearStartIso : event.startDate;
  const endIso = event.endDate > cutoffIso ? cutoffIso : event.endDate;
  if (startIso > endIso) return;
  eachDayOfInterval({ start: parseISO(startIso), end: parseISO(endIso) }).forEach(
    (date) => target.add(format(date, "yyyy-MM-dd"))
  );
};

export const buildOnboardingHabitShowcase = ({
  year,
  todayIso,
  events,
  categories,
}: {
  year: number;
  todayIso: string;
  events: CalendarEvent[];
  categories: CategoryItem[];
}): OnboardingHabitShowcase => {
  const yearStartIso = `${year}-01-01`;
  const yearEndIso = `${year}-12-31`;
  const cutoffIso = todayIso < yearEndIso ? todayIso : yearEndIso;
  const createdAt = `${yearStartIso}T12:00:00.000Z`;
  const habits = ONBOARDING_HABIT_SHOWCASE_DEFINITIONS.map(
    (definition, position): Habit => ({
      ...definition,
      icon: "circle-check",
      position,
      createdAt,
      updatedAt: createdAt,
    })
  );
  if (cutoffIso < yearStartIso) {
    return {
      habits,
      checkIns: {},
      visibleHabitIds: habits.slice(0, 3).map((habit) => habit.id),
    };
  }

  const categoryNameById = new Map(
    categories.map((category) => [category.id, normalizeShowcaseLabel(category.name)])
  );
  const travelOrVacationDates = new Set<string>();
  const readingBoostDates = new Set<string>();
  const socialDates = new Set<string>();
  const transitionDates = new Set<string>();

  events.forEach((event) => {
    const title = normalizeShowcaseLabel(event.title);
    const categoryName = categoryNameById.get(event.categoryId) ?? "";
    const isTravelOrVacation =
      categoryName.includes("viagen") ||
      title.includes("ferias") ||
      title.includes("carnaval") ||
      title.includes("fim de semana") ||
      title.includes("ano novo");
    const isReadingBoost = isTravelOrVacation || title.includes("feira do livro");
    const isSocial =
      categoryName.includes("amigo") ||
      title.includes("casamento") ||
      title.includes("show") ||
      title.includes("concerto");

    if (isTravelOrVacation) {
      addEventDates(travelOrVacationDates, event, yearStartIso, cutoffIso);
      if (event.startDate >= yearStartIso && event.startDate <= cutoffIso) {
        transitionDates.add(event.startDate);
      }
      if (event.endDate >= yearStartIso && event.endDate <= cutoffIso) {
        transitionDates.add(event.endDate);
      }
    }
    if (isReadingBoost) {
      addEventDates(readingBoostDates, event, yearStartIso, cutoffIso);
    }
    if (isSocial && event.startDate >= yearStartIso && event.startDate <= cutoffIso) {
      socialDates.add(event.startDate);
    }
  });

  const dates = eachDayOfInterval({
    start: parseISO(yearStartIso),
    end: parseISO(cutoffIso),
  }).map((date) => format(date, "yyyy-MM-dd"));
  const yearStartWeekOffset = (parseISO(yearStartIso).getDay() + 6) % 7;
  const exercisePatterns: ReadonlyArray<ReadonlyArray<number>> = [
    [1, 3, 5],
    [1, 2, 4],
    [2, 4, 6],
    [1, 3, 5],
  ] as const;
  const completions = new Map<string, Set<string>>();
  dates.forEach((dateIso, dayIndex) => {
    const weekday = parseISO(dateIso).getDay();
    const weekIndex = Math.floor((dayIndex + yearStartWeekOffset) / 7);
    const exerciseDays = exercisePatterns[weekIndex % exercisePatterns.length];
    const completed = new Set<string>();
    const blackout = transitionDates.has(dateIso);
    if (!blackout) {
      if (
        exerciseDays.includes(weekday) &&
        !travelOrVacationDates.has(dateIso) &&
        !(weekIndex % 6 === 4 && weekday === exerciseDays[2])
      ) {
        completed.add(habits[0].id);
      }
      if (
        (readingBoostDates.has(dateIso) && dayIndex % 3 !== 1) ||
        (weekIndex % 3 === 0 && weekday === 2) ||
        (weekIndex % 5 === 2 && weekday === 0)
      ) {
        completed.add(habits[1].id);
      }
      if (
        [0, 1, 2, 3, 4].includes(weekday) &&
        !socialDates.has(dateIso) &&
        (dayIndex + weekIndex) % 4 !== 0
      ) {
        completed.add(habits[2].id);
      }
      if (
        [0, 1, 3, 5].includes(weekday) &&
        (dayIndex * 7 + weekIndex) % 7 !== 0 &&
        !socialDates.has(dateIso)
      ) {
        completed.add(habits[3].id);
      }
    }
    completions.set(dateIso, completed);
  });

  if (dates.length >= 35) {
    [0.04, 0.21, 0.39, 0.62, 0.83].forEach((ratio, markerCount) => {
      const dateIso = dates[Math.min(dates.length - 1, Math.floor(dates.length * ratio))];
      completions.set(
        dateIso,
        new Set(habits.slice(0, markerCount).map((habit) => habit.id))
      );
    });
  }

  const checkIns: Record<string, HabitCheckIn> = {};
  completions.forEach((habitIds, dateIso) => {
    habitIds.forEach((habitId) => {
      const key = getHabitCheckInKey(habitId, dateIso);
      checkIns[key] = {
        habitId,
        date: dateIso,
        completed: true,
        updatedAt: `${dateIso}T12:00:00.000Z`,
      };
    });
  });

  return {
    habits,
    checkIns,
    visibleHabitIds: habits.slice(0, 3).map((habit) => habit.id),
  };
};

export const getHabitRetrospectiveDates = (year: number, todayIso: string) => {
  const today = parseISO(todayIso);
  if (Number.isNaN(today.getTime())) return [];
  return Array.from({ length: 14 }, (_, offset) =>
    format(addDays(today, -offset), "yyyy-MM-dd")
  )
    .filter((dateIso) => Number(dateIso.slice(0, 4)) === year)
    .toReversed();
};

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

export const getCompletedHabitsForDate = (
  habits: Habit[],
  checkIns: Record<string, HabitCheckIn>,
  dateIso: string
) =>
  habits.filter((habit) =>
    Boolean(checkIns[getHabitCheckInKey(habit.id, dateIso)]?.completed)
  );

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
