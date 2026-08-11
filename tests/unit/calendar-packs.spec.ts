import { expect, test } from "@playwright/test";
import { brasileirao2026Packs } from "../../lib/calendar-packs/brasileirao-2026";
import { formula12026Pack } from "../../lib/calendar-packs/formula-1-2026";
import { holidays2026Packs } from "../../lib/calendar-packs/holidays-2026";
import { worldCup2026Packs } from "../../lib/calendar-packs/world-cup-2026";
import {
  findCalendarPackByCategoryId,
  getCalendarPackAvailability,
  getCalendarPackEventNotes,
  getCalendarPackEventTitle,
  importCalendarPack,
  importCalendarPackVariant,
  isCalendarPackGroupPresent,
  removeCalendarPack,
  removeCalendarPackByCategory,
} from "../../lib/calendar-packs/import";
import type { CalendarSnapshot } from "../../lib/sync";
import type { CalendarPack } from "../../lib/calendar-packs/types";

const profileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const authorCategoryId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const gremioPack = brasileirao2026Packs.find((pack) => pack.variantGroup?.optionLabel === "Grêmio")!;

test("oferece os 20 clubes com partidas oficiais válidas e IDs estáveis", () => {
  expect(brasileirao2026Packs).toHaveLength(20);
  const labels = brasileirao2026Packs.map((pack) => pack.variantGroup?.optionLabel ?? "");
  expect(labels).toEqual([...labels].sort((left, right) => left.localeCompare(right, "pt-BR")));
  expect(labels[0]).not.toBe("Grêmio");
  const allEvents = brasileirao2026Packs.flatMap((pack) => pack.events);
  expect(allEvents.every((event) => event.date !== "1900-01-01" && /^\d{2}:\d{2}$/.test(event.time))).toBe(true);
  expect(new Set(allEvents.map((event) => event.id)).size).toBe(387);
  expect(new Set(allEvents.map((event) => event.competition))).toEqual(new Set([
    "Campeonato Brasileiro Serie A", "Copa do Brasil", "CONMEBOL Libertadores", "CONMEBOL Sul-Americana",
  ]));
  for (const pack of brasileirao2026Packs) {
    expect(new Set(pack.events.map((event) => event.id)).size).toBe(pack.events.length);
  }
  const catalogTeams = new Set(labels);
  for (const eventId of new Set(allEvents.map((event) => event.id))) {
    const occurrences = allEvents.filter((event) => event.id === eventId);
    const expected = catalogTeams.has(occurrences[0].homeTeam) && catalogTeams.has(occurrences[0].awayTeam) ? 2 : 1;
    expect(occurrences).toHaveLength(expected);
  }
  expect(gremioPack.events.find((event) => event.id.endsWith("000000831889"))).toBeTruthy();
  expect(gremioPack.events.some((event) => event.competition === "CONMEBOL Sul-Americana")).toBe(true);
  expect(brasileirao2026Packs.find((pack) => pack.variantGroup?.optionLabel === "Palmeiras")?.events.some((event) => event.competition === "CONMEBOL Libertadores")).toBe(true);
});

const corruptedSnapshot = (
  pack: CalendarPack,
  count: number
): CalendarSnapshot => ({
  profiles: [
    {
      id: profileId,
      name: "Pessoal",
      color: "#64748B",
      icon: "user",
      position: 0,
    },
  ],
  categories: [
    {
      id: authorCategoryId,
      profileId,
      name: "Eventos",
      color: "#94A3B8",
      visible: true,
    },
  ],
  events: [
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      title: "Evento autoral",
      categoryId: authorCategoryId,
      color: "#94A3B8",
      startDate: "2026-01-15",
      endDate: "2026-01-15",
      createdAt: "2026-01-01T00:00:00.000Z",
      dayOrder: 0,
    },
    ...pack.events.slice(0, count).map((event, index) => ({
      id: `dddddddd-dddd-4ddd-8ddd-${String(index).padStart(12, "0")}`,
      title: getCalendarPackEventTitle(event, pack),
      categoryId: authorCategoryId,
      color: "#94A3B8",
      startDate: event.date,
      endDate: event.date,
      notes: getCalendarPackEventNotes(event, pack),
      recurrenceType: event.recurrenceType,
      recurrenceUntil: event.recurrenceUntil,
      createdAt: "2026-01-01T00:00:00.000Z",
      dayOrder: index + 1,
    })),
  ],
});

