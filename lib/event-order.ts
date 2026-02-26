import { differenceInCalendarDays, parseISO } from "date-fns";
import type { CalendarEvent } from "@/lib/types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CREATED_AT = "9999-12-31T23:59:59.999Z";

const parseIsoDate = (iso: string): Date | null => {
  if (!ISO_DATE_RE.test(iso)) return null;
  const parsed = parseISO(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const normalizeCreatedAt = (createdAt: string | undefined) => {
  if (typeof createdAt !== "string") return MAX_CREATED_AT;
  const trimmed = createdAt.trim();
  return trimmed.length > 0 ? trimmed : MAX_CREATED_AT;
};

const normalizeDayOrder = (dayOrder: number) =>
  Number.isFinite(dayOrder) ? Math.max(0, Math.trunc(dayOrder)) : 0;

export const isSingleDayEvent = (event: Pick<CalendarEvent, "startDate" | "endDate">) =>
  event.startDate === event.endDate;

export const isRenderableEventDateRange = (
  event: Pick<CalendarEvent, "startDate" | "endDate">
) => {
  const start = parseIsoDate(event.startDate);
  const end = parseIsoDate(event.endDate);
  if (!start || !end) return false;
  return end >= start;
};

export const getEventDurationDays = (event: Pick<CalendarEvent, "startDate" | "endDate">) => {
  const start = parseIsoDate(event.startDate);
  const end = parseIsoDate(event.endDate);
  if (!start || !end || end < start) return 0;
  return differenceInCalendarDays(end, start) + 1;
};

const compareByCreatedAtAsc = (a: Pick<CalendarEvent, "createdAt">, b: Pick<CalendarEvent, "createdAt">) =>
  normalizeCreatedAt(a.createdAt).localeCompare(normalizeCreatedAt(b.createdAt));

const canUseManualDayOrder = (
  a: Pick<CalendarEvent, "startDate" | "endDate">,
  b: Pick<CalendarEvent, "startDate" | "endDate">
) => isSingleDayEvent(a) && isSingleDayEvent(b) && a.startDate === b.startDate;

export const compareEventsByVisualPriority = (a: CalendarEvent, b: CalendarEvent) => {
  const durationDiff = getEventDurationDays(b) - getEventDurationDays(a);
  if (durationDiff !== 0) return durationDiff;

  if (canUseManualDayOrder(a, b)) {
    const dayOrderDiff = normalizeDayOrder(a.dayOrder) - normalizeDayOrder(b.dayOrder);
    if (dayOrderDiff !== 0) return dayOrderDiff;
  }

  const createdAtDiff = compareByCreatedAtAsc(a, b);
  if (createdAtDiff !== 0) return createdAtDiff;

  return a.id.localeCompare(b.id);
};

export const compareEventsForContinuousSlotting = (a: CalendarEvent, b: CalendarEvent) => {
  if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
  return compareEventsByVisualPriority(a, b);
};
