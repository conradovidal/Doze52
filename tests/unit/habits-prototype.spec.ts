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
import { holidays2026Packs } from "../../lib/calendar-packs/holidays-2026";
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

test("a história do triatlo tem as datas do contrato nos Eventos", () => {
  const demo = getOnboardingPersonalDemoSnapshot(2026);
  const categoryName = (id: string) => demo.categories.find((c) => c.id === id)?.name;
  const triathlonProfile = demo.profiles.find((profile) => profile.name === "Triatlo");
  expect(triathlonProfile).toBeDefined();
  const triathlonCategories = demo.categories.filter(
    (category) => category.profileId === triathlonProfile!.id
  );
  expect(triathlonCategories.map((category) => category.name)).toEqual([
    "Provas",
    "Treino",
    "Saúde",
    "Viagens",
  ]);
  const triathlonCategoryIds = new Set(triathlonCategories.map((category) => category.id));
  const rows = demo.events
    .filter((event) => triathlonCategoryIds.has(event.categoryId))
    .filter((event) => event.startDate.startsWith("2026"))
    .toSorted((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate))
    .map((event) => [event.title, categoryName(event.categoryId), event.startDate, event.endDate]);
  expect(rows).toEqual([
    ["Inscrição no Ironman", "Provas", "2026-01-20", "2026-01-20"],
    ["Avaliação física", "Saúde", "2026-01-27", "2026-01-27"],
    ["Triatlo sprint", "Provas", "2026-04-12", "2026-04-12"],
    ["Recuperação", "Treino", "2026-04-13", "2026-04-26"],
    ["Consulta com ortopedista", "Saúde", "2026-05-19", "2026-05-19"],
    ["Fisioterapia", "Saúde", "2026-05-25", "2026-06-14"],
    ["Alta da fisioterapia", "Saúde", "2026-06-14", "2026-06-14"],
    ["Volta gradual à corrida", "Treino", "2026-06-15", "2026-06-28"],
    ["Construção", "Treino", "2026-06-29", "2026-10-18"],
    ["Polimento para o Ironman", "Treino", "2026-10-19", "2026-11-07"],
    ["Viagem da prova", "Viagens", "2026-11-06", "2026-11-09"],
    ["Ironman", "Provas", "2026-11-08", "2026-11-08"],
    ["Recuperação", "Treino", "2026-11-09", "2026-11-29"],
  ]);
  // O ano de exemplo nunca passa de 2 eventos no mesmo dia, por contexto.
  const profileOf = new Map(demo.categories.map((c) => [c.id, c.profileId]));
  const perDay = new Map<string, number>();
  demo.events.forEach((event) => {
    for (let t = Date.parse(`${event.startDate}T12:00:00Z`); t <= Date.parse(`${event.endDate}T12:00:00Z`); t += 86400000) {
      const key = `${profileOf.get(event.categoryId)}:${new Date(t).toISOString().slice(0, 10)}`;
      if (key.includes(":2026")) perDay.set(key, (perDay.get(key) ?? 0) + 1);
    }
  });
  expect(Math.max(...perDay.values())).toBeLessThanOrEqual(2);
  const titles = demo.events.map((event) => event.title);
  expect(titles.some((title) => title.includes("70.3") || title.includes("Florianópolis") && title.includes("Ironman"))).toBe(false);

  const dayOf = (title: string) =>
    demo.events.find((event) => event.title === title && event.startDate.startsWith("2026"))!;
  expect(dayOf("Casamento da Ana e do Lucas").startDate).toBe("2026-09-12");
  expect(dayOf("Férias em Maceió")).toMatchObject({ startDate: "2026-07-25", endDate: "2026-07-30" });
  expect(dayOf("Lançamento da campanha para PMEs")).toMatchObject({
    startDate: "2026-08-17",
    endDate: "2026-08-21",
  });
  expect(dayOf("Revisão do ano").startDate).toBe("2026-12-20");
  expect(titles).not.toContain("Férias em família — Maceió");

  // Carnaval: nenhum evento Pessoal/Família em 14–18/02. O feriado vem do pacote
  // de Feriados, que não faz parte do ano de exemplo.
  const personalCategoryIds = new Set(
    demo.categories
      .filter(
        (category) =>
          category.profileId === "44444444-4444-4444-8444-444444444442"
      )
      .map((category) => category.id)
  );
  expect(
    demo.events
      .filter(
        (event) =>
          event.startDate <= "2026-02-18" &&
          event.endDate >= "2026-02-14" &&
          personalCategoryIds.has(event.categoryId)
      )
      .map((event) => event.title)
  ).toEqual([]);
  expect(
    holidays2026Packs.some((pack) =>
      pack.events.some(
        (event) => event.title === "Terça-feira de Carnaval" && event.date === "2026-02-17"
      )
    )
  ).toBe(true);

  // 2025 sem nada de triatlo; 2027 gera o ano com as mesmas regras.
  const in2025 = demo.events.filter((event) => event.startDate.startsWith("2025"));
  expect(in2025.filter((event) => triathlonCategoryIds.has(event.categoryId))).toEqual([]);
  // 2027 é um ano de projeção enxuto: gera sem erro e sem provas.
  expect(() => getOnboardingPersonalDemoSnapshot(2027)).not.toThrow();
});

