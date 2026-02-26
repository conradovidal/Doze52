import { parseISO } from "date-fns";
import type { CalendarEvent } from "@/lib/types";
import {
  compareEventsForContinuousSlotting,
  isRenderableEventDateRange,
  isSingleDayEvent,
} from "@/lib/event-order";

const toDate = (iso: string) => parseISO(iso);

export const buildMultiDaySlotMap = (params: {
  events: CalendarEvent[];
  rangeStartIso: string;
  rangeEndIso: string;
}) => {
  const rangeStart = toDate(params.rangeStartIso);
  const rangeEnd = toDate(params.rangeEndIso);
  const slotMap = new Map<string, number>();
  const lastEndBySlot: Date[] = [];

  const candidates = params.events
    .filter((event) => !isSingleDayEvent(event))
    .filter(isRenderableEventDateRange)
    .sort(compareEventsForContinuousSlotting);

  for (const event of candidates) {
    const eventStart = toDate(event.startDate);
    const eventEnd = toDate(event.endDate);
    if (eventEnd < rangeStart || eventStart > rangeEnd) continue;

    const clampedStart = eventStart < rangeStart ? rangeStart : eventStart;
    const clampedEnd = eventEnd > rangeEnd ? rangeEnd : eventEnd;

    let nextSlot = 0;
    while (
      nextSlot < lastEndBySlot.length &&
      lastEndBySlot[nextSlot] >= clampedStart
    ) {
      nextSlot += 1;
    }
    if (nextSlot === lastEndBySlot.length) {
      lastEndBySlot.push(clampedEnd);
    } else {
      lastEndBySlot[nextSlot] = clampedEnd;
    }
    slotMap.set(event.id, nextSlot);
  }

  return slotMap;
};
