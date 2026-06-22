import { formula12026Pack } from "./formula-1-2026";
import { worldCup2026Packs } from "./world-cup-2026";

export const calendarPacks = [
  ...worldCup2026Packs,
  formula12026Pack,
] as const;
