import { expect, test } from "@playwright/test";
import { eachDayOfInterval } from "date-fns";

import {
  buildHabitPrototypeWeeks,
  buildOnboardingHabitShowcase,
  applyActiveHabitOrder,
  getCompletedHabitsForDate,
  getDesktopHabitRowMinHeight,
  getDesktopVisibleHabits,
  getHabitDayAction,
  getHabitDayMarkers,
  getHabitCheckInKey,
  getHabitRetrospectiveDates,
  moveActiveHabit,
  ONBOARDING_TRIATHLON_CONTEXT_ID,
  orderActiveHabits,
  setHabitArchived,
} from "../../lib/habits-prototype";
import { getYearTransitionDirection } from "../../lib/calendar-year-transition";
import { getOnboardingPersonalDemoSnapshot } from "../../lib/store";
import {
  isLimitReached,
  PLAN_LIMITS,
  PRO_UPGRADE_COPY,
} from "../../lib/entitlements";
import {
  DEFAULT_HABIT_CONTEXT_ID,
  filterHabitsByContext,
  getHabitContexts,
  resolveHabitContextId,
  resolveSelectedHabitContextId,
} from "../../lib/habit-contexts";
import type { CalendarEvent, CategoryItem, Habit } from "../../lib/types";
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

test("monta a vitrine em dois contextos coerente com o ano de exemplo", () => {
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
  const build = () =>
    buildOnboardingHabitShowcase({ year: 2026, todayIso: "2026-12-31", events, categories });
  const showcase = build();

  expect(showcase).toEqual(build());
  expect(showcase.contexts.map((context) => [context.id, context.name])).toEqual([
    [ONBOARDING_TRIATHLON_CONTEXT_ID, "Triatlo"],
  ]);
  const namesIn = (contextId: string) =>
    showcase.habits
      .filter((habit) => habit.contextId === contextId)
      .map((habit) => habit.name);
  expect(namesIn(DEFAULT_HABIT_CONTEXT_ID)).toEqual(["Ler 20 minutos", "Dormir cedo"]);
  expect(namesIn(ONBOARDING_TRIATHLON_CONTEXT_ID)).toEqual([
    "Nadar",
    "Pedalar",
    "Correr",
    "Treino de força",
  ]);
  expect(showcase.visibleHabitIds).toEqual(showcase.habits.map((habit) => habit.id));

  const byName = (name: string) => showcase.habits.find((habit) => habit.name === name)!;
  const completed = (name: string, dateIso: string) =>
    Boolean(showcase.checkIns[getHabitCheckInKey(byName(name).id, dateIso)]?.completed);
  const count = (name: string) =>
    Object.values(showcase.checkIns).filter((checkIn) => checkIn.habitId === byName(name).id)
      .length;
  const trip = ["2026-07-25", "2026-07-26", "2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30"];

  // Viajando: sem piscina, bike nem academia; só corrida leve e leitura.
  for (const dateIso of trip) {
    expect(completed("Nadar", dateIso)).toBe(false);
    expect(completed("Pedalar", dateIso)).toBe(false);
    expect(completed("Treino de força", dateIso)).toBe(false);
  }
  expect(trip.some((dateIso) => completed("Correr", dateIso))).toBe(true);
  expect(trip.some((dateIso) => completed("Ler 20 minutos", dateIso))).toBe(true);
  // Noite de fondue: não dormiu cedo.
  expect(completed("Dormir cedo", "2026-08-20")).toBe(false);

  // Um plano de treino plausível: corrida é a modalidade mais frequente.
  expect(count("Correr")).toBeGreaterThan(count("Nadar"));
  expect(count("Correr")).toBeLessThan(200);
  expect(count("Dormir cedo")).toBeGreaterThan(count("Ler 20 minutos"));

  // Por contexto, o dia nunca passa de 3 marcações: a pilha cabe no Anual.
  for (const contextId of [DEFAULT_HABIT_CONTEXT_ID, ONBOARDING_TRIATHLON_CONTEXT_ID]) {
    const inContext = showcase.habits.filter((habit) => habit.contextId === contextId);
    const maxPerDay = Math.max(
      ...eachDayOfInterval({
        start: new Date("2026-01-01T12:00:00Z"),
        end: new Date("2026-12-31T12:00:00Z"),
      }).map(
        (date) =>
          inContext.filter((habit) => completed(habit.name, date.toISOString().slice(0, 10)))
            .length
      )
    );
    expect(maxPerDay).toBeLessThanOrEqual(3);
  }
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
  // Sem teto de exibição: o Pro tem hábitos ilimitados.
  expect(getDesktopVisibleHabits(habits).map((item) => item.id)).toEqual([
    "um",
    "dois",
    "tres",
    "quatro",
    "cinco",
  ]);
});

