import { expect, test } from "@playwright/test";
import { eachDayOfInterval } from "date-fns";

import {
  buildHabitPrototypeWeeks,
  buildOnboardingHabitShowcase,
  applyActiveHabitOrder,
  getCompletedHabitsForDate,
  getDesktopVisibleHabits,
  getHabitDayAction,
  getHabitCheckInKey,
  getHabitRetrospectiveDates,
  moveActiveHabit,
  orderActiveHabits,
  setHabitArchived,
} from "../../lib/habits-prototype";
import { getYearTransitionDirection } from "../../lib/calendar-year-transition";
import { PLAN_LIMITS, PRO_UPGRADE_COPY } from "../../lib/entitlements";
import type { CalendarEvent, CategoryItem, Habit } from "../../lib/types";
import { isHabitsPrototypeAvailable } from "../../lib/feature-flags";
import {
  buildProductDestinationUrl,
  PRODUCT_DESTINATIONS,
  resolveInitialProductDestination,
} from "../../lib/product-navigation";

test("monta o ano em semanas de segunda a domingo sem cortar dias", () => {
  const weeks = buildHabitPrototypeWeeks(2026, "2026-08-24");

  expect(weeks).toHaveLength(53);
  expect(weeks[0]?.days.map((day) => day.dateIso)).toEqual([
    "2025-12-29",
    "2025-12-30",
    "2025-12-31",
    "2026-01-01",
    "2026-01-02",
    "2026-01-03",
    "2026-01-04",
  ]);
  expect(weeks.at(-1)?.days.at(-1)?.dateIso).toBe("2027-01-03");
});

test("preserva o caso excepcional de 54 linhas", () => {
  expect(buildHabitPrototypeWeeks(2012, "2012-06-01")).toHaveLength(54);
});

test("distingue hoje, passado, futuro e dias externos", () => {
  const days = buildHabitPrototypeWeeks(2026, "2026-01-02").flatMap(
    (week) => week.days
  );

  expect(days.find((day) => day.dateIso === "2025-12-31")).toMatchObject({
    inYear: false,
  });
  expect(days.find((day) => day.dateIso === "2026-01-02")).toMatchObject({
    isToday: true,
    isFuture: false,
  });
  expect(days.find((day) => day.dateIso === "2026-01-03")).toMatchObject({
    isFuture: true,
  });
});

test("gera chave de check-in estável por hábito e data", () => {
  expect(getHabitCheckInKey("habit-1", "2026-08-24")).toBe(
    "habit-1:2026-08-24"
  );
});

test("monta quatro hábitos demonstrativos coerentes com o ano de exemplo", () => {
  const categories: CategoryItem[] = [
    { id: "travel", profileId: "personal", name: "Viagens", color: "#fff", visible: true },
    { id: "friends", profileId: "personal", name: "Amigos", color: "#fff", visible: true },
    { id: "events", profileId: "personal", name: "Eventos", color: "#fff", visible: true },
  ];
  const event = (
    id: string,
    title: string,
    categoryId: string,
    startDate: string,
    endDate = startDate
  ): CalendarEvent => ({
    id,
    title,
    categoryId,
    color: "#fff",
    startDate,
    endDate,
    createdAt: "2026-01-01T00:00:00.000Z",
    dayOrder: 0,
  });
  const events = [
    event("trip", "Férias em família — Maceió", "travel", "2026-07-25", "2026-07-30"),
    event("social", "Noite de fondue", "friends", "2026-08-20"),
    event("books", "Feira do Livro", "events", "2026-10-30", "2026-11-15"),
  ];
  const showcase = buildOnboardingHabitShowcase({
    year: 2026,
    todayIso: "2026-12-31",
    events,
    categories,
  });
  const repeated = buildOnboardingHabitShowcase({
    year: 2026,
    todayIso: "2026-12-31",
    events,
    categories,
  });

  expect(showcase).toEqual(repeated);
  expect(showcase.habits.map((habit) => habit.name)).toEqual([
    "Exercício",
    "Ler 20 minutos",
    "Dormir antes das 23h",
    "Dia sem fumar",
  ]);
  expect(showcase.visibleHabitIds).toEqual(
    showcase.habits.slice(0, 3).map((habit) => habit.id)
  );
  expect(showcase.visibleHabitIds).not.toContain(showcase.habits[3]?.id);

  const [exercise, reading, sleep, smokeFree] = showcase.habits;
  const completed = (habitId: string, dateIso: string) =>
    Boolean(showcase.checkIns[getHabitCheckInKey(habitId, dateIso)]?.completed);
  for (const dateIso of ["2026-07-25", "2026-07-26", "2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30"]) {
    expect(completed(exercise.id, dateIso)).toBe(false);
  }
  expect(
    ["2026-07-25", "2026-07-26", "2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30"].some(
      (dateIso) => completed(reading.id, dateIso)
    )
  ).toBe(true);
  expect(completed(sleep.id, "2026-08-20")).toBe(false);

  const smokeFreeCount = Object.values(showcase.checkIns).filter(
    (checkIn) => checkIn.habitId === smokeFree.id
  ).length;
  expect(smokeFreeCount).toBeGreaterThan(150);
  expect(smokeFreeCount).toBeLessThan(240);

  const exerciseCount = Object.values(showcase.checkIns).filter(
    (checkIn) => checkIn.habitId === exercise.id
  ).length;
  const readingCount = Object.values(showcase.checkIns).filter(
    (checkIn) => checkIn.habitId === reading.id
  ).length;
  expect(exerciseCount).toBeGreaterThan(readingCount);
  expect(exerciseCount).toBeLessThan(160);
  expect(readingCount).toBeLessThan(100);

  const markerCounts = new Set<number>();
  for (const dateIso of eachDayOfInterval({
    start: new Date("2026-01-01T12:00:00Z"),
    end: new Date("2026-12-31T12:00:00Z"),
  }).map((date) => date.toISOString().slice(0, 10))) {
    markerCounts.add(
      showcase.habits.filter((habit) => completed(habit.id, dateIso)).length
    );
  }
  expect([...markerCounts].toSorted()).toEqual([0, 1, 2, 3, 4]);
});

