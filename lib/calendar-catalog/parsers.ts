import type { CalendarCatalogSource, OfficialCalendarEvent } from "./types";
import { canonicalBrazilianClubById, canonicalTeamId, canonicalTeamName } from "./team-identities";

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

const ARTICLE_MONTHS: Record<string, string> = {
  janeiro: "01", enero: "01", fevereiro: "02", febrero: "02", marco: "03", marzo: "03",
  abril: "04", maio: "05", mayo: "05", junho: "06", junio: "06", julho: "07", julio: "07",
  agosto: "08", setembro: "09", septiembre: "09", outubro: "10", octubre: "10",
  novembro: "11", noviembre: "11", dezembro: "12", diciembre: "12",
};

const decodeHtml = (value: string) => value
  .replace(/<br\s*\/?>/gi, " ")
  .replace(/<[^>]+>/g, "")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#039;|&apos;/gi, "'")
  .replace(/\s+/g, " ")
  .trim();

const normalizedWord = (value: string) => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase();

const articleElements = (body: string) => Array.from(
  body.matchAll(/<(h[12]|p)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi),
  (match) => ({ tag: match[1].toLowerCase(), text: decodeHtml(match[2]) })
);

const slugIdentity = (value: string) => normalizedWord(value)
  .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const timezoneForCity = (city: string) => {
  const normalized = normalizedWord(city);
  if (/la paz|el alto|sucre|santa cruz/.test(normalized)) return "America/La_Paz";
  if (/santiago|rancagua|coquimbo/.test(normalized)) return "America/Santiago";
  if (/bogota|ibague|medellin|cartagena|cali/.test(normalized)) return "America/Bogota";
  if (/quito|guayaquil|cuenca/.test(normalized)) return "America/Guayaquil";
  if (/lima|cusco|callao/.test(normalized)) return "America/Lima";
  if (/caracas|valencia/.test(normalized)) return "America/Caracas";
  if (/asuncion/.test(normalized)) return "America/Asuncion";
  if (/montevideo/.test(normalized)) return "America/Montevideo";
  if (/buenos aires|la plata|mendoza|rosario|victoria|avellaneda|banfield/.test(normalized)) return "America/Argentina/Buenos_Aires";
  return "America/Sao_Paulo";
};

const conmebolEvent = ({
  source, externalId, date, time, city, venue, phase, homeTeam, awayTeam,
}: {
  source: CalendarCatalogSource; externalId: string; date: string; time: string;
  city: string; venue: string; phase: string; homeTeam: string; awayTeam: string;
}): OfficialCalendarEvent => {
  const canonicalHome = canonicalTeamName(homeTeam);
  const canonicalAway = canonicalTeamName(awayTeam);
  return {
    externalId, competition: source.competition, season: source.season, date, time,
    timezone: timezoneForCity(city), city, venue, phase,
    homeTeam: canonicalHome, awayTeam: canonicalAway,
    homeTeamId: canonicalTeamId(canonicalHome), awayTeamId: canonicalTeamId(canonicalAway),
    placeholder: false,
  };
};

const parseConmebolGroupArticle = (body: string, source: CalendarCatalogSource) => {
  let round = "";
  let date = "";
  const events: OfficialCalendarEvent[] = [];
  for (const element of articleElements(body)) {
    const roundMatch = element.text.match(/(?:FECHA|RODADA)\s*(\d+)/i);
    if (roundMatch) round = roundMatch[1];
    const dateMatch = normalizedWord(element.text).match(/(\d{1,2})\s+de\s+([a-z]+)/);
    if (dateMatch && ARTICLE_MONTHS[dateMatch[2]]) {
      date = `2026-${ARTICLE_MONTHS[dateMatch[2]]}-${dateMatch[1].padStart(2, "0")}`;
    }
    if (element.tag !== "p" || !date || !round) continue;
    const match = element.text.match(/(\d{1,2}:\d{2})h?\s*(?:-\s*)?(.+?)\s+\(([^)]+)\)\s+(?:vs\.?|x|-)\s+(.+?)\s+\(([^)]+)\)(.*)$/i);
    if (!match) continue;
    const homeTeam = match[2].replace(/\s+-\s*$/, "").trim();
    const awayTeam = match[4].replace(/\s+-\s*$/, "").trim();
    const remainder = match[6].replace(/^\s*-?\s*/, "");
    const location = remainder.replace(/^Grupo\s+[A-Z]\s*[-,]?\s*/i, "").trim();
    const locationParts = location.split(",").map((part) => part.trim()).filter(Boolean);
    const city = locationParts.at(-1) ?? "";
    const venue = locationParts.slice(0, -1).join(", ").replace(/^Estadio\s+/i, "Estádio ");
    events.push(conmebolEvent({
      source,
      externalId: `group-${round}-${slugIdentity(homeTeam)}-${slugIdentity(awayTeam)}`,
      date, time: match[1], city, venue, phase: `Fase de grupos — Rodada ${round}`,
      homeTeam, awayTeam,
    }));
  }
  return events;
};

