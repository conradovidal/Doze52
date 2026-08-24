import { expect, test } from "@playwright/test";

import {
  buildHabitPrototypeWeeks,
  getDesktopHabitSlot,
  getDesktopVisibleHabits,
  getHabitDayAction,
  getHabitCheckInKey,
  orderActiveHabits,
} from "../../lib/habits-prototype";
import { PLAN_LIMITS, PRO_UPGRADE_COPY } from "../../lib/entitlements";
import type { Habit } from "../../lib/types";
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

test("centraliza um hábito e fixa até quatro hábitos nos quadrantes", () => {
  expect(getDesktopHabitSlot(1, 0)).toBe("center");
  expect([0, 1, 2, 3].map((index) => getDesktopHabitSlot(4, index))).toEqual([
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
  ]);
  expect(getDesktopHabitSlot(4, 4)).toBeNull();
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
