import packData from "./formula-1-2026-pack.json";
import type { CalendarPack } from "./types";

export const formula12026Pack = {
  ...(packData as CalendarPack),
  eyebrow: "Temporada 2026",
  legacyCategoryIds: ["2026f100-0000-4000-8000-000000000003"],
} satisfies CalendarPack;
