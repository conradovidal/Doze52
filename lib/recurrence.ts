import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  endOfYear,
  format,
  parseISO,
  startOfYear,
} from "date-fns";
import type { CalendarEvent, CalendarRenderEvent, RecurrenceType } from "@/lib/types";

const MAX_OCCURRENCES_PER_EVENT = 4096;

const advanceOccurrenceStart = (start: Date, recurrenceType: RecurrenceType) => {
  if (recurrenceType === "weekly") return addWeeks(start, 1);
  if (recurrenceType === "biweekly") return addWeeks(start, 2);
  if (recurrenceType === "monthly") return addMonths(start, 1);
  return addYears(start, 1);
};

const intersectsRange = (params: {
  startDate: Date;
  endDate: Date;
  rangeStart: Date;
  rangeEnd: Date;
}) => params.endDate >= params.rangeStart && params.startDate <= params.rangeEnd;

export const expandEventsForYear = (
  events: CalendarEvent[],
  year: number
): CalendarRenderEvent[] => {
  const rangeStart = startOfYear(new Date(year, 0, 1));
  const rangeEnd = endOfYear(new Date(year, 0, 1));
  const output: CalendarRenderEvent[] = [];

  for (const event of events) {
    const eventStart = parseISO(event.startDate);
    const eventEnd = parseISO(event.endDate);
    if (Number.isNaN(eventStart.getTime()) || Number.isNaN(eventEnd.getTime())) {
      continue;
    }
    if (eventEnd < eventStart) continue;

    const recurrenceType = event.recurrenceType;
    const recurrenceUntil = event.recurrenceUntil ? parseISO(event.recurrenceUntil) : null;
    const hasRecurrence =
      recurrenceType === "weekly" ||
      recurrenceType === "biweekly" ||
      recurrenceType === "monthly" ||
      recurrenceType === "yearly";
    const recurrenceUntilValid =
      recurrenceUntil && !Number.isNaN(recurrenceUntil.getTime()) ? recurrenceUntil : null;
    const durationDays = differenceInCalendarDays(eventEnd, eventStart);

    if (!hasRecurrence) {
      if (
        intersectsRange({
          startDate: eventStart,
          endDate: eventEnd,
          rangeStart,
          rangeEnd,
        })
      ) {
        output.push({
          ...event,
          sourceEventId: event.id,
          isOccurrence: false,
        });
      }
      continue;
    }

    let occurrenceStart = eventStart;
    let generated = 0;
    while (generated < MAX_OCCURRENCES_PER_EVENT && occurrenceStart <= rangeEnd) {
      if (!recurrenceUntilValid || occurrenceStart <= recurrenceUntilValid) {
        const occurrenceEnd = addDays(occurrenceStart, durationDays);
        if (
          intersectsRange({
            startDate: occurrenceStart,
            endDate: occurrenceEnd,
            rangeStart,
            rangeEnd,
          })
        ) {
          const occurrenceStartIso = format(occurrenceStart, "yyyy-MM-dd");
          const occurrenceEndIso = format(occurrenceEnd, "yyyy-MM-dd");
          output.push({
            ...event,
            id: `${event.id}::${occurrenceStartIso}`,
            startDate: occurrenceStartIso,
            endDate: occurrenceEndIso,
            sourceEventId: event.id,
            isOccurrence:
              occurrenceStartIso !== event.startDate || occurrenceEndIso !== event.endDate,
          });
        }
      }

      if (recurrenceUntilValid && occurrenceStart >= recurrenceUntilValid) {
        break;
      }
      occurrenceStart = advanceOccurrenceStart(occurrenceStart, recurrenceType);
      generated += 1;
    }
  }

  return output;
};
