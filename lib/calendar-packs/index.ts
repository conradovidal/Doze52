import { brasileirao2026Packs } from "./brasileirao-2026";
import { formula12026Pack } from "./formula-1-2026";
import { holidays2026Packs } from "./holidays-2026";
import { worldCup2026Packs } from "./world-cup-2026";

export const calendarPacks = [
  ...holidays2026Packs,
  ...brasileirao2026Packs,
  ...worldCup2026Packs,
  formula12026Pack,
] as const;