test("recupera Grêmio misturado em Eventos sem mover conteúdo autoral", () => {
  const pack = gremioPack;
  const before = corruptedSnapshot(pack, 7);
  const first = importCalendarPack(before, pack, "all", profileId, [pack]);
  const managedCategory = first.snapshot.categories.find(
    (category) => category.calendarPackGroupId === pack.variantGroup?.id
  );

  expect(managedCategory).toBeTruthy();
  expect(
    first.snapshot.events.find((event) => event.title === "Evento autoral")
      ?.categoryId
  ).toBe(authorCategoryId);
  expect(
    first.snapshot.events.filter(
      (event) => event.calendarPackGroupId === pack.variantGroup?.id
    )
  ).toHaveLength(pack.events.length);

  const second = importCalendarPack(
    first.snapshot,
    pack,
    "all",
    profileId,
    [pack]
  );
  expect(second.snapshot.events).toHaveLength(first.snapshot.events.length);

  const removed = removeCalendarPack(second.snapshot, pack, [pack]);
  expect(
    removed.snapshot.events.find((event) => event.title === "Evento autoral")
  ).toBeTruthy();
  expect(
    removed.snapshot.events.some(
      (event) => event.calendarPackGroupId === pack.variantGroup?.id
    )
  ).toBe(false);
});

test("preserva jogos históricos e reconcilia placares antigos do Grêmio", () => {
  const pack = gremioPack;
  const currentFixture = pack.events.find(
    (event) => event.date === "2026-02-04"
  )!;
  const before = corruptedSnapshot(pack, 0);
  before.events.push(
    {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      title: "Grêmio 5 x 2 Botafogo",
      categoryId: authorCategoryId,
      color: "#94A3B8",
      startDate: currentFixture.date,
      endDate: currentFixture.date,
      createdAt: "2026-02-04T00:00:00.000Z",
      dayOrder: 1,
    },
    {
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      title: "Inter 2 x 3 Grêmio",
      categoryId: authorCategoryId,
      color: "#94A3B8",
      startDate: "2025-09-21",
      endDate: "2025-09-21",
      createdAt: "2025-09-21T00:00:00.000Z",
      dayOrder: 0,
    }
  );

  const first = importCalendarPack(before, pack, "all", profileId, [pack]);
  const managedEvents = first.snapshot.events.filter(
    (event) => event.calendarPackGroupId === pack.variantGroup?.id
  );
  expect(managedEvents).toHaveLength(pack.events.length + 1);
  expect(
    managedEvents.filter((event) => event.startDate === currentFixture.date)
  ).toHaveLength(1);
  expect(
    managedEvents.find((event) => event.startDate === "2025-09-21")
      ?.calendarPackEventKey
  ).toMatch(/^legacy:/);

  const second = importCalendarPack(
    first.snapshot,
    pack,
    "all",
    profileId,
    [pack]
  );
  expect(second.snapshot.events).toHaveLength(first.snapshot.events.length);
  expect(
    second.snapshot.events.find((event) => event.startDate === "2025-09-21")
  ).toBeTruthy();
});

test("recria Feriados ausente usando somente impressões semânticas estritas", () => {
  const pack = holidays2026Packs.find((candidate) => candidate.regionCode === "RS")!;
  const before = corruptedSnapshot(pack, 4);
  const result = importCalendarPack(before, pack, "all", profileId, [pack]);
  const managedCategory = result.snapshot.categories.find(
    (category) => category.calendarPackGroupId === "holidays-by-state"
  );

  expect(managedCategory?.name).toBe("Feriados");
  expect(
    result.snapshot.events.find((event) => event.title === "Evento autoral")
      ?.categoryId
  ).toBe(authorCategoryId);
  expect(
    result.snapshot.events.filter(
      (event) => event.calendarPackGroupId === "holidays-by-state"
    )
  ).toHaveLength(pack.events.length);
});

