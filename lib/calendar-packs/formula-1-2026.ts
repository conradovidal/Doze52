import packData from "./formula-1-2026-pack.json";
import type { CalendarPack } from "./types";

export const formula12026Pack = {
  ...(packData as CalendarPack),
  name: "Corridas F1",
  description: "Todas as etapas da temporada 2026 em uma assinatura.",
  eyebrow: "Temporada 2026",
  categories: (packData as CalendarPack).categories.map((category) => ({
    ...category,
    name: "Corridas F1",
  })),
  legacyCategoryIds: ["2026f100-0000-4000-8000-000000000003"],
} satisfies CalendarPack;
