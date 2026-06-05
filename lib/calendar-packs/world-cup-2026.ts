import packData from "./world-cup-2026-pack.json";
import type { CalendarPack } from "./types";

const baseWorldCup2026Pack = packData as CalendarPack;
const brazilCategory = baseWorldCup2026Pack.categories.find(
  (category) => category.key === "brazil"
);
const otherCategory = baseWorldCup2026Pack.categories.find(
  (category) => category.key === "other"
);

if (!brazilCategory || !otherCategory) {
  throw new Error("World Cup 2026 pack categories are incomplete.");
}

export const worldCup2026BrazilPack: CalendarPack = {
  ...baseWorldCup2026Pack,
  id: "world-cup-2026-brazil",
  name: "Jogos do Brasil",
  eyebrow: "Copa de 2026",
  description: "Partidas da seleção brasileira na fase de grupos.",
  categories: [brazilCategory],
  events: baseWorldCup2026Pack.events.filter((event) => event.isBrazilMatch),
};

export const worldCup2026RestOfCupPack: CalendarPack = {
  ...baseWorldCup2026Pack,
  id: "world-cup-2026-rest-of-cup",
  name: "Restante da Copa",
  eyebrow: "Copa de 2026",
  description: "Todos os outros jogos, incluindo grupos e mata-mata.",
  categories: [otherCategory],
  legacyCategoryIds: ["20265200-0000-4000-8000-000000000004"],
  events: baseWorldCup2026Pack.events.filter((event) => !event.isBrazilMatch),
};

export const worldCup2026Packs = [
  worldCup2026BrazilPack,
  worldCup2026RestOfCupPack,
] as const;
