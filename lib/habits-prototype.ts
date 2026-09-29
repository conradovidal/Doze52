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
  CATEGORY_COLOR_BASE_AMBER,
  CATEGORY_COLOR_BASE_BLUE,
  CATEGORY_COLOR_BASE_CORAL,
  CATEGORY_COLOR_BASE_INDIGO,
  CATEGORY_COLOR_BASE_RED,
  CATEGORY_COLOR_BASE_TEAL,
} from "@/lib/category-palette";
import { DEFAULT_HABIT_CONTEXT_ID } from "@/lib/habit-contexts";
import type {
  CalendarEvent,
  CategoryItem,
  Habit,
  HabitCheckIn,
  HabitContext,
} from "@/lib/types";

// Quantas marcações cabem empilhadas num dia do Anual de hábitos. Acima
// disso o dia mostra HABIT_DAY_MARKER_SLOTS - 1 bolinhas e um "+N" no último
// espaço (ver getHabitDayMarkers) — a altura do mês nunca passa de 4.
export const HABIT_DAY_MARKER_SLOTS = 4;

export type OnboardingHabitShowcase = {
  habits: Habit[];
  checkIns: Record<string, HabitCheckIn>;
  visibleHabitIds: string[];
  /**
   * Contextos que só existem na vitrine (hoje, "Triatlo"). Os hábitos
   * genéricos moram no "Hábitos" padrão, que a pessoa já tem.
   */
  contexts: HabitContext[];
};

// A vitrine conta a história de uma pessoa só: alguém que treina para um
// triatlo e, fora do treino, cuida do básico (ler, dormir cedo). O contexto
// genérico mostra a rotina de todo mundo; o focado mostra que um objetivo
// com várias modalidades vira um contexto próprio. As marcações seguem as
// viagens e eventos do ano de exemplo — é o que liga Hábitos a Eventos.
export const ONBOARDING_TRIATHLON_CONTEXT_ID = "onboarding-context-triathlon";

const ONBOARDING_SHOWCASE_CONTEXTS = [
  {
    id: ONBOARDING_TRIATHLON_CONTEXT_ID,
    name: "Triatlo",
    icon: "dumbbell",
  },
] as const;

const ONBOARDING_HABIT_SHOWCASE_DEFINITIONS = [
  {
    id: "onboarding-habit-reading",
    name: "Ler 20 minutos",
    color: CATEGORY_COLOR_BASE_CORAL,
    contextId: DEFAULT_HABIT_CONTEXT_ID,
  },
  {
    id: "onboarding-habit-sleep",
    name: "Dormir cedo",
    color: CATEGORY_COLOR_BASE_INDIGO,
    contextId: DEFAULT_HABIT_CONTEXT_ID,
  },
  {
    id: "onboarding-habit-swim",
    name: "Nadar",
    color: CATEGORY_COLOR_BASE_BLUE,
    contextId: ONBOARDING_TRIATHLON_CONTEXT_ID,
  },
  {
    id: "onboarding-habit-bike",
    name: "Pedalar",
    color: CATEGORY_COLOR_BASE_AMBER,
    contextId: ONBOARDING_TRIATHLON_CONTEXT_ID,
  },
  {
    id: "onboarding-habit-run",
    name: "Correr",
    color: CATEGORY_COLOR_BASE_TEAL,
    contextId: ONBOARDING_TRIATHLON_CONTEXT_ID,
  },
  {
    id: "onboarding-habit-strength",
    name: "Treino de força",
    color: CATEGORY_COLOR_BASE_RED,
    contextId: ONBOARDING_TRIATHLON_CONTEXT_ID,
  },
] as const;

