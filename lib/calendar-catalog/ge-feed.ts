import { canonicalEventId } from "./catalog-builder";
import { brazilianClubs2026, canonicalTeamId, canonicalTeamName } from "./team-identities";
import type {
  CalendarCatalogSource,
  CandidateValidationIssue,
  FeedCalendarEvent,
  OfficialCalendarEvent,
} from "./types";

type UnknownRecord = Record<string, unknown>;
type FetchLike = typeof fetch;

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;

const stringValue = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

const numberValue = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" && /^-?\d+$/.test(value.trim())
      ? Number(value)
      : null;

const extractAssignedJson = (body: string, assignment: string) => {
  const marker = body.indexOf(assignment);
  if (marker < 0) return null;
  const start = body.indexOf("{", marker + assignment.length);
  if (start < 0) return null;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < body.length; index += 1) {
    const character = body[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) {
      try { return JSON.parse(body.slice(start, index + 1)) as unknown; }
      catch { return null; }
    }
  }
  return null;
};

export type GePhase = { slug: string; name: string };

export const parseGeBootstrap = (body: string) => {
  const tableId = body.match(/\btUUID:\s*["']([^"']+)["']/)?.[1] ?? "";
  const classification = asRecord(extractAssignedJson(body, "const classificacao ="));
  const phases = Array.isArray(classification?.fases_navegacao)
    ? classification.fases_navegacao.flatMap((value): GePhase[] => {
        const phase = asRecord(value);
        const slug = stringValue(phase?.slug);
        return slug ? [{ slug, name: stringValue(phase?.nome) || slug }] : [];
      })
    : [];
  const currentPhase = asRecord(classification?.fase);
  if (phases.length === 0 && stringValue(currentPhase?.slug)) {
    phases.push({ slug: stringValue(currentPhase?.slug), name: stringValue(currentPhase?.slug) });
  }
  if (!tableId || !classification || phases.length === 0) {
    throw new Error("O bootstrap público do GE não contém tabela e fases válidas.");
  }
  return { tableId, phases, classification };
};

const collectGameRecords = (value: unknown, output: UnknownRecord[], seen: Set<unknown>) => {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry) => collectGameRecords(entry, output, seen));
    return;
  }
  const record = value as UnknownRecord;
  if (record.id && record.data_realizacao && asRecord(record.equipes)) output.push(record);
  Object.values(record).forEach((entry) => collectGameRecords(entry, output, seen));
};

const geTeam = (value: unknown) => {
  const record = asRecord(value);
  const name = canonicalTeamName(stringValue(record?.nome_popular));
  return { name, id: canonicalTeamId(name) ?? stringValue(record?.id) };
};

export const parseGeMatches = (
  payload: unknown,
  source: CalendarCatalogSource,
  phase: string
): FeedCalendarEvent[] => {
  const records: UnknownRecord[] = [];
  collectGameRecords(payload, records, new Set());
  return Array.from(new Map(records.flatMap((record): Array<[string, FeedCalendarEvent]> => {
    const providerExternalId = stringValue(record.id);
    const teams = asRecord(record.equipes);
    const home = geTeam(teams?.mandante);
    const away = geTeam(teams?.visitante);
    const dateTime = stringValue(record.data_realizacao);
    const date = dateTime.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
    const time = stringValue(record.hora_realizacao) || dateTime.match(/T(\d{2}:\d{2})/)?.[1] || "";
    if (!providerExternalId || !date || !/^\d{2}:\d{2}$/.test(time) || !home.name || !away.name) return [];

    const broadcastId = stringValue(asRecord(asRecord(record.transmissao)?.broadcast)?.id).toUpperCase();
    const started = record.jogo_ja_comecou === true;
    const status = broadcastId === "ENCERRADA" ? "finished" : started ? "in_progress" : "scheduled";
    const homeScore = numberValue(record.placar_oficial_mandante);
    const awayScore = numberValue(record.placar_oficial_visitante);
    const homePenalties = numberValue(record.placar_penaltis_mandante);
    const awayPenalties = numberValue(record.placar_penaltis_visitante);
    const venue = stringValue(asRecord(record.sede)?.nome_popular);
    const event: FeedCalendarEvent = {
      provider: "GE",
      providerExternalId,
      externalId: `ge:${providerExternalId}`,
      competition: source.competition,
      season: source.season,
      date,
      time,
      timezone: "America/Sao_Paulo",
      city: "",
      venue,
      phase,
      homeTeam: home.name,
      awayTeam: away.name,
      homeTeamId: home.id || undefined,
      awayTeamId: away.id || undefined,
      result: status === "finished" && homeScore !== null && awayScore !== null
        ? `${homeScore} x ${awayScore}`
        : undefined,
      penaltyResult: status === "finished" && homePenalties !== null && awayPenalties !== null
        ? `${homePenalties} x ${awayPenalties}`
        : undefined,
      placeholder: false,
      status,
    };
    return [[providerExternalId, event]];
  })).values()).sort((left, right) =>
    `${left.date}T${left.time}:${left.providerExternalId}`.localeCompare(`${right.date}T${right.time}:${right.providerExternalId}`)
  );
};