test("não cria check-ins demonstrativos no futuro", () => {
  const showcase = buildOnboardingHabitShowcase({
    year: 2026,
    todayIso: "2026-08-26",
    events: [],
    categories: [],
  });
  expect(
    Object.values(showcase.checkIns).every(
      (checkIn) => checkIn.date <= "2026-08-26"
    )
  ).toBe(true);
});

test("calcula retrospectiva inclusiva de 14 dias limitada ao ano", () => {
  expect(getHabitRetrospectiveDates(2026, "2026-08-26")).toEqual([
    "2026-08-13",
    "2026-08-14",
    "2026-08-15",
    "2026-08-16",
    "2026-08-17",
    "2026-08-18",
    "2026-08-19",
    "2026-08-20",
    "2026-08-21",
    "2026-08-22",
    "2026-08-23",
    "2026-08-24",
    "2026-08-25",
    "2026-08-26",
  ]);
  expect(getHabitRetrospectiveDates(2026, "2026-01-05")).toEqual([
    "2026-01-01",
    "2026-01-02",
    "2026-01-03",
    "2026-01-04",
    "2026-01-05",
  ]);
});

test("resolve dias vazios como criação sem liberar futuro ou dias externos", () => {
  expect(
    getHabitDayAction({
      inYear: true,
      isFuture: false,
      hasSelectedHabit: false,
    })
  ).toBe("create");
  expect(
    getHabitDayAction({
      inYear: true,
      isFuture: false,
      hasSelectedHabit: true,
    })
  ).toBe("toggle");
  expect(
    getHabitDayAction({
      inYear: true,
      isFuture: true,
      hasSelectedHabit: false,
    })
  ).toBe("blocked");
  expect(
    getHabitDayAction({
      inYear: false,
      isFuture: false,
      hasSelectedHabit: false,
    })
  ).toBe("blocked");
});

