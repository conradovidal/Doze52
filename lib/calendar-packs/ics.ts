import type { CalendarPack, CalendarPackSelection } from "./types";
import { getCalendarPackEvents } from "./import";

const ICS_EVENT_DURATION_MINUTES = 150;

const pad = (value: number) => String(value).padStart(2, "0");

const toIcsDateTime = (date: string, time: string) =>
  `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;

const addMinutesToLocalDateTime = (date: string, time: string, minutes: number) => {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day, hour, minute + minutes));
  return `${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(
    next.getUTCDate()
  )}T${pad(next.getUTCHours())}${pad(next.getUTCMinutes())}00`;
};

const toUtcStamp = (date: Date) =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(
    date.getUTCDate()
  )}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(
    date.getUTCSeconds()
  )}Z`;

const escapeIcsText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

const foldIcsLine = (line: string) => {
  if (line.length <= 75) return line;

  const chunks: string[] = [];
  let cursor = 0;
  let limit = 75;

  while (cursor < line.length) {
    chunks.push(`${cursor === 0 ? "" : " "}${line.slice(cursor, cursor + limit)}`);
    cursor += limit;
    limit = 74;
  }

  return chunks.join("\r\n");
};

const serializeIcs = (lines: string[]) =>
  `${lines.map(foldIcsLine).join("\r\n")}\r\n`;

const getCalendarName = (pack: CalendarPack, selection: CalendarPackSelection) =>
  selection === "brazil" ? `${pack.name} - Brasil` : `${pack.name} - Completo`;

export const generateCalendarPackIcs = (
  pack: CalendarPack,
  selection: CalendarPackSelection
) => {
  const now = toUtcStamp(new Date());
  const name = getCalendarName(pack, selection);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//Doze 52//Calendar Packs//PT-BR",
    `X-WR-CALNAME:${escapeIcsText(name)}`,
  ];

  for (const event of getCalendarPackEvents(pack, selection)) {
    const phase = event.group ? `${event.phase} - Grupo ${event.group}` : event.phase;
    const description = [
      `Horario: ${event.time} (${event.timezone})`,
      `Local: ${event.venue} - ${event.city}`,
      `Fase: ${phase}`,
      `Fonte: ${event.source}`,
      `Verificado em: ${event.lastVerified}`,
    ].join("\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@doze52.calendar-pack`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=${event.timezone}:${toIcsDateTime(event.date, event.time)}`,
      `DTEND;TZID=${event.timezone}:${addMinutesToLocalDateTime(
        event.date,
        event.time,
        ICS_EVENT_DURATION_MINUTES
      )}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      `LOCATION:${escapeIcsText(`${event.venue}, ${event.city}`)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `CATEGORIES:${event.isBrazilMatch ? "Brasil" : "Outros jogos"}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return serializeIcs(lines);
};

export const downloadCalendarPackIcs = (
  pack: CalendarPack,
  selection: CalendarPackSelection
) => {
  if (typeof document === "undefined") return;

  const suffix = selection === "brazil" ? "brasil" : "completo";
  const blob = new Blob([generateCalendarPackIcs(pack, selection)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `doze52-copa-do-mundo-2026-${suffix}.ics`;
  link.click();
  URL.revokeObjectURL(url);
};