const parseConmebolKnockoutArticle = (body: string, source: CalendarCatalogSource) => {
  let matchup: { home: string; away: string } | null = null;
  const events: OfficialCalendarEvent[] = [];
  const phase = /CALEND[ÁA]RIO DOS PLAYOFFS/i.test(body) ? "Playoff das oitavas" : "Oitavas de final";
  for (const element of articleElements(body)) {
    if (element.tag === "h2") {
      const match = element.text.match(/^(.+?)\s+(?:x|vs\.?)\s+(.+)$/i);
      matchup = match ? { home: match[1].trim(), away: match[2].trim() } : null;
      continue;
    }
    if (element.tag !== "p" || !matchup) continue;
    const match = element.text.match(/^(Ida|Volta):.*?(\d{1,2})\/(\d{1,2}).*?(\d{1,2})h(?:(\d{2}))?\s*,\s*(?:(?:no|na|em)\s+)?(.+)$/i);
    if (!match) continue;
    const isReturn = normalizedWord(match[1]) === "volta";
    const homeTeam = isReturn ? matchup.away : matchup.home;
    const awayTeam = isReturn ? matchup.home : matchup.away;
    const locationParts = match[6].replace(/^(?:estadio|estádio)\s+/i, "Estádio ")
      .split(",").map((part) => part.trim()).filter(Boolean);
    const city = locationParts.at(-1) ?? "";
    const venue = locationParts.slice(0, -1).join(", ");
    const date = `2026-${match[3].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
    events.push(conmebolEvent({
      source,
      externalId: `${slugIdentity(phase)}-${date}-${slugIdentity(homeTeam)}-${slugIdentity(awayTeam)}`,
      date, time: `${match[4].padStart(2, "0")}:${match[5] ?? "00"}`,
      city, venue, phase, homeTeam, awayTeam,
    }));
  }
  return events;
};

const FIXTURE_MONTHS: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

const fixtureLocation = (venue: string) => {
  const normalized = normalizedWord(venue);
  if (/victor agustin ugarte|potosi/.test(normalized)) return { city: "Potosí", timezone: "America/La_Paz" };
  if (/el teniente/.test(normalized)) return { city: "Rancagua", timezone: "America/Santiago" };
  if (/monumental banco pichincha/.test(normalized)) return { city: "Guayaquil", timezone: "America/Guayaquil" };
  if (/fonte nova/.test(normalized)) return { city: "Salvador", timezone: "America/Sao_Paulo" };
  if (/nilton santos/.test(normalized)) return { city: "Rio de Janeiro", timezone: "America/Sao_Paulo" };
  return { city: "", timezone: "America/Sao_Paulo" };
};

const fixtureDetail = (body: string, className: string) => {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(new RegExp(
    `m-match-fixture-details__list-item--${escaped}[\\s\\S]{0,700}?m-match-fixture-details__list-item-value[\"'][^>]*>([\\s\\S]*?)<\\/span>`,
    "i"
  ));
  return match ? decodeHtml(match[1]) : "";
};