const request = async (fetchImpl: FetchLike, url: string, responseType: "text" | "json") => {
  const requestInit = {
    headers: { "user-agent": "Doze52-Calendar-Updater/1.0 (+https://doze52.com)" },
    signal: AbortSignal.timeout(20_000),
    cache: "force-cache",
    next: { revalidate: 60 },
  } as RequestInit;
  const response = await fetchImpl(url, requestInit);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return responseType === "text" ? response.text() : response.json();
};

const inBatches = async <T, R>(values: readonly T[], size: number, task: (value: T) => Promise<R>) => {
  const output: R[] = [];
  for (let index = 0; index < values.length; index += size) {
    output.push(...await Promise.all(values.slice(index, index + size).map(task)));
  }
  return output;
};

export const fetchGeFootballFeed = async (
  source: CalendarCatalogSource,
  fetchImpl: FetchLike = fetch
) => {
  if (source.feed_provider !== "GE" || !source.feed_url) return [];
  const html = await request(fetchImpl, source.feed_url, "text") as string;
  const bootstrap = parseGeBootstrap(html);
  const apiBase = `https://api.globoesporte.globo.com/tabela/${bootstrap.tableId}`;
  const phasePayloads = await inBatches(bootstrap.phases, 3, async (phase) => ({
    phase,
    payload: await request(fetchImpl, `${apiBase}/fase/${phase.slug}/classificacao/`, "json"),
  }));
  const batches: FeedCalendarEvent[][] = [];

  for (const { phase, payload } of phasePayloads) {
    const root = asRecord(payload);
    const groups = Array.isArray(root?.grupos) ? root.grupos.map(asRecord).filter(Boolean) as UnknownRecord[] : [];
    const roundRequests: Array<{ url: string; label: string }> = [];
    if (groups.length > 0 && root?.lista_tipo_unica === false) {
      for (const group of groups) {
        const groupId = stringValue(group.grupo_id);
        const lastRound = numberValue(asRecord(group.rodada)?.ultima) ?? 0;
        for (let round = 1; groupId && round <= lastRound; round += 1) {
          roundRequests.push({
            url: `${apiBase}/fase/${phase.slug}/rodada/${round}/grupo/${groupId}/jogos/`,
            label: `${phase.name} — Rodada ${round}`,
          });
        }
      }
    } else {
      const lastRound = numberValue(asRecord(root?.rodada)?.ultima) ?? 0;
      for (let round = 1; round <= lastRound; round += 1) {
        roundRequests.push({
          url: `${apiBase}/fase/${phase.slug}/rodada/${round}/jogos/`,
          label: `${phase.name} — Rodada ${round}`,
        });
      }
    }
    if (roundRequests.length === 0) {
      batches.push(parseGeMatches(payload, source, phase.name));
    } else {
      batches.push(...await inBatches(roundRequests, 4, async ({ url, label }) =>
        parseGeMatches(await request(fetchImpl, url, "json"), source, label)
      ));
    }
  }
  return Array.from(new Map(batches.flat().map((event) => [event.providerExternalId, event])).values())
    .sort((left, right) => `${left.date}T${left.time}:${left.providerExternalId}`
      .localeCompare(`${right.date}T${right.time}:${right.providerExternalId}`));
};

const participantKey = (event: OfficialCalendarEvent) =>
  `${canonicalTeamName(event.homeTeam)}|${canonicalTeamName(event.awayTeam)}`;

const sharesParticipant = (left: OfficialCalendarEvent, right: OfficialCalendarEvent) => {
  const leftTeams = new Set([canonicalTeamName(left.homeTeam), canonicalTeamName(left.awayTeam)]);
  return leftTeams.has(canonicalTeamName(right.homeTeam)) || leftTeams.has(canonicalTeamName(right.awayTeam));
};

const coveredClubNames = new Set(brazilianClubs2026.map((club) => club.name));
const isCoveredClubMatch = (event: OfficialCalendarEvent) =>
  coveredClubNames.has(canonicalTeamName(event.homeTeam)) || coveredClubNames.has(canonicalTeamName(event.awayTeam));