test("adota uma categoria dedicada de feriados legados sem depender só do nome", () => {
  const pack = holidays2026Packs.find((candidate) => candidate.regionCode === "RS")!;
  const before = corruptedSnapshot(pack, 0);
  before.categories[0] = {
    ...before.categories[0],
    name: "Feriados",
    color: "#B79AEF",
  };
  before.events = [
    {
      id: "99999999-9999-4999-8999-999999999999",
      title: "Dia do Cliente",
      categoryId: authorCategoryId,
      color: "#B79AEF",
      startDate: "2026-09-15",
      endDate: "2026-09-15",
      createdAt: "2026-01-01T00:00:00.000Z",
      dayOrder: 0,
    },
    {
      id: "88888888-8888-4888-8888-888888888888",
      title: "Dia dos Namorados",
      categoryId: authorCategoryId,
      color: "#B79AEF",
      startDate: "2026-06-12",
      endDate: "2026-06-12",
      createdAt: "2026-01-01T00:00:00.000Z",
      dayOrder: 0,
    },
  ];

  const result = importCalendarPack(before, pack, "all", profileId, [pack]);
  const managedCategories = result.snapshot.categories.filter(
    (category) => category.calendarPackGroupId === "holidays-by-state"
  );
  expect(managedCategories).toHaveLength(1);
  expect(managedCategories[0].id).toBe(authorCategoryId);
  expect(
    result.snapshot.events.filter(
      (event) => event.calendarPackGroupId === "holidays-by-state"
    )
  ).toHaveLength(pack.events.length + 2);
});

test("remove por completo uma categoria dedicada de feriados legados", () => {
  const pack = holidays2026Packs.find((candidate) => candidate.regionCode === "RS")!;
  const holidayTitles = [
    "Nossa Senhora dos Navegantes",
    "Dia da Mulher",
    "Dia do Consumidor",
    "Dia das Mães",
    "Dia dos Namorados",
    "Dia dos Pais",
    "Dia do Cliente",
    "Natal",
  ];
  const before = corruptedSnapshot(pack, 0);
  before.categories[0] = {
    ...before.categories[0],
    name: "Feriados",
  };
  before.events = holidayTitles.map((title, index) => ({
    id: `77777777-7777-4777-8777-${String(index).padStart(12, "0")}`,
    title,
    categoryId: authorCategoryId,
    color: "#94A3B8",
    startDate: `2026-${String(index + 1).padStart(2, "0")}-01`,
    endDate: `2026-${String(index + 1).padStart(2, "0")}-01`,
    createdAt: "2026-01-01T00:00:00.000Z",
    dayOrder: 0,
  }));

  expect(getCalendarPackAvailability(before, pack).hasAnyCategory).toBe(true);
  expect(
    findCalendarPackByCategoryId(before, holidays2026Packs, authorCategoryId)
  ).toBeTruthy();

  const removed = removeCalendarPackByCategory(
    before,
    holidays2026Packs,
    authorCategoryId
  );
  expect(removed.removedCategoryCount).toBe(1);
  expect(removed.removedEventCount).toBe(holidayTitles.length);
  expect(removed.snapshot.events).toHaveLength(0);
  expect(removed.snapshot.categories).toHaveLength(1);
  expect(removed.snapshot.categories[0].name).toBe("Eventos pessoais");
  expect(isCalendarPackGroupPresent(removed.snapshot, holidays2026Packs)).toBe(false);
});

test("remove o jogo legado conhecido sem confundir placares pessoais", () => {
  const pack = gremioPack;
  const before = corruptedSnapshot(pack, 0);
  before.events.push(
    {
      id: "66666666-6666-4666-8666-666666666666",
      title: "Inter 2 x 3 Grêmio",
      categoryId: authorCategoryId,
      color: "#94A3B8",
      startDate: "2025-09-21",
      endDate: "2025-09-21",
      createdAt: "2026-01-01T00:00:00.000Z",
      dayOrder: 1,
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      title: "Grêmio 2 x 0 Amigos",
      categoryId: authorCategoryId,
      color: "#94A3B8",
      startDate: "2026-10-10",
      endDate: "2026-10-10",
      createdAt: "2026-01-01T00:00:00.000Z",
      dayOrder: 2,
    }
  );

  expect(getCalendarPackAvailability(before, pack).hasImportedEvents).toBe(true);
  const removed = removeCalendarPack(before, pack, brasileirao2026Packs);
  expect(removed.snapshot.events.map((event) => event.title)).toEqual([
    "Evento autoral",
    "Grêmio 2 x 0 Amigos",
  ]);
  expect(isCalendarPackGroupPresent(removed.snapshot, brasileirao2026Packs)).toBe(false);
});

test("não trata feriado pessoal misturado como calendário instalado", () => {
  const pack = holidays2026Packs.find((candidate) => candidate.regionCode === "SP")!;
  const before = corruptedSnapshot(pack, 0);
  before.events.push({
    id: "44444444-4444-4444-8444-444444444444",
    title: "Natal",
    categoryId: authorCategoryId,
    color: "#94A3B8",
    startDate: "2026-12-25",
    endDate: "2026-12-25",
    createdAt: "2026-01-01T00:00:00.000Z",
    dayOrder: 1,
  });

  const availability = getCalendarPackAvailability(before, pack);
  expect(availability.hasAnyCategory).toBe(false);
  expect(availability.hasImportedEvents).toBe(false);
});

