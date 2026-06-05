import { formula12026Pack } from "./formula-1-2026";
import { worldCup2026Packs } from "./world-cup-2026";
import type { CalendarPack } from "./types";

export type CalendarPackGroup = {
  id: string;
  title: string;
  description: string;
  badge?: string;
  packs: readonly CalendarPack[];
};

export const calendarPackGroups = [
  {
    id: "world-cup-2026",
    title: "Copa de 2026",
    description: "Comece pelos jogos do Brasil ou adicione o restante do torneio.",
    badge: "🇧🇷",
    packs: worldCup2026Packs,
  },
  {
    id: "formula-1-2026",
    title: "Fórmula 1 2026",
    description: "Corridas da temporada em um calendário único.",
    badge: undefined,
    packs: [formula12026Pack],
  },
] as const satisfies readonly CalendarPackGroup[];

export const calendarPacks = calendarPackGroups.flatMap((group) => group.packs);