type ShowcaseHabitKey = "reading" | "sleep" | "swim" | "bike" | "run" | "strength";

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
  const contexts = ONBOARDING_SHOWCASE_CONTEXTS.map(
    (definition, index): HabitContext => ({
      ...definition,
      // Depois do "Hábitos" padrão (posição 0).
      position: index + 1,
      createdAt,
      updatedAt: createdAt,
    })
  );
  const positionInContext = new Map<string, number>();
  const habits = ONBOARDING_HABIT_SHOWCASE_DEFINITIONS.map((definition): Habit => {
    const position = positionInContext.get(definition.contextId) ?? 0;
    positionInContext.set(definition.contextId, position + 1);
    return {
      ...definition,
      icon: "circle-check",
      position,
      createdAt,
      updatedAt: createdAt,
    };
  });
  const habitId = Object.fromEntries(
    habits.map((habit) => [habit.id.replace("onboarding-habit-", ""), habit.id])
  ) as Record<ShowcaseHabitKey, string>;
  if (cutoffIso < yearStartIso) {
    return {
      habits,
      checkIns: {},
      visibleHabitIds: habits.map((habit) => habit.id),
      contexts,
    };
  }

  const categoryNameById = new Map(
    categories.map((category) => [category.id, normalizeShowcaseLabel(category.name)])
  );
  const travelOrVacationDates = new Set<string>();
  const readingBoostDates = new Set<string>();
  const lateNightDates = new Set<string>();
  const transitionDates = new Set<string>();
  // Provas e fases do triatlo vindas dos Eventos (categoria "Triatlo" do
  // ano de exemplo): é aqui que Hábitos e Eventos contam a mesma história.
  const raceDates = new Set<string>();
  const taperDates = new Set<string>();
  const recoveryDates = new Set<string>();
  let trainingStartIso: string | null = null;

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
    // Noite com amigos, festa ou show: dormir cedo não rola.
    const isLateNight =
      categoryName.includes("amigo") ||
      title.includes("noite") ||
      title.includes("festa") ||
      title.includes("show") ||
      title.includes("aniversario");

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
    if (isLateNight) {
      addEventDates(lateNightDates, event, yearStartIso, cutoffIso);
    }
    if (categoryName.includes("triatlo")) {
      if (title.includes("polimento")) {
        addEventDates(taperDates, event, yearStartIso, cutoffIso);
      } else if (title.includes("inscri")) {
        // A temporada começa na inscrição; antes dela, só manutenção.
        if (!trainingStartIso || event.startDate < trainingStartIso) {
          trainingStartIso = event.startDate;
        }
      } else if (event.startDate === event.endDate) {
        raceDates.add(event.startDate);
        // Dois dias de recuperação depois de cada prova.
        [1, 2].forEach((offset) =>
          recoveryDates.add(format(addDays(parseISO(event.startDate), offset), "yyyy-MM-dd"))
        );
      }
    }
  });

  const dates = eachDayOfInterval({
    start: parseISO(yearStartIso),
    end: parseISO(cutoffIso),
  }).map((date) => format(date, "yyyy-MM-dd"));
  const yearStartWeekOffset = (parseISO(yearStartIso).getDay() + 6) % 7;
  const completions = new Map<string, Set<string>>();
  dates.forEach((dateIso, dayIndex) => {
    const weekday = parseISO(dateIso).getDay(); // 0 = domingo
    const weekIndex = Math.floor((dayIndex + yearStartWeekOffset) / 7);
    const completed = new Set<string>();
    const traveling = travelOrVacationDates.has(dateIso);
    // Dia de ida ou volta de viagem: nada acontece.
    if (!transitionDates.has(dateIso)) {
      // Ler: mais nas férias e na Feira do Livro, de vez em quando no resto.
      if (
        (readingBoostDates.has(dateIso) && dayIndex % 3 !== 1) ||
        (weekIndex % 3 === 0 && weekday === 2) ||
        (weekIndex % 5 === 2 && weekday === 0)
      ) {
        completed.add(habitId.reading);
      }
      // Dormir cedo: quase toda noite de semana; sexta e sábado raramente;
      // nunca em noite de evento; nas férias, metade das noites.
      const weekendNight = weekday === 5 || weekday === 6;
      // Na véspera da prova e no polimento, dorme cedo sempre.
      const racePrep =
        taperDates.has(dateIso) ||
        raceDates.has(format(addDays(parseISO(dateIso), 1), "yyyy-MM-dd"));
      if (
        !lateNightDates.has(dateIso) &&
        (racePrep ||
          (traveling
            ? dayIndex % 2 === 0
            : weekendNight
              ? weekIndex % 4 === 1
              : dayIndex % 9 !== 4))
      ) {
        completed.add(habitId.sleep);
      }
      // Triatlo: dia de prova tem as três modalidades; depois dela,
      // recuperação; no polimento, volume menor e sem força; antes da
      // inscrição, só manutenção. Fora disso, plano semanal de três
      // modalidades + força. Viajando, só corrida leve em dias alternados.
      if (raceDates.has(dateIso)) {
        completed.add(habitId.swim);
        completed.add(habitId.bike);
        completed.add(habitId.run);
      } else if (recoveryDates.has(dateIso)) {
        // Descanso de verdade.
      } else if (taperDates.has(dateIso)) {
        if (weekday === 2 || weekday === 4) completed.add(habitId.swim);
        if (weekday === 6) completed.add(habitId.bike);
        if (weekday === 1 || weekday === 4) completed.add(habitId.run);
      } else if (trainingStartIso && dateIso < trainingStartIso) {
        if (weekday === 1 || weekday === 4) completed.add(habitId.run);
        if (weekday === 5) completed.add(habitId.strength);
      } else if (traveling) {
        if (dayIndex % 2 === 1) completed.add(habitId.run);
      } else {
        // Uma sessão perdida a cada poucas semanas, como na vida real.
        const skipped = weekIndex % 5 === 3 ? weekday : -1;
        const plan: Array<[ShowcaseHabitKey, boolean]> = [
          ["swim", weekday === 2 || weekday === 4 || (weekday === 6 && weekIndex % 3 === 0)],
          ["bike", weekday === 3 || weekday === 6],
          // Seg leve, qui intervalado, dom longão; sábado alterna o "brick"
          // (pedal seguido de corrida).
          ["run", weekday === 1 || weekday === 4 || weekday === 0 || (weekday === 6 && weekIndex % 2 === 1)],
          ["strength", weekday === 1 || weekday === 5],
        ];
        plan.forEach(([key, scheduled], order) => {
          if (!scheduled) return;
          if (weekday === skipped && order === weekIndex % plan.length) return;
          completed.add(habitId[key]);
        });
      }
    }
    completions.set(dateIso, completed);
  });

  const checkIns: Record<string, HabitCheckIn> = {};
  completions.forEach((habitIds, dateIso) => {
    habitIds.forEach((id) => {
      const key = getHabitCheckInKey(id, dateIso);
      checkIns[key] = {
        habitId: id,
        date: dateIso,
        completed: true,
        updatedAt: `${dateIso}T12:00:00.000Z`,
      };
    });
  });

  return {
    habits,
    checkIns,
    visibleHabitIds: habits.map((habit) => habit.id),
    contexts,
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
  orderActiveHabits(habits);

/** Bolinhas de um dia: todas até caber; senão as primeiras e quantas sobraram. */
export const getHabitDayMarkers = <T>(completed: T[]) =>
  completed.length <= HABIT_DAY_MARKER_SLOTS
    ? { visible: completed, overflow: 0 }
    : {
        visible: completed.slice(0, HABIT_DAY_MARKER_SLOTS - 1),
        overflow: completed.length - (HABIT_DAY_MARKER_SLOTS - 1),
      };

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

// Geometria da pilha de bolinhas de hábito em components/calendar/day-cell.tsx
// (top-[30px], bottom-1, size-[clamp(12px,1.1vw,18px)], gap-0.5): se um desses
// valores mudar lá, atualize as constantes abaixo junto — é o que essa altura
// mínima precisa caber.
const HABIT_DOT_MAX_PX = 18;
const HABIT_DOT_GAP_PX = 2;
const HABIT_STACK_TOP_OFFSET_PX = 30;
const HABIT_STACK_BOTTOM_OFFSET_PX = 4;
// Mesma regra do Anual de eventos: por padrão o mês comporta 2 (eventos lá,
// hábitos marcados no mesmo dia aqui) e só cresce a partir do 3º. Com 2
// hábitos a altura dá 72px — igual a um mês com 2 linhas de evento
// (MONTH_EVENTS_MIN_TOP_OFFSET + 2 cápsulas + padding do Anual), então as
// duas telas têm o mesmo tamanho de ano. As bolinhas usam
// clamp(12px,1.1vw,18px) e a conta usa o máximo, o que já sobra folga.
const HABIT_ROWS_BEFORE_GROWTH = 2;

export const getDesktopHabitRowMinHeight = (visibleHabitCount: number) => {
  const count = Math.max(
    HABIT_ROWS_BEFORE_GROWTH,
    Math.min(HABIT_DAY_MARKER_SLOTS, visibleHabitCount)
  );
  const stackHeightPx =
    count * HABIT_DOT_MAX_PX + (count - 1) * HABIT_DOT_GAP_PX;
  return HABIT_STACK_TOP_OFFSET_PX + HABIT_STACK_BOTTOM_OFFSET_PX + stackHeightPx;
};

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
  const monthLabelStartIndices: number[] = [];

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

    if (firstOfMonth) monthLabelStartIndices.push(weeks.length);

    weeks.push({
      id: format(weekStart, "yyyy-MM-dd"),
      monthLabel: firstOfMonth
        ? MONTH_LABELS[Number(firstOfMonth.dateIso.slice(5, 7)) - 1] ?? null
        : null,
      days,
    });
  }

  // O rótulo do mês fica na linha do dia 1. Se essa linha só carrega 3 dias
  // do mês ou menos (o resto é do mês anterior), o rótulo desce para a linha
  // seguinte — assim ele sempre aparece perto do começo visível do mês, e não
  // encostado no fim do mês anterior.
  for (const startIndex of monthLabelStartIndices) {
    const firstDayIndex = weeks[startIndex].days.findIndex(
      (day) => day.inYear && day.dayOfMonth === 1
    );
    const daysOfMonthInFirstRow = 7 - firstDayIndex;
    if (daysOfMonthInFirstRow > 3 || startIndex + 1 >= weeks.length) continue;
    weeks[startIndex + 1].monthLabel = weeks[startIndex].monthLabel;
    weeks[startIndex].monthLabel = null;
  }

  return weeks;
};
