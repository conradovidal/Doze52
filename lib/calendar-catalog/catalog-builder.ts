import type { CalendarPack, CalendarPackEvent } from "@/lib/calendar-packs/types";
import { deterministicCalendarUuid } from "./ids";
import { incrementChangedPackVersions } from "./material";
import type { CalendarCatalogSource, OfficialCalendarEvent } from "./types";

const TEAM_GROUP = "brasileirao-2026-by-team";
const PROFILE_ID = "2026ba00-0000-4000-8000-000000000001";
const CATEGORY_ID = "2026ba00-0000-4000-8000-000000000002";

const slug = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const canonicalEventId = (source: CalendarCatalogSource, externalId: string) => {
  if (source.id === "cbf-brasileirao-2026" && /^\d{1,12}$/.test(externalId)) {
    return `2026ba00-0000-4000-8000-${externalId.padStart(12, "0")}`;
  }
  return deterministicCalendarUuid(
    source.authority,
    source.competition,
    source.season,
    externalId
  );
};

const toPackEvent = (
  source: CalendarCatalogSource,
  event: OfficialCalendarEvent
): CalendarPackEvent => ({
  id: canonicalEventId(source, event.externalId),
  legacyIds: [`${slug(source.competition)}-${source.season}-${event.externalId}`],
  title: source.parser_key === "formula1"
    ? `F1 ${event.externalId}: GP ${event.homeTeam}`
    : event.result
      ? `${event.homeTeam} ${event.result.replace(" x ", ` x `)} ${event.awayTeam}`
      : `${event.homeTeam} x ${event.awayTeam}`,
  date: event.date,
  time: event.time,
  timezone: event.timezone || "America/Sao_Paulo",
  city: event.city,
  venue: event.venue,
  phase: event.phase,
  competition: source.competition,
  homeTeam: event.homeTeam,
  awayTeam: event.awayTeam,
  suggestedCategoryKey: "favorite-team-2026",
  source: `${source.authority} — ${source.competition}`,
  sourceUrl: source.official_url,
  lastVerified: new Date().toISOString().slice(0, 10),
  result: event.result,
  notes: [`Referência oficial da partida: ${event.externalId}.`],
  isBrazilMatch: event.homeTeam === "Brasil" || event.awayTeam === "Brasil",
});

const buildBrazilianLeaguePacks = (
  source: CalendarCatalogSource,
  events: readonly OfficialCalendarEvent[]
): CalendarPack[] => {
  const teams = Array.from(new Set(events.flatMap((event) => [event.homeTeam, event.awayTeam])))
    .sort((left, right) => left.localeCompare(right, "pt-BR"));
  return teams.map((team) => ({
    id: `brasileirao-${source.season}-${slug(team)}`,
    version: 1,
    name: `Jogos do ${team}`,
    eyebrow: team,
    icon: "soccer-ball",
    description: `Jogos oficiais de ${source.season} nas competições cobertas.`,
    variantGroup: { id: TEAM_GROUP, label: "Time", optionLabel: team, selectionMode: "replace" },
    year: source.season,
    datasetStatus: "complete",
    updateNote: "Atualizado automaticamente a partir das fontes oficiais.",
    source: { label: `${source.authority} — ${source.competition}`, url: source.official_url, lastVerified: new Date().toISOString().slice(0, 10) },
    profile: { id: PROFILE_ID, name: `Jogos do ${team}`, icon: "calendar-days" },
    categories: [{ id: CATEGORY_ID, key: "favorite-team-2026", name: `Jogos do ${team}`, color: "#2563EB", legacyNames: ["Brasileirão 2026"] }],
    legacyCategoryIds: ["brasileirao-2026-category"],
    events: events.filter((event) => event.homeTeam === team || event.awayTeam === team).map((event) => toPackEvent(source, event)),
  }));
};

export const applyOfficialSourceToCatalog = (
  current: readonly CalendarPack[],
  source: CalendarCatalogSource,
  events: readonly OfficialCalendarEvent[]
) => {
  let candidate: CalendarPack[];
  if (source.id === "cbf-brasileirao-2026") {
    const generated = buildBrazilianLeaguePacks(source, events);
    candidate = [
      ...current.filter((pack) => pack.variantGroup?.id !== TEAM_GROUP),
      ...generated,
    ];
  } else {
    const officialEvents = events.map((event) => toPackEvent(source, event));
    candidate = current.map((pack) => {
      let relevant: CalendarPackEvent[] = [];
      if (pack.variantGroup?.id === TEAM_GROUP) {
        const team = pack.variantGroup.optionLabel;
        relevant = officialEvents.filter((event) => event.homeTeam === team || event.awayTeam === team);
      } else if (source.parser_key === "formula1" && pack.id === "formula-1-2026") {
        relevant = officialEvents;
      } else if (source.parser_key === "fifa" && pack.variantGroup?.id === "world-cup-2026-coverage") {
        relevant = pack.id.endsWith("-brazil")
          ? officialEvents.filter((event) => event.isBrazilMatch)
          : officialEvents;
      } else if (source.parser_key === "government_holidays" && pack.variantGroup?.id === "holidays-by-state") {
        relevant = officialEvents;
      } else {
        return pack;
      }

      const oldByIdentity = new Map<string, CalendarPackEvent>();
      pack.events.forEach((oldEvent) => {
        oldByIdentity.set(`${oldEvent.date}|${oldEvent.homeTeam}|${oldEvent.awayTeam}`, oldEvent);
        const reference = oldEvent.notes?.join(" ").match(/(?:partida|evento|referência)[^:]*:\s*([\w-]+)/i)?.[1];
        if (reference) oldByIdentity.set(`external:${reference}`, oldEvent);
      });
      const merged = relevant.map((newEvent) => {
        const external = newEvent.legacyIds?.[0]?.split("-").at(-1);
        const oldEvent = (external ? oldByIdentity.get(`external:${external}`) : undefined) ??
          oldByIdentity.get(`${newEvent.date}|${newEvent.homeTeam}|${newEvent.awayTeam}`) ??
          (relevant.filter((event) => event.date === newEvent.date).length === 1
            ? pack.events.find((event) => event.date === newEvent.date)
            : undefined);
        return oldEvent ? {
          ...newEvent,
          id: oldEvent.id,
          legacyIds: oldEvent.legacyIds ?? newEvent.legacyIds,
          time: newEvent.time === "00:00" ? oldEvent.time : newEvent.time,
          timezone: newEvent.timezone === "America/Sao_Paulo" && !newEvent.city
            ? oldEvent.timezone : newEvent.timezone,
          city: newEvent.city || oldEvent.city,
          venue: newEvent.venue || oldEvent.venue,
          notes: oldEvent.notes ?? newEvent.notes,
          recurrenceType: oldEvent.recurrenceType,
          recurrenceUntil: oldEvent.recurrenceUntil,
        } : newEvent;
      });
      const relevantIds = new Set(merged.map((event) => event.id));
      const untouched = pack.events.filter((event) =>
        !relevantIds.has(event.id) && event.competition !== source.competition && event.sourceUrl !== source.official_url
      );
      return { ...pack, events: [...untouched, ...merged].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)) };
    });
  }
  return incrementChangedPackVersions(current, candidate);
};
