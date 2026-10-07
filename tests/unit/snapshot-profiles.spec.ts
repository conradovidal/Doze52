import { test, expect } from "@playwright/test";
import { withoutUnusedProfiles } from "../../lib/snapshot-ownership";
import { ONBOARDING_PROFILE_IDS } from "../../lib/store";
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

const PERSONAL = ONBOARDING_PROFILE_IDS.personal;
const WORK = ONBOARDING_PROFILE_IDS.professional;
const TRIATHLON = ONBOARDING_PROFILE_IDS.triathlon;
const examples = () => [
  profile(WORK, "Profissional", 0),
  profile(PERSONAL, "Pessoal", 1),
  profile(TRIATHLON, "Triatlo", 2),
];

test("mobile: só o Pessoal sobra, para caber no plano Free (1 contexto)", () => {
  const snapshot: CalendarSnapshot = {
    profiles: examples(),
    categories: [category("a", PERSONAL), category("b", PERSONAL)],
    events: [],
  };
  expect(withoutUnusedProfiles(snapshot).profiles.map((item) => item.id)).toEqual([PERSONAL]);
});

test("desktop: quem definiu o Profissional (com categorias) o mantém", () => {
  const snapshot: CalendarSnapshot = {
    profiles: examples(),
    categories: [category("a", WORK)],
    events: [],
  };
  expect(withoutUnusedProfiles(snapshot).profiles.map((item) => item.id)).toEqual([WORK]);
});

test("mantém todos os contextos do exemplo que têm categoria (Pro com vários)", () => {
  const snapshot: CalendarSnapshot = {
    profiles: examples(),
    categories: [category("a", PERSONAL), category("b", WORK)],
    events: [],
  };
  expect(withoutUnusedProfiles(snapshot).profiles.map((item) => item.id)).toEqual([WORK, PERSONAL]);
});

test("um contexto criado pela pessoa fica mesmo vazio; só os do exemplo saem", () => {
  const snapshot: CalendarSnapshot = {
    profiles: [...examples(), profile("custom-1", "Faculdade", 3)],
    categories: [category("a", PERSONAL)],
    events: [],
  };
  expect(withoutUnusedProfiles(snapshot).profiles.map((item) => item.id)).toEqual([PERSONAL, "custom-1"]);
});

test("sem nenhuma categoria sobra um só contexto, o Pessoal", () => {
  const snapshot: CalendarSnapshot = { profiles: examples(), categories: [], events: [] };
  expect(withoutUnusedProfiles(snapshot).profiles.map((item) => item.id)).toEqual([PERSONAL]);
});
