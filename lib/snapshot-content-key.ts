import type { CalendarEvent, CalendarProfile, CategoryItem } from "./types";

type SnapshotLike = {
  profiles: CalendarProfile[];
  categories: CategoryItem[];
  events: CalendarEvent[];
};

const trimmed = (value: string | undefined | null) => value?.trim() ?? "";

// Projects a snapshot onto exactly what `replace_calendar_snapshot` persists, so
// a snapshot read back from the database compares equal to the one that was
// saved. Timestamps, derived colors and owner ids are deliberately left out:
// they change on every save and must not read as "another device edited this".
// Events are order-insensitive (their order is data: startDate/dayOrder);
// profiles and categories keep array order, which is persisted as `position`.
export const snapshotContentKey = (snapshot: SnapshotLike): string =>
  JSON.stringify({
    profiles: snapshot.profiles.map((profile) => [
      profile.id,
      trimmed(profile.name),
      profile.icon ?? null,
    ]),
    categories: snapshot.categories.map((category) => [
      category.id,
      category.profileId,
      trimmed(category.name),
      category.color,
      category.visible,
      category.calendarPackGroupId ?? null,
      category.calendarPackVariantId ?? null,
      category.calendarPackCategoryKey ?? null,
      category.calendarPackVersion ?? null,
    ]),
    events: snapshot.events
      .map((event) => [
        event.id,
        trimmed(event.title),
        event.categoryId,
        event.startDate,
        event.endDate || event.startDate,
        trimmed(event.notes) || null,
        event.recurrenceType ?? null,
        event.recurrenceType ? (event.recurrenceUntil ?? null) : null,
        Math.trunc(Number(event.dayOrder) || 0),
        event.calendarPackGroupId ?? null,
        event.calendarPackEventKey ?? null,
      ])
      .sort((a, b) => (a[0]! < b[0]! ? -1 : a[0]! > b[0]! ? 1 : 0)),
  });

// A snapshot saved locally after a failed sync may only overwrite the server
// while the server still holds what this device last saw. Anything else means
// another device changed the calendar in the meantime, and replaying the stale
// snapshot would resurrect deleted events. Payloads written before `baseKey`
// existed cannot be verified and are treated as stale.
export const isPendingSnapshotCurrent = (
  baseKey: string | undefined,
  remote: SnapshotLike
): boolean => baseKey !== undefined && baseKey === snapshotContentKey(remote);