test("ordena hábitos ativos e limita a apresentação desktop aos quatro primeiros", () => {
  const habit = (id: string, position: number, archivedAt?: string): Habit => ({
    id,
    name: id,
    color: "#2563eb",
    icon: "circle-check",
    position,
    archivedAt,
    createdAt: `2026-01-0${position + 1}T00:00:00.000Z`,
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const habits = [habit("cinco", 4), habit("dois", 1), habit("um", 0), habit("arquivado", 2, "2026-02-01"), habit("quatro", 3), habit("tres", 2)];

  expect(orderActiveHabits(habits).map((item) => item.id)).toEqual([
    "um",
    "dois",
    "tres",
    "quatro",
    "cinco",
  ]);
  expect(getDesktopVisibleHabits(habits).map((item) => item.id)).toEqual([
    "um",
    "dois",
    "tres",
    "quatro",
  ]);
});

test("empilha apenas hábitos concluídos preservando a ordem visível", () => {
  const habits = ["primeiro", "segundo", "terceiro", "quarto"].map(
    (id, position): Habit => ({
      id,
      name: id,
      color: "#2563eb",
      icon: "circle-check",
      position,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    })
  );
  const dateIso = "2026-08-26";
  const checkIns = {
    [`segundo:${dateIso}`]: {
      habitId: "segundo",
      date: dateIso,
      completed: true,
      updatedAt: "2026-08-26T12:00:00.000Z",
    },
    [`quarto:${dateIso}`]: {
      habitId: "quarto",
      date: dateIso,
      completed: true,
      updatedAt: "2026-08-26T12:00:00.000Z",
    },
  };

  expect(
    getCompletedHabitsForDate(habits, checkIns, dateIso).map((habit) => habit.id)
  ).toEqual(["segundo", "quarto"]);
});

test("reordena, arquiva e restaura hábitos sem apagar os demais dados", () => {
  const habit = (id: string, position: number): Habit => ({
    id,
    name: id,
    color: "#2563eb",
    icon: "circle-check",
    position,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const timestamp = "2026-08-25T12:00:00.000Z";
  const reordered = moveActiveHabit(
    [habit("um", 0), habit("dois", 1)],
    "um",
    1,
    timestamp
  );
  expect(orderActiveHabits(reordered).map((item) => item.id)).toEqual([
    "dois",
    "um",
  ]);

  const archived = setHabitArchived(reordered, "um", timestamp, timestamp);
  expect(orderActiveHabits(archived).map((item) => item.id)).toEqual(["dois"]);
  expect(archived.find((item) => item.id === "um")?.name).toBe("um");

  const restored = setHabitArchived(archived, "um", undefined, timestamp, 1);
  expect(orderActiveHabits(restored).map((item) => item.id)).toEqual([
    "dois",
    "um",
  ]);

  const persisted = applyActiveHabitOrder(restored, ["um", "dois"], timestamp);
  expect(orderActiveHabits(persisted).map((item) => item.id)).toEqual([
    "um",
    "dois",
  ]);
});

test("resolve a direção visual ao navegar entre anos", () => {
  expect(getYearTransitionDirection(2026, 2027)).toBe(1);
  expect(getYearTransitionDirection(2026, 2025)).toBe(-1);
});

test("define um hábito Free e quatro Pro com upgrade contextual", () => {
  expect(PLAN_LIMITS.free.maxHabits).toBe(1);
  expect(PLAN_LIMITS.pro.maxHabits).toBe(4);
  expect(PRO_UPGRADE_COPY.habits.description).toContain("1 hábito");
  expect(PRO_UPGRADE_COPY.habits.description).toContain("4 hábitos");
});

test("mantém o protótipo indisponível em produção", () => {
  expect(
    isHabitsPrototypeAvailable({ flag: "true", deploymentEnv: "production" })
  ).toBe(false);
  expect(
    isHabitsPrototypeAvailable({ flag: "true", deploymentEnv: "preview" })
  ).toBe(true);
  expect(
    isHabitsPrototypeAvailable({ flag: "true", nodeEnv: "development" })
  ).toBe(true);
  expect(
    isHabitsPrototypeAvailable({ flag: "false", deploymentEnv: "preview" })
  ).toBe(false);
});

test("expõe somente os destinos funcionais da navegação", () => {
  expect(PRODUCT_DESTINATIONS.map(({ id, label }) => ({ id, label }))).toEqual([
    { id: "annual", label: "Anual" },
    { id: "habits", label: "Hábitos" },
  ]);
});

test("resolve a superfície inicial pelo endereço antes do breakpoint", () => {
  expect(
    resolveInitialProductDestination({ search: "", isMobile: true })
  ).toBe("habits");
  expect(
    resolveInitialProductDestination({ search: "", isMobile: false })
  ).toBe("annual");
  expect(
    resolveInitialProductDestination({
      search: "?surface=annual",
      isMobile: true,
    })
  ).toBe("annual");
  expect(
    resolveInitialProductDestination({
      search: "?surface=habits",
      isMobile: false,
    })
  ).toBe("habits");
});

test("atualiza somente o parâmetro da superfície no endereço", () => {
  expect(
    buildProductDestinationUrl(
      "https://doze52.test/?mobileUi=1&surface=annual#today",
      "habits"
    )
  ).toBe("/?mobileUi=1&surface=habits#today");
});