const parseConmebolFixture = (
  body: string,
  source: CalendarCatalogSource,
  sourceUrl: string
) => {
  const records: UnknownRecord[] = [];
  jsonPayloads(body, "text/html").forEach((payload) => collectRecords(payload, records, new Set()));
  const targeting = records.find((record) =>
    text(record.fixture_id) && text(record.fixture_home_team_title) && text(record.fixture_away_team_title)
  );
  const urlFixtureId = sourceUrl.match(/\/fixture\/view\/(\d+)/)?.[1] ?? "";
  const fixtureId = text(targeting?.fixture_id) || urlFixtureId;
  if (!fixtureId || (urlFixtureId && fixtureId !== urlFixtureId)) return [];

  const title = text(targeting?.fixture_title);
  const dateTime = normalizedWord(title).match(/(\d{1,2})\s+([a-z]{3})\s+(\d{4})\s*-\s*(\d{1,2}:\d{2})/);
  const month = dateTime ? FIXTURE_MONTHS[dateTime[2]] : undefined;
  const homeTeam = text(targeting?.fixture_home_team_title);
  const awayTeam = text(targeting?.fixture_away_team_title);
  if (!dateTime || !month || !homeTeam || !awayTeam) return [];

  const venueRelations = asRecord(targeting?.relations)?.cc_venue_vocab;
  const venue = Array.isArray(venueRelations)
    ? text(asRecord(venueRelations[0])?.label)
    : fixtureDetail(body, "venue");
  const location = fixtureLocation(venue);
  const phaseValue = text(targeting?.fixture_stage_title);
  const phase = phaseValue === "2nd Round" ? "Segunda fase"
    : phaseValue === "3rd Round" ? "Terceira fase"
      : phaseValue;
  const finalScore = fixtureDetail(body, "full-time-score").match(/(\d+)\s*[-x]\s*(\d+)/i);
  const canonicalHome = canonicalTeamName(homeTeam);
  const canonicalAway = canonicalTeamName(awayTeam);
  return [{
    externalId: `fixture-${fixtureId}`,
    competition: source.competition,
    season: source.season,
    date: `${dateTime[3]}-${month}-${dateTime[1].padStart(2, "0")}`,
    time: dateTime[4],
    timezone: location.timezone,
    city: location.city,
    venue,
    phase,
    homeTeam: canonicalHome,
    awayTeam: canonicalAway,
    homeTeamId: canonicalTeamId(canonicalHome),
    awayTeamId: canonicalTeamId(canonicalAway),
    result: finalScore ? `${finalScore[1]} x ${finalScore[2]}` : undefined,
    placeholder: false,
  } satisfies OfficialCalendarEvent];
};

const parseConmebolHtml = (body: string, source: CalendarCatalogSource, sourceUrl = "") => {
  if (sourceUrl.includes("/fixture/view/")) {
    return parseConmebolFixture(body, source, sourceUrl);
  }
  const events = /\b(?:Ida|Volta):/i.test(body)
    ? parseConmebolKnockoutArticle(body, source)
    : parseConmebolGroupArticle(body, source);
  return Array.from(new Map(events.map((event) => [event.externalId, event])).values())
    .sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`));
};

const cbfTeam = (value: unknown) => {
  const record = asRecord(value);
  const shield = text(record?.url_escudo);
  return {
    name: text(record?.nome),
    id: shield.match(/\/clubes\/(\d+)\/escudo/i)?.[1],
    goals: record?.gols === null || record?.gols === "" ? "" : text(record?.gols),
  };
};

const parseCbfPayload = (body: string, source: CalendarCatalogSource) => {
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { return []; }
  const root = asRecord(payload);
  if (!root) return [];
  const records = Object.entries(root).flatMap(([phaseName, phase]) => {
    const games = asRecord(phase)?.jogos;
    return Array.isArray(games) ? games.map((record) => ({ phaseName, record })) : [];
  });
  return records.flatMap(({ phaseName, record: value }): OfficialCalendarEvent[] => {
    const record = asRecord(value);
    if (!record) return [];
    const externalId = text(record.ref_jogo);
    const date = normalizeDate(record.data);
    const rawTime = text(record.hora);
    const home = cbfTeam(record.mandante);
    const away = cbfTeam(record.visitante);
    if (!externalId || !date || date === "1900-01-01" || !/^\d{1,2}:\d{2}$/.test(rawTime) || !home.name || !away.name || !home.id || !away.id) return [];
    return [{
      externalId, competition: source.competition, season: source.season,
      date, time: normalizeTime(rawTime), timezone: "America/Sao_Paulo",
      city: [text(record.cidade), text(record.uf)].filter(Boolean).join(" - "),
      venue: text(record.estadio),
      phase: source.id === "cbf-copa-do-brasil-2026" ? phaseName : `Rodada ${text(record.rodada)}`,
      homeTeam: canonicalBrazilianClubById(home.id ?? "")?.name ?? home.name,
      awayTeam: canonicalBrazilianClubById(away.id ?? "")?.name ?? away.name,
      homeTeamId: home.id, awayTeamId: away.id,
      result: home.goals !== "" && away.goals !== "" ? `${home.goals} x ${away.goals}` : undefined,
      placeholder: false,
    }];
  }).sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`));
};

export const parseOfficialSource = (
  body: string,
  contentType: string,
  source: CalendarCatalogSource,
  context: { sourceUrl?: string } = {}
) => {
  if (source.parser_key === "cbf" && contentType.includes("json")) {
    return parseCbfPayload(body, source);
  }
  if (source.parser_key === "formula1" && contentType.includes("html")) {
    return parseFormula1Html(body, source);
  }
  if (source.parser_key === "conmebol" && contentType.includes("html")) {
    return parseConmebolHtml(body, source, context.sourceUrl);
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
