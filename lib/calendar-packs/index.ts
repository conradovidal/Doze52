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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

for (const pack of calendarPacks) {
  const persistedIds = [
    pack.profile.id,
    ...pack.categories.map((category) => category.id),
    ...pack.events.map((event) => event.id),
  ];
  const invalidId = persistedIds.find((id) => !UUID_PATTERN.test(id));
  if (invalidId) {
    throw new Error(`Calendar pack ${pack.id} has an invalid persisted UUID: ${invalidId}`);
  }
}