test("mostra até 4 marcações no dia e resume o resto em +N", () => {
  expect(getHabitDayMarkers([1, 2, 3, 4])).toEqual({ visible: [1, 2, 3, 4], overflow: 0 });
  expect(getHabitDayMarkers([1, 2, 3, 4, 5, 6])).toEqual({ visible: [1, 2, 3], overflow: 3 });
  expect(getHabitDayMarkers([])).toEqual({ visible: [], overflow: 0 });
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

test("dimensiona a linha pelo total de hábitos visíveis", () => {
  expect([0, 1, 2, 3, 4, 5].map(getDesktopHabitRowMinHeight)).toEqual([
    72, 72, 72, 92, 112, 112,
  ]);
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

test("define um hábito e um contexto no Free e ilimitados no Pro", () => {
  expect(PLAN_LIMITS.free.maxHabits).toBe(1);
  expect(PLAN_LIMITS.free.maxHabitContexts).toBe(1);
  expect(PLAN_LIMITS.pro.maxHabits).toBeNull();
  expect(PLAN_LIMITS.pro.maxHabitContexts).toBeNull();
  expect(isLimitReached(1, PLAN_LIMITS.free.maxHabits)).toBe(true);
  expect(isLimitReached(500, PLAN_LIMITS.pro.maxHabits)).toBe(false);
  expect(PRO_UPGRADE_COPY.habits.description).toContain("1 hábito");
  expect(PRO_UPGRADE_COPY.habits.description).not.toMatch(/\b4\b/);
  expect(PRO_UPGRADE_COPY["habit-contexts"].description).toContain("1 contexto");
});

test("contexto padrão virtual abriga hábitos antigos e órfãos", () => {
  const habit = (id: string, contextId?: string): Habit => ({
    id,
    name: id,
    color: "#2563eb",
    icon: "circle-check",
    contextId,
    position: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const onlyDefault = getHabitContexts([]);
  expect(onlyDefault.map((context) => [context.id, context.name])).toEqual([
    [DEFAULT_HABIT_CONTEXT_ID, "Hábitos"],
  ]);
  expect(resolveHabitContextId(habit("antigo"), onlyDefault)).toBe(DEFAULT_HABIT_CONTEXT_ID);

  const contexts = getHabitContexts([
    { id: "saude", name: "Saúde", icon: "heart", position: 1, createdAt: "2026-02-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" },
    { id: "estudos", name: "Estudos", icon: "book-open", position: 0, createdAt: "2026-02-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" },
  ]);
  expect(contexts.map((context) => context.id)).toEqual(["estudos", "saude"]);
  // Sem o padrão na lista, o antigo e o de contexto excluído caem no primeiro.
  const habits = [habit("antigo"), habit("treino", "saude"), habit("orfao", "apagado")];
  expect(filterHabitsByContext(habits, "estudos", contexts).map((item) => item.id)).toEqual([
    "antigo",
    "orfao",
  ]);
  expect(filterHabitsByContext(habits, "saude", contexts).map((item) => item.id)).toEqual([
    "treino",
  ]);
  expect(resolveSelectedHabitContextId("apagado", contexts)).toBe("estudos");
  expect(resolveSelectedHabitContextId("saude", contexts)).toBe("saude");
});

test("expõe somente os destinos funcionais da navegação", () => {
  expect(PRODUCT_DESTINATIONS.map(({ id, label }) => ({ id, label }))).toEqual([
    { id: "annual", label: "Eventos" },
    { id: "habits", label: "Hábitos" },
  ]);
});

test("resolve a superfície inicial: endereço, depois a última tela, depois Eventos", () => {
  expect(resolveInitialProductDestination({ search: "" })).toBe("annual");
  expect(
    resolveInitialProductDestination({ search: "", lastDestination: "habits" })
  ).toBe("habits");
  expect(
    resolveInitialProductDestination({
      search: "?surface=annual",
      lastDestination: "habits",
    })
  ).toBe("annual");
  expect(
    resolveInitialProductDestination({
      search: "?surface=habits",
      lastDestination: "annual",
    })
  ).toBe("habits");
  expect(
    resolveInitialProductDestination({ search: "?surface=rotina" })
  ).toBe("annual");
});

test("atualiza somente o parâmetro da superfície no endereço", () => {
  expect(
    buildProductDestinationUrl(
      "https://doze52.test/?mobileUi=1&surface=annual#today",
      "habits"
    )
  ).toBe("/?mobileUi=1&surface=habits#today");
});

test("o treino da vitrine segue as provas de triatlo do ano de exemplo", () => {
  const demo = getOnboardingPersonalDemoSnapshot(2026);
  const triathlon = demo.categories.find((category) => category.name === "Triatlo");
  expect(triathlon).toBeDefined();
  const races = demo.events
    .filter((event) => event.categoryId === triathlon!.id)
    .map((event) => [event.title, event.startDate, event.endDate]);
  expect(races).toEqual([
    ["Inscrição no Ironman", "2026-01-20", "2026-01-20"],
    ["Triatlo sprint", "2026-04-12", "2026-04-12"],
    ["Polimento para o 70.3", "2026-08-10", "2026-08-22"],
    ["Ironman 70.3", "2026-08-23", "2026-08-23"],
    ["Polimento para o Ironman", "2026-11-16", "2026-11-28"],
    ["Ironman Florianópolis", "2026-11-29", "2026-11-29"],
  ]);

  const showcase = buildOnboardingHabitShowcase({
    year: 2026,
    todayIso: "2026-12-31",
    events: demo.events,
    categories: demo.categories,
  });
  const idOf = (name: string) => showcase.habits.find((habit) => habit.name === name)!.id;
  const done = (name: string, dateIso: string) =>
    Boolean(showcase.checkIns[getHabitCheckInKey(idOf(name), dateIso)]?.completed);
  const inRange = (start: string, end: string) =>
    eachDayOfInterval({
      start: new Date(`${start}T12:00:00Z`),
      end: new Date(`${end}T12:00:00Z`),
    }).map((date) => date.toISOString().slice(0, 10));

  // Dia de prova: nadar, pedalar e correr no mesmo dia.
  for (const race of ["2026-04-12", "2026-08-23", "2026-11-29"]) {
    expect(["Nadar", "Pedalar", "Correr"].every((name) => done(name, race))).toBe(true);
    expect(done("Treino de força", race)).toBe(false);
  }
  // Recuperação: nada de treino nos dois dias seguintes.
  for (const dateIso of ["2026-11-30", "2026-12-01"]) {
    expect(
      ["Nadar", "Pedalar", "Correr", "Treino de força"].some((name) => done(name, dateIso))
    ).toBe(false);
  }
  // Polimento: sem força e dormindo cedo toda noite — menos a do "Show de
  // fim de ano" (21/11), que cai bem no meio dele.
  const taper = inRange("2026-11-16", "2026-11-28");
  expect(taper.some((dateIso) => done("Treino de força", dateIso))).toBe(false);
  expect(taper.filter((dateIso) => !done("Dormir cedo", dateIso))).toEqual(["2026-11-21"]);
  // Antes da inscrição, só manutenção: sem piscina nem bike.
  const preseason = inRange("2026-01-01", "2026-01-19");
  expect(preseason.some((dateIso) => done("Nadar", dateIso) || done("Pedalar", dateIso))).toBe(
    false
  );
});