test("não trata uma categoria pessoal com vários nomes de feriado como calendário", () => {
  const pack = holidays2026Packs.find(
    (candidate) => candidate.regionCode === "SP"
  )!;
  const before = corruptedSnapshot(pack, 0);
  before.events.push(
    {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Natal",
      categoryId: authorCategoryId,
      color: "#94A3B8",
      startDate: "2026-12-25",
      endDate: "2026-12-25",
      createdAt: "2026-01-01T00:00:00.000Z",
      dayOrder: 1,
    },
    {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Dia das Mães",
      categoryId: authorCategoryId,
      color: "#94A3B8",
      startDate: "2026-05-10",
      endDate: "2026-05-10",
      createdAt: "2026-01-01T00:00:00.000Z",
      dayOrder: 2,
    }
  );

  const availability = getCalendarPackAvailability(before, pack);
  expect(availability.hasAnyCategory).toBe(false);
  expect(availability.hasImportedEvents).toBe(false);
});

test("não realoca conteúdo que esteja dentro de uma categoria gerenciada", () => {
  const pack = gremioPack;
  const imported = importCalendarPack(
    corruptedSnapshot(pack, 0),
    pack,
    "all",
    profileId,
    brasileirao2026Packs
  );
  const managedCategory = imported.snapshot.categories.find(
    (category) => category.calendarPackGroupId === pack.variantGroup?.id
  )!;
  imported.snapshot.events.push({
    id: "33333333-3333-4333-8333-333333333334",
    title: "Conteúdo indevido dentro do calendário",
    categoryId: managedCategory.id,
    color: managedCategory.color,
    startDate: "2026-12-31",
    endDate: "2026-12-31",
    createdAt: "2026-01-01T00:00:00.000Z",
    dayOrder: 0,
  });

  const removed = removeCalendarPack(
    imported.snapshot,
    pack,
    brasileirao2026Packs
  );
  expect(
    removed.snapshot.events.some(
      (event) => event.title === "Conteúdo indevido dentro do calendário"
    )
  ).toBe(false);
  expect(
    removed.snapshot.events.find((event) => event.title === "Evento autoral")
  ).toBeTruthy();
});

test("remove Feriados por completo depois de trocar a UF", () => {
  const saoPaulo = holidays2026Packs.find(
    (candidate) => candidate.regionCode === "SP"
  )!;
  const rioGrandeDoSul = holidays2026Packs.find(
    (candidate) => candidate.regionCode === "RS"
  )!;
  const first = importCalendarPackVariant(
    corruptedSnapshot(saoPaulo, 0),
    saoPaulo,
    holidays2026Packs,
    "all",
    profileId
  );
  const switched = importCalendarPackVariant(
    first.snapshot,
    rioGrandeDoSul,
    holidays2026Packs,
    "all",
    profileId
  );

  expect(isCalendarPackGroupPresent(switched.snapshot, holidays2026Packs)).toBe(
    true
  );
  const removed = removeCalendarPack(
    switched.snapshot,
    rioGrandeDoSul,
    holidays2026Packs
  );
  expect(removed.removedCategoryCount).toBeGreaterThan(0);
  expect(removed.removedEventCount).toBeGreaterThan(0);
  expect(isCalendarPackGroupPresent(removed.snapshot, holidays2026Packs)).toBe(
    false
  );
  expect(
    removed.snapshot.events.find((event) => event.title === "Evento autoral")
  ).toBeTruthy();
});

test("mantém a remoção da Copa e da F1 como blocos completos", () => {
  for (const { pack, variants } of [
    { pack: worldCup2026Packs[0], variants: worldCup2026Packs },
    { pack: formula12026Pack, variants: [formula12026Pack] },
  ] as const) {
    const imported = importCalendarPack(
      corruptedSnapshot(pack, 0),
      pack,
      "all",
      profileId,
      variants
    );
    expect(isCalendarPackGroupPresent(imported.snapshot, variants)).toBe(true);

    const removed = removeCalendarPack(imported.snapshot, pack, variants);
    expect(removed.removedCategoryCount).toBeGreaterThan(0);
    expect(removed.removedEventCount).toBeGreaterThan(0);
    expect(isCalendarPackGroupPresent(removed.snapshot, variants)).toBe(false);
    expect(
      removed.snapshot.events.find((event) => event.title === "Evento autoral")
    ).toBeTruthy();
  }
});
