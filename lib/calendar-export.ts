import type { CalendarSnapshot } from "@/lib/sync";
import type { CalendarEvent, CategoryItem } from "@/lib/types";

export const isAuthorCategory = (category?: CategoryItem | null) =>
  Boolean(category && !category.calendarPackGroupId);

export const isAuthorEvent = (event?: CalendarEvent | null) =>
  Boolean(event && !event.calendarPackGroupId);

export const filterAuthorCalendarSnapshot = (
  snapshot: CalendarSnapshot
): CalendarSnapshot => {
  const categories = snapshot.categories.filter(isAuthorCategory);
  const categoryIds = new Set(categories.map((category) => category.id));
  const events = snapshot.events.filter(
    (event) => isAuthorEvent(event) && categoryIds.has(event.categoryId)
  );

  return { profiles: snapshot.profiles, categories, events };
};