test("o treino da vitrine segue as fases do ano de exemplo", () => {
  const demo = getOnboardingPersonalDemoSnapshot(2026);
  const build = (todayIso: string) =>
    buildOnboardingHabitShowcase({
      year: 2026,
      todayIso,
      events: demo.events,
      categories: demo.categories,
    });
  const showcase = build("2026-12-31");
  const idOf = (name: string) => showcase.habits.find((habit) => habit.name === name)!.id;
  const done = (name: string, dateIso: string) =>
    Boolean(showcase.checkIns[getHabitCheckInKey(idOf(name), dateIso)]?.completed);
  const inRange = (start: string, end: string) =>
    eachDayOfInterval({
      start: new Date(`${start}T12:00:00Z`),
      end: new Date(`${end}T12:00:00Z`),
    }).map((date) => date.toISOString().slice(0, 10));
  const shiftDay = (dateIso: string, days: number) =>
    new Date(new Date(`${dateIso}T12:00:00Z`).getTime() + days * 86400000)
      .toISOString()
      .slice(0, 10);
  const triathlonHabits = ["Nadar", "Pedalar", "Correr", "Treino de força"];
  const marks = (names: string[], dates: string[]) =>
    dates.flatMap((dateIso) => names.filter((name) => done(name, dateIso)).map((name) => [dateIso, name]));
  const perWeek = (name: string, start: string, end: string) => {
    const counts = new Map<string, number>();
    inRange(start, end).forEach((dateIso) => {
      if (!done(name, dateIso)) return;
      const week = shiftDay(dateIso, -((new Date(`${dateIso}T12:00:00Z`).getUTCDay() + 6) % 7));
      counts.set(week, (counts.get(week) ?? 0) + 1);
    });
    return counts;
  };

  // Bloco de Carnaval (14 a 18/02).
  const allNames = ["Ler 20 minutos", "Dormir cedo", ...triathlonHabits];
  expect(marks(allNames, inRange("2026-02-14", "2026-02-18"))).toEqual([
    ["2026-02-14", "Ler 20 minutos"],
    ["2026-02-14", "Dormir cedo"],
    ["2026-02-14", "Pedalar"],
    ["2026-02-15", "Ler 20 minutos"],
    ["2026-02-15", "Dormir cedo"],
    ["2026-02-15", "Correr"],
    ["2026-02-16", "Ler 20 minutos"],
    ["2026-02-16", "Dormir cedo"],
    ["2026-02-16", "Nadar"],
    ["2026-02-16", "Treino de força"],
    ["2026-02-17", "Ler 20 minutos"],
    ["2026-02-17", "Dormir cedo"],
    ["2026-02-17", "Pedalar"],
    ["2026-02-17", "Correr"],
    ["2026-02-18", "Dormir cedo"],
    ["2026-02-18", "Nadar"],
  ]);
  const carnivalCount = marks(triathlonHabits, inRange("2026-02-14", "2026-02-18")).length;
  expect(carnivalCount).toBeGreaterThan(marks(triathlonHabits, inRange("2026-02-07", "2026-02-11")).length);
  expect(carnivalCount).toBeGreaterThan(marks(triathlonHabits, inRange("2026-02-21", "2026-02-25")).length);

  // Força some na base do sprint e volta na base do Ironman.
  const baseStrength = marks(["Treino de força"], inRange("2026-01-26", "2026-04-05"));
  expect(baseStrength.length).toBeLessThanOrEqual(5);
  for (const count of perWeek("Treino de força", "2026-04-27", "2026-05-24").values()) {
    expect(count).toBeGreaterThanOrEqual(2);
  }
  // Fisioterapia: nenhuma corrida (nem em Gramado); volta gradual: até 2/semana.
  expect(marks(["Correr"], inRange("2026-05-25", "2026-06-14"))).toEqual([]);
  expect(marks(["Treino de força"], inRange("2026-05-25", "2026-06-14")).length).toBeGreaterThan(5);
  for (const count of perWeek("Correr", "2026-06-15", "2026-06-28").values()) {
    expect(count).toBeLessThanOrEqual(2);
  }
  // Dia de prova: as três modalidades, mesmo dentro de uma viagem.
  for (const race of ["2026-04-12", "2026-11-08"]) {
    expect(["Nadar", "Pedalar", "Correr"].every((name) => done(name, race))).toBe(true);
  }
  expect(done("Dormir cedo", "2026-11-07")).toBe(true);
  // Recuperação final: uma semana sem nada do triatlo.
  expect(marks(triathlonHabits, inRange("2026-11-09", "2026-11-15"))).toEqual([]);
  expect(done("Nadar", "2026-11-17")).toBe(true);
  expect(done("Correr", "2026-11-19")).toBe(true);
  // Polimento do Ironman: sem força, dormindo cedo (menos noites de evento).
  const taper = inRange("2026-10-19", "2026-11-07");
  expect(marks(["Treino de força"], taper)).toEqual([]);
  // Semana do lançamento: só duas corridas e duas noites cedo.
  expect(marks(triathlonHabits, inRange("2026-08-17", "2026-08-21"))).toEqual([
    ["2026-08-18", "Correr"],
    ["2026-08-20", "Correr"],
  ]);
  expect(marks(["Dormir cedo"], inRange("2026-08-17", "2026-08-21")).map(([d]) => d)).toEqual([
    "2026-08-17",
    "2026-08-19",
  ]);
  // Casamento: sábado em branco; domingo só pedala.
  expect(marks(allNames, ["2026-09-12"])).toEqual([]);
  expect(done("Pedalar", "2026-09-13")).toBe(true);
  expect(done("Correr", "2026-09-13")).toBe(false);
  // Nunca duas sessões perdidas em sequência nas bases e na construção.
  // A sequência mais longa de Dormir cedo começa na construção.
  let best = { length: 0, start: "" };
  let run = { length: 0, start: "" };
  for (const dateIso of inRange("2026-01-01", "2026-12-31")) {
    if (done("Dormir cedo", dateIso)) {
      run = run.length ? { ...run, length: run.length + 1 } : { length: 1, start: dateIso };
      if (run.length > best.length) best = { ...run };
    } else run = { length: 0, start: "" };
  }
  expect(best.start >= "2026-06-29" && best.start <= "2026-10-18").toBe(true);

  // Com hoje em 29/09, nenhuma marcação passa de hoje.
  expect(
    Object.values(build("2026-09-29").checkIns).every((checkIn) => checkIn.date <= "2026-09-29")
  ).toBe(true);
});
