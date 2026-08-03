import { expect, test } from "@playwright/test";
import { brasileirao2026Packs } from "../../lib/calendar-packs/brasileirao-2026";
import { holidays2026Packs } from "../../lib/calendar-packs/holidays-2026";
import {
  getCalendarPackEventNotes,
  getCalendarPackEventTitle,
  importCalendarPack,
  removeCalendarPack,
} from "../../lib/calendar-packs/import";
import type { CalendarSnapshot } from "../../lib/sync";
import type { CalendarPack } from "../../lib/calendar-packs/types";

const profileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const authorCategoryId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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
  const pack = brasileirao2026Packs[0];
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
  const pack = brasileirao2026Packs[0];
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