export const reconcileGeFootballFeed = ({
  source,
  officialEvents,
  feedEvents,
  officialMappings = new Map<string, string>(),
  geMappings = new Map<string, string>(),
}: {
  source: CalendarCatalogSource;
  officialEvents: readonly OfficialCalendarEvent[];
  feedEvents: readonly FeedCalendarEvent[];
  officialMappings?: ReadonlyMap<string, string>;
  geMappings?: ReadonlyMap<string, string>;
}) => {
  const issues: CandidateValidationIssue[] = [];
  const canonicalByOfficial = new Map(officialEvents.map((event) => [
    event.externalId,
    officialMappings.get(event.externalId) ?? canonicalEventId(source, event.externalId),
  ]));
  const officialByCanonical = new Map(officialEvents.map((event) => [canonicalByOfficial.get(event.externalId)!, event]));
  const feedByOfficial = new Map<string, FeedCalendarEvent>();
  const unmatchedFeedEvents: FeedCalendarEvent[] = [];

  for (const feedEvent of feedEvents) {
    const mappedCanonical = geMappings.get(feedEvent.providerExternalId);
    let official = mappedCanonical ? officialByCanonical.get(mappedCanonical) : undefined;
    if (official && participantKey(official) !== participantKey(feedEvent)) {
      issues.push({
        code: "participants_changed",
        eventId: feedEvent.providerExternalId,
        message: `O ID GE ${feedEvent.providerExternalId} diverge dos participantes oficiais.`,
      });
      continue;
    }
    if (!official) {
      const exact = officialEvents.filter((event) =>
        event.date === feedEvent.date && participantKey(event) === participantKey(feedEvent)
      );
      if (exact.length === 1) official = exact[0];
    }
    if (!official) {
      const sameClubAndDate = officialEvents.filter((event) =>
        event.date === feedEvent.date && sharesParticipant(event, feedEvent)
      );
      if (sameClubAndDate.length === 1) official = sameClubAndDate[0];
    }
    if (!official) {
      if (isCoveredClubMatch(feedEvent)) unmatchedFeedEvents.push(feedEvent);
      continue;
    }
    if (mappedCanonical && !officialByCanonical.has(mappedCanonical)) {
      canonicalByOfficial.set(official.externalId, mappedCanonical);
      officialByCanonical.set(mappedCanonical, official);
    }
    if (feedByOfficial.has(official.externalId)) {
      issues.push({
        code: "external_id_reused",
        eventId: feedEvent.providerExternalId,
        message: `Mais de um ID do GE foi reconciliado com ${official.homeTeam} x ${official.awayTeam}.`,
      });
      continue;
    }
    feedByOfficial.set(official.externalId, feedEvent);
  }

  const reconciledEvents = officialEvents.map((official) => {
    const feed = feedByOfficial.get(official.externalId);
    if (!feed || feed.status !== "finished" || !feed.result) return official;
    if (official.result && official.result !== feed.result) {
      issues.push({
        code: "result_conflict",
        eventId: official.externalId,
        message: `Placar divergente em ${official.homeTeam} x ${official.awayTeam}: oficial ${official.result}, GE ${feed.result}.`,
      });
      return official;
    }
    if (official.penaltyResult && feed.penaltyResult && official.penaltyResult !== feed.penaltyResult) {
      issues.push({
        code: "result_conflict",
        eventId: official.externalId,
        message: `Pênaltis divergentes em ${official.homeTeam} x ${official.awayTeam}.`,
      });
      return official;
    }
    return {
      ...official,
      result: official.result ?? feed.result,
      penaltyResult: official.penaltyResult ?? feed.penaltyResult,
      resultProvider: official.result ? official.resultProvider : "GE",
    };
  });

  const providerMappings = Array.from(feedByOfficial, ([officialExternalId, feed]) => ({
    providerExternalId: feed.providerExternalId,
    canonicalId: canonicalByOfficial.get(officialExternalId)!,
    participantFingerprint: participantKey(feed),
  }));
  return { reconciledEvents, unmatchedFeedEvents, issues, providerMappings };
};

export const missingOfficialMatchIssues = (events: readonly FeedCalendarEvent[]): CandidateValidationIssue[] =>
  events.map((event) => ({
    code: "missing_official_match",
    eventId: event.providerExternalId,
    message: `O jogo GE ${event.providerExternalId} (${event.homeTeam} x ${event.awayTeam}) não possui correspondência na fonte oficial.`,
  }));
