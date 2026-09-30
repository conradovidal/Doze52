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

// A vitrine conta a mesma história do ano de exemplo dos Eventos: alguém
// que se prepara para um Ironman em 2026 e, fora do treino, cuida do básico
// (ler, dormir cedo). O contexto genérico mostra a rotina de todo mundo; o
// focado mostra que um objetivo com várias modalidades vira um contexto
// próprio. As marcações são lidas das fases dos Eventos (categorias
// "Provas", "Treino" e "Saúde", pelo título): base, polimento, recuperação,
// fisioterapia, volta gradual, construção e as provas — é o que liga Hábitos
// a Eventos. As datas são contrato do conteúdo: veja os testes.
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
  const iso = (date: Date) => format(date, "yyyy-MM-dd");
  const shift = (dateIso: string, days: number) =>
    iso(addDays(parseISO(dateIso), days));
  const travelOrVacationDates = new Set<string>();
  const readingBoostDates = new Set<string>();
  const lateNightDates = new Set<string>();
  const transitionDates = new Set<string>();
  // Fases e provas vindas dos Eventos.
  const raceDates = new Set<string>();
  const buildDates = new Set<string>();
  const taperDates = new Set<string>();
  const ironmanTaperDates = new Set<string>();
  const physioDates = new Set<string>();
  const returnToRunningDates = new Set<string>();
  const launchWeekDates = new Set<string>();
  const weddingDates = new Set<string>();
  const recoveryStartByDate = new Map<string, string>();
  let signupIso: string | null = null;
  let finalRecovery: { startDate: string; endDate: string } | null = null;
  let carnivalTuesdayIso: string | null = null;

  events.forEach((event) => {
    const title = normalizeShowcaseLabel(event.title);
    const categoryName = categoryNameById.get(event.categoryId) ?? "";
    // Viagem é a categoria Viagens, férias e Ano Novo. Carnaval e fim de
    // semana no título não bastam (o feriado "Terça-feira de Carnaval" não
    // é viagem).
    const isTravelOrVacation =
      categoryName.includes("viagen") ||
      title.includes("ferias") ||
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
    if (title.includes("terca-feira de carnaval") && event.startDate.startsWith(String(year))) {
      carnivalTuesdayIso = event.startDate;
    }
    if (title.includes("lancamento da campanha")) {
      // Só de segunda a sexta: o fim de semana volta ao padrão da fase.
      const week = new Set<string>();
      addEventDates(week, event, yearStartIso, cutoffIso);
      week.forEach((dateIso) => {
        const weekday = parseISO(dateIso).getDay();
        if (weekday >= 1 && weekday <= 5) launchWeekDates.add(dateIso);
      });
    }
    if (title.includes("casamento")) {
      addEventDates(weddingDates, event, yearStartIso, cutoffIso);
    }
    const isTriathlon = categoryName.includes("prova");
    if (isTriathlon) {
      // Prova: evento de um dia só (a inscrição não conta).
      if (title.includes("inscri")) {
        if (!signupIso || event.startDate < signupIso) signupIso = event.startDate;
      } else if (event.startDate === event.endDate) {
        raceDates.add(event.startDate);
      }
    } else if (categoryName.includes("treino") || categoryName.includes("saude")) {
      if (title.includes("recuperacao")) {
        recoveryStartByDate.set(event.startDate, event.endDate);
        if (!finalRecovery || event.endDate > finalRecovery.endDate) {
          finalRecovery = { startDate: event.startDate, endDate: event.endDate };
        }
      } else if (title.includes("polimento")) {
        addEventDates(taperDates, event, yearStartIso, cutoffIso);
        if (title.includes("ironman")) {
          addEventDates(ironmanTaperDates, event, yearStartIso, cutoffIso);
        }
      } else if (title.startsWith("fisioterapia")) {
        addEventDates(physioDates, event, yearStartIso, cutoffIso);
      } else if (title.includes("volta gradual")) {
        addEventDates(returnToRunningDates, event, yearStartIso, cutoffIso);
      } else if (title.includes("construcao")) {
        addEventDates(buildDates, event, yearStartIso, cutoffIso);
      }
    }
  });

  // Recuperação: os 7 primeiros dias sem nada do triatlo, depois só o
  // básico (nadar na terça, correr na quinta). A última é a final, depois
  // da prova principal; as datas de cada uma vêm do próprio evento.
  const recoveryDayOf = new Map<string, number>();
  recoveryStartByDate.forEach((endDate, startDate) => {
    eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) }).forEach(
      (date, offset) => recoveryDayOf.set(iso(date), offset)
    );
  });
  const finalRecoveryEndIso = finalRecovery
    ? (finalRecovery as { endDate: string }).endDate
    : null;

  // Bloco de Carnaval: do sábado antes da terça até a Quarta de Cinzas. Usa
  // o feriado do pacote; sem ele, a Páscoa menos 47 dias.
  const easterIso = (() => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  })();
  const carnivalTuesday = carnivalTuesdayIso ?? shift(easterIso, -47);
  const carnivalPlan = new Map<
    string,
    { train: ShowcaseHabitKey[]; read: boolean }
  >([
    [shift(carnivalTuesday, -3), { train: ["bike"], read: true }],
    [shift(carnivalTuesday, -2), { train: ["run"], read: true }],
    [shift(carnivalTuesday, -1), { train: ["swim", "strength"], read: true }],
    [carnivalTuesday, { train: ["bike", "run"], read: true }],
    [shift(carnivalTuesday, 1), { train: ["swim"], read: false }],
  ]);

  const hasPhases = buildDates.size > 0 || raceDates.size > 0 || signupIso !== null;
  // As bases não são eventos: a de antes do sprint começa na primeira
  // segunda-feira depois da inscrição; a de antes do Ironman é o que sobra
  // depois do sprint e da primeira recuperação, até a próxima fase.
  const sortedRaces = [...raceDates].sort();
  const firstRaceIso = sortedRaces[0] ?? null;
  const sprintBaseStartIso = (() => {
    if (!signupIso) return null;
    const signup = parseISO(signupIso);
    return iso(addDays(signup, ((8 - signup.getDay()) % 7) || 7));
  })();

  // Plano semanal de cada fase (0 = domingo). A "sessão perdida" de vez em
  // quando fica em applyMissedSession, só nas bases e na construção.
  type Phase = "pre" | "sprintBase" | "ironmanBase" | "build" | "taper" | "physio" | "returnToRunning" | "final";
  const weeklyPlan = (
    phase: Phase,
    weekday: number,
    weekIndex: number
  ): ShowcaseHabitKey[] => {
    const keys: ShowcaseHabitKey[] = [];
    const swim = [2, 4, 6];
    const bike = [3, 6];
    const run = [1, 4, 0];
    switch (phase) {
      case "pre":
        if ([1, 4].includes(weekday)) keys.push("run");
        break;
      case "sprintBase":
        if ([2, 4].includes(weekday)) keys.push("swim");
        if ([3, 6].includes(weekday)) keys.push("bike");
        if (run.includes(weekday)) keys.push("run");
        // A intenção era força 2x por semana; na prática some.
        if (weekday === 1 && weekIndex % 3 === 0) keys.push("strength");
        break;
      case "ironmanBase":
      case "build":
      case "returnToRunning":
      case "physio":
        if (swim.includes(weekday)) keys.push("swim");
        if (bike.includes(weekday)) keys.push("bike");
        if (phase === "returnToRunning") {
          if ([2, 6].includes(weekday)) keys.push("run");
        } else if (phase !== "physio" && run.includes(weekday)) {
          keys.push("run");
        }
        if (phase === "build") {
          if (weekday === 5) keys.push("strength");
        } else if (phase === "physio") {
          if ([1, 3, 5].includes(weekday)) keys.push("strength");
        } else if ([1, 5].includes(weekday)) {
          keys.push("strength");
        }
        break;
      case "taper":
        if ([2, 4].includes(weekday)) keys.push("swim");
        if (weekday === 6) keys.push("bike");
        if ([1, 4].includes(weekday)) keys.push("run");
        break;
      case "final":
        if (weekday === 3) keys.push("swim");
        if ([2, 6].includes(weekday)) keys.push("run");
        if ([1, 4].includes(weekday)) keys.push("strength");
        break;
    }
    return keys;
  };
  const phaseOf = (dateIso: string): Phase => {
    if (taperDates.has(dateIso)) return "taper";
    if (physioDates.has(dateIso)) return "physio";
    if (returnToRunningDates.has(dateIso)) return "returnToRunning";
    if (buildDates.has(dateIso)) return "build";
    if (finalRecoveryEndIso && dateIso > finalRecoveryEndIso) return "final";
    if (firstRaceIso && dateIso > firstRaceIso) return "ironmanBase";
    if (sprintBaseStartIso && dateIso >= sprintBaseStartIso) return "sprintBase";
    if (!hasPhases) return "build";
    return "pre";
  };
  // Uma sessão perdida a cada poucas semanas, só nas bases e na construção.
  // É uma sessão só (a força fica de fora): nunca duas em sequência.
  const missedSessionOfWeek = (
    weekStartIso: string,
    weekIndex: number
  ): { dateIso: string; key: ShowcaseHabitKey } | null => {
    if (weekIndex % 5 !== 3) return null;
    const sessions: Array<{ dateIso: string; key: ShowcaseHabitKey }> = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const dateIso = shift(weekStartIso, offset);
      const phase = phaseOf(dateIso);
      if (phase !== "sprintBase" && phase !== "ironmanBase" && phase !== "build") continue;
      if (launchWeekDates.has(dateIso) || weddingDates.has(dateIso)) continue;
      weeklyPlan(phase, parseISO(dateIso).getDay(), weekIndex).forEach((key) => {
        if (key !== "strength") sessions.push({ dateIso, key });
      });
    }
    return sessions.length ? sessions[(weekIndex * 3) % sessions.length] : null;
  };

  const dates = eachDayOfInterval({
    start: parseISO(yearStartIso),
    end: parseISO(cutoffIso),
  }).map((date) => iso(date));
  const yearStartWeekOffset = (parseISO(yearStartIso).getDay() + 6) % 7;
  const completions = new Map<string, Set<string>>();
  dates.forEach((dateIso, dayIndex) => {
    const weekday = parseISO(dateIso).getDay(); // 0 = domingo
    const weekIndex = Math.floor((dayIndex + yearStartWeekOffset) / 7);
    const weekStartIso = shift(dateIso, -((weekday + 6) % 7));
    const completed = new Set<string>();
    const mark = (...keys: ShowcaseHabitKey[]) =>
      keys.forEach((key) => completed.add(habitId[key]));
    const isRaceDay = raceDates.has(dateIso);
    const carnival = carnivalPlan.get(dateIso);
    const inBuild = buildDates.has(dateIso) && !physioDates.has(dateIso);
    const isLaunchDay = launchWeekDates.has(dateIso);
    const isWedding = weddingDates.has(dateIso);
    const afterWedding = weddingDates.has(shift(dateIso, -1));
    const raceEve = raceDates.has(shift(dateIso, 1));
    const recoveryDay = recoveryDayOf.get(dateIso);
    const traveling = travelOrVacationDates.has(dateIso);
    // Dia de ida ou volta de viagem: nada acontece — salvo nos dias que já
    // têm plano próprio (prova, Carnaval, fases especiais).
    const special =
      isRaceDay ||
      Boolean(carnival) ||
      recoveryDay !== undefined ||
      taperDates.has(dateIso) ||
      physioDates.has(dateIso) ||
      returnToRunningDates.has(dateIso) ||
      isLaunchDay ||
      isWedding ||
      afterWedding;
    const blank = transitionDates.has(dateIso) && !special;

    // --- Treino ---
    if (isRaceDay) {
      mark("swim", "bike", "run");
    } else if (carnival) {
      mark(...carnival.train);
    } else if (recoveryDay !== undefined) {
      if (recoveryDay >= 7) {
        if (weekday === 2) mark("swim");
        if (weekday === 4) mark("run");
      }
    } else if (taperDates.has(dateIso)) {
      mark(...weeklyPlan("taper", weekday, weekIndex));
    } else if (physioDates.has(dateIso)) {
      mark(...weeklyPlan("physio", weekday, weekIndex));
    } else if (returnToRunningDates.has(dateIso)) {
      mark(...weeklyPlan("returnToRunning", weekday, weekIndex));
    } else if (isLaunchDay) {
      // Semana do lançamento: só duas corridas.
      if (weekday === 2 || weekday === 4) mark("run");
    } else if (isWedding) {
      // Sábado do casamento: nada.
    } else if (afterWedding) {
      mark("bike");
    } else if (blank) {
      // Ida ou volta da viagem.
    } else if (traveling) {
      if (dayIndex % 2 === 1) mark("run");
    } else {
      const phase = phaseOf(dateIso);
      const missed = missedSessionOfWeek(weekStartIso, weekIndex);
      weeklyPlan(phase, weekday, weekIndex).forEach((key) => {
        if (missed && missed.dateIso === dateIso && missed.key === key) return;
        mark(key);
      });
    }

    // --- Hábitos do contexto padrão ---
    if (carnival) {
      mark("sleep");
      if (carnival.read) mark("reading");
    } else if (!blank) {
      // Ler: seg, ter, qui e dom; na construção, só o domingo; nas viagens,
      // na Feira do Livro, no polimento do Ironman e depois da recuperação
      // final, quase todo dia.
      const afterFinalRecovery = Boolean(finalRecoveryEndIso && dateIso > finalRecoveryEndIso);
      const boosted =
        readingBoostDates.has(dateIso) ||
        ironmanTaperDates.has(dateIso) ||
        afterFinalRecovery;
      const standardReading = inBuild ? weekday === 0 : [1, 2, 4, 0].includes(weekday);
      if (!isWedding && !isLaunchDay && ((boosted && dayIndex % 3 !== 1) || standardReading)) {
        mark("reading");
      }
    }
    if (!carnival) {
      // Dormir cedo: noite de semana sim, fim de semana raro, nunca em noite
      // com amigos, festa, show ou aniversário. Na construção, toda noite;
      // no polimento e na véspera da prova, sempre. Na semana do lançamento,
      // só segunda e quarta; no sábado do casamento, nenhuma.
      const weekendNight = weekday === 5 || weekday === 6;
      const alwaysEarly = taperDates.has(dateIso) || raceEve || inBuild;
      let sleeps: boolean;
      if (isWedding) sleeps = false;
      else if (isLaunchDay) sleeps = weekday === 1 || weekday === 3;
      else if (alwaysEarly) sleeps = true;
      else if (blank) sleeps = false;
      else if (traveling) sleeps = dayIndex % 2 === 0;
      else if (weekendNight) sleeps = weekIndex % 4 === 1;
      else sleeps = dayIndex % 9 !== 4;
      if (sleeps && !lateNightDates.has(dateIso)) mark("sleep");
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
