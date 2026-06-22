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

const copaCategory = {
  ...otherCategory,
  name: "Copa de 2026",
};

export const worldCup2026BrazilPack: CalendarPack = {
  ...baseWorldCup2026Pack,
  id: "world-cup-2026-brazil",
  name: "Jogos do Brasil",
  eyebrow: "Brasil em destaque",
  description: "Partidas da seleção brasileira na fase de grupos.",
  categories: [brazilCategory],
  events: baseWorldCup2026Pack.events.filter((event) => event.isBrazilMatch),
};

export const worldCup2026AllPack: CalendarPack = {
  ...baseWorldCup2026Pack,
  id: "world-cup-2026",
  name: "Copa de 2026",
  eyebrow: "Todos os jogos",
  description: "Todos os jogos do torneio, com o Brasil em categoria própria.",
  categories: [brazilCategory, copaCategory],
  legacyCategoryIds: ["20265200-0000-4000-8000-000000000004"],
};

export const worldCup2026Packs = [
  worldCup2026BrazilPack,
  worldCup2026AllPack,
] as const;
