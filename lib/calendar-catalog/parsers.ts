import type { CalendarCatalogSource, OfficialCalendarEvent } from "./types";

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;

const pick = (record: UnknownRecord, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

const text = (value: unknown) => {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  const record = asRecord(value);
  if (!record) return "";
  return text(pick(record, ["name", "nome", "shortName", "displayName", "label"]));
};

const team = (record: UnknownRecord, side: "home" | "away") => {
  const home = side === "home";
  const value = pick(record, home
    ? ["homeTeam", "home", "mandante", "equipeMandante", "competitorOne"]
    : ["awayTeam", "away", "visitante", "equipeVisitante", "competitorTwo"]);
  return { name: text(value), id: text(asRecord(value)?.id ?? asRecord(value)?.codigo) };
};

const normalizeDate = (value: unknown) => {
  const raw = text(value);
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : "";
};

const normalizeTime = (value: unknown) => {
  const raw = text(value);
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "00:00";
};

const score = (record: UnknownRecord, side: "home" | "away") =>
  text(pick(record, side === "home"
    ? ["homeScore", "scoreHome", "golsMandante", "placarMandante"]
    : ["awayScore", "scoreAway", "golsVisitante", "placarVisitante"]));

const maybeEvent = (
  record: UnknownRecord,
  source: CalendarCatalogSource
): OfficialCalendarEvent | null => {
  let externalId = text(pick(record, ["externalId", "matchId", "eventId", "id", "codigo", "partidaId", "round"]));
  const date = normalizeDate(pick(record, ["date", "startDate", "data", "dataPartida", "startTime"]));
  let home = team(record, "home");
  let away = team(record, "away");
  if (source.parser_key === "formula1") {
    home = { name: text(pick(record, ["raceName", "grandPrix", "name", "title"])), id: "" };
    away = { name: "Fórmula 1", id: "formula1" };
  } else if (source.parser_key === "government_holidays") {
    home = { name: text(pick(record, ["holiday", "name", "title", "nome"])), id: "" };
    away = { name: "Feriado", id: "holiday" };
  }
  if (!externalId && date && home.name && ["formula1", "government_holidays"].includes(source.parser_key)) {
    externalId = `${date}:${home.name}`;
  }
  if (!externalId || !date || !home.name || !away.name) return null;
  const homeScore = score(record, "home");
  const awayScore = score(record, "away");
  const venueValue = pick(record, ["venue", "stadium", "estadio", "local"]);
  const venueRecord = asRecord(venueValue);
  return {
    externalId,
    competition: source.competition,
    season: source.season,
    date,
    time: normalizeTime(pick(record, ["time", "hora", "horario", "startTime"])),
    timezone: text(pick(record, ["timezone", "timeZone"])) || "America/Sao_Paulo",
    city: text(pick(record, ["city", "cidade"])) || text(venueRecord?.city),
    venue: text(venueValue) || text(pick(record, ["circuit", "location"])),
    phase: text(pick(record, ["phase", "round", "fase", "rodada", "stage"])) ||
      (source.parser_key === "formula1" ? "Grande Prêmio" : source.parser_key === "government_holidays" ? "Feriado" : ""),
    homeTeam: home.name,
    awayTeam: away.name,
    homeTeamId: home.id || undefined,
    awayTeamId: away.id || undefined,
    result: homeScore && awayScore ? `${homeScore} x ${awayScore}` : undefined,
    placeholder: Boolean(pick(record, ["placeholder", "isPlaceholder", "aDefinir"])),
  };
};

const collectRecords = (value: unknown, output: UnknownRecord[], seen: Set<unknown>) => {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry) => collectRecords(entry, output, seen));
    return;
  }
  const record = value as UnknownRecord;
  output.push(record);
  Object.values(record).forEach((entry) => collectRecords(entry, output, seen));
};

const jsonPayloads = (body: string, contentType: string) => {
  const payloads: unknown[] = [];
  if (contentType.includes("json")) {
    try { payloads.push(JSON.parse(body)); } catch { return []; }
  }
  for (const match of body.matchAll(/<script[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { payloads.push(JSON.parse(match[1])); } catch { /* malformed script is ignored */ }
  }
  for (const match of body.matchAll(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { payloads.push(JSON.parse(match[1])); } catch { /* malformed script is ignored */ }
  }
  return payloads;
};

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

const parseFormula1Html = (body: string, source: CalendarCatalogSource) => {
  const events: OfficialCalendarEvent[] = [];
  for (const card of body.matchAll(/<a[^>]+href="\/en\/racing\/(\d{4})\/([^"?#]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const year = card[1];
    const identifier = card[2];
    const content = card[3];
    const round = content.match(/>ROUND\s+(\d+)</i)?.[1];
    const weekend = content.match(/>(\d{2})\s+-\s+(\d{2})\s+([A-Z][a-z]{2})</)?.slice(1);
    const country = content.match(/<p[^>]*>([^<]+)<\/p>/)?.[1]?.trim();
    if (!round || !weekend || !country || !MONTHS[weekend[2]]) continue;
    events.push({
      externalId: round,
      competition: source.competition,
      season: source.season,
      date: `${year}-${MONTHS[weekend[2]]}-${weekend[1]}`,
      time: "00:00",
      timezone: "",
      city: "",
      venue: identifier,
      phase: "Grande Prêmio",
      homeTeam: country,
      awayTeam: "Fórmula 1",
      awayTeamId: "formula1",
      result: undefined,
      placeholder: false,
    });
  }
  return events;
};

export const parseOfficialSource = (
  body: string,
  contentType: string,
  source: CalendarCatalogSource
) => {
  if (source.parser_key === "formula1" && contentType.includes("html")) {
    return parseFormula1Html(body, source);
  }
  const records: UnknownRecord[] = [];
  jsonPayloads(body, contentType).forEach((payload) =>
    collectRecords(payload, records, new Set())
  );
  const events = records
    .map((record) => maybeEvent(record, source))
    .filter((event): event is OfficialCalendarEvent => Boolean(event));
  return Array.from(new Map(events.map((event) => [event.externalId, event])).values())
    .sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`));
};
