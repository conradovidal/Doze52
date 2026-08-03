import { calendarPacks } from "../lib/calendar-packs";
import {
  getCalendarPackEventTitle,
  getCalendarPackGroupId,
} from "../lib/calendar-packs/import";

const fingerprints = new Map<string, Record<string, unknown>>();

for (const pack of calendarPacks) {
  for (const event of pack.events) {
    const groupId = getCalendarPackGroupId(pack);
    const key = `${groupId}:${event.id}`;
    if (fingerprints.has(key)) continue;
    fingerprints.set(key, {
      groupId,
      eventKey: event.id,
      legacyIds: event.legacyIds ?? [],
      title: getCalendarPackEventTitle(event, pack),
      sourceTitle: event.title,
      date: event.date,
    });
  }
}

process.stdout.write(JSON.stringify([...fingerprints.values()]));
