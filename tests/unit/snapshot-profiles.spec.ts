import { test, expect } from "@playwright/test";
import { withoutUnusedProfiles } from "../../lib/snapshot-ownership";
import type { CalendarSnapshot } from "../../lib/sync";
import type { CalendarProfile, CategoryItem } from "../../lib/types";

const profile = (id: string, name: string, position: number): CalendarProfile => ({
  id,
  name,
  color: "#64748B",
  icon: "user",
  position,
});
const category = (id: string, profileId: string): CategoryItem => ({
  id,
  profileId,
  name: `Cat ${id}`,
  color: "#2563eb",
  visible: true,
});

test("contextos sem categoria ficam de fora, para caber no plano Free (1 contexto)", () => {
  const snapshot: CalendarSnapshot = {
    profiles: [profile("p", "Pessoal", 0), profile("w", "Profissional", 1), profile("t", "Triatlo", 2)],
    categories: [category("a", "p"), category("b", "p")],
    events: [],
  };
  expect(withoutUnusedProfiles(snapshot).profiles.map((item) => item.id)).toEqual(["p"]);
});

test("mantém todos os contextos que têm categoria (quem é Pro pode ter vários)", () => {
  const snapshot: CalendarSnapshot = {
    profiles: [profile("p", "Pessoal", 0), profile("w", "Profissional", 1)],
    categories: [category("a", "p"), category("b", "w")],
    events: [],
  };
  expect(withoutUnusedProfiles(snapshot)).toBe(snapshot);
});

test("sem categorias não esvazia os contextos: sempre sobra ao menos um", () => {
  const snapshot: CalendarSnapshot = {
    profiles: [profile("p", "Pessoal", 0), profile("w", "Profissional", 1)],
    categories: [],
    events: [],
  };
  expect(withoutUnusedProfiles(snapshot)).toBe(snapshot);
});
