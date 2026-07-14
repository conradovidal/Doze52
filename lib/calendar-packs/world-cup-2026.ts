import packData from "./world-cup-2026-pack.json";
import type { CalendarPack } from "./types";

const baseWorldCup2026Pack = packData as CalendarPack;
const otherCategory = baseWorldCup2026Pack.categories.find(
  (category) => category.key === "other"
);

if (!otherCategory) {
  throw new Error("World Cup 2026 pack categories are incomplete.");
}

const copaCategory = {
  ...otherCategory,
  key: "world-cup-2026",
  name: "Copa do Mundo de 2026",
  color: "#0F766E",
  legacyNames: ["Copa de 2026", "Jogos do Brasil"],
};

const sharedPackProperties = {
  name: "Copa do Mundo de 2026",
  icon: "trophy" as const,
  eyebrow: undefined,
  description: "Escolha entre os jogos do Brasil ou o torneio completo.",
  variantGroup: {
    id: "world-cup-2026-coverage",
    label: "Cobertura",
    selectionMode: "replace" as const,
  },
  categories: [copaCategory],
  legacyCategoryIds: [
    "20265200-0000-4000-8000-000000000002",
    "20265200-0000-4000-8000-000000000004",
  ],
};

export const worldCup2026BrazilPack: CalendarPack = {
  ...baseWorldCup2026Pack,
  ...sharedPackProperties,
  id: "world-cup-2026-brazil",
  variantGroup: {
    ...sharedPackProperties.variantGroup,
    optionLabel: "Apenas jogos do Brasil",
  },
  events: baseWorldCup2026Pack.events
    .filter((event) => event.isBrazilMatch)
    .map((event) => ({ ...event, suggestedCategoryKey: copaCategory.key })),
};

export const worldCup2026AllPack: CalendarPack = {
  ...baseWorldCup2026Pack,
  ...sharedPackProperties,
  id: "world-cup-2026",
  variantGroup: {
    ...sharedPackProperties.variantGroup,
    optionLabel: "Copa do Mundo inteira",
  },
  events: baseWorldCup2026Pack.events.map((event) => ({
    ...event,
    suggestedCategoryKey: copaCategory.key,
  })),
};

export const worldCup2026Packs = [
  worldCup2026BrazilPack,
  worldCup2026AllPack,
] as const;
