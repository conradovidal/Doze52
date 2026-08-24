import { strToU8, zipSync } from "fflate";

import { filterAuthorCalendarSnapshot } from "@/lib/calendar-export";
import type { CalendarSnapshot } from "@/lib/sync";

const escapeCsv = (value: unknown) => {
  const raw = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${raw.replace(/"/g, '""')}"`;
};

const toCsv = (rows: Record<string, unknown>[]) => {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const body = rows
    .map((row) => headers.map((header) => escapeCsv(row[header])).join(","))
    .join("\n");
  return `${headers.join(",")}\n${body}`;
};

export const createUserDataBackupArchive = (
  snapshot: CalendarSnapshot,
  stamp = new Date().toISOString().slice(0, 10)
) => {
  const authorSnapshot = filterAuthorCalendarSnapshot(snapshot);
  const profilesCsv = toCsv(authorSnapshot.profiles.map((profile) => ({
    id: profile.id, name: profile.name, color: profile.color,
    icon: profile.icon, position: profile.position,
  })));
  const categoriesCsv = toCsv(authorSnapshot.categories.map((category, index) => ({
    id: category.id, profile_id: category.profileId, name: category.name,
    color: category.color, visible: category.visible, position: index,
  })));
  const eventsCsv = toCsv(authorSnapshot.events.map((event) => ({
    id: event.id, title: event.title, category_id: event.categoryId,
    start_date: event.startDate, end_date: event.endDate,
    notes: event.notes ?? "", recurrence_type: event.recurrenceType ?? "",
    recurrence_until: event.recurrenceUntil ?? "", created_at: event.createdAt,
    day_order: event.dayOrder,
  })));

  return zipSync({
    [`doze52-data-${stamp}.json`]: strToU8(JSON.stringify(authorSnapshot, null, 2)),
    [`doze52-profiles-${stamp}.csv`]: strToU8(profilesCsv),
    [`doze52-categories-${stamp}.csv`]: strToU8(categoriesCsv),
    [`doze52-events-${stamp}.csv`]: strToU8(eventsCsv),
  }, { level: 6 });
};
