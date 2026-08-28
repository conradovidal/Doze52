import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import type { CalendarPack } from "@/lib/calendar-packs/types";
import { applyOfficialSourceToCatalog } from "./catalog-builder";
import { canonicalEventId } from "./catalog-builder";
import { fetchCbfOfficialSource } from "./cbf-transport";
import { diffCatalogs, materialHash } from "./material";
import { fetchGeFootballFeed, missingOfficialMatchIssues, reconcileGeFootballFeed } from "./ge-feed";
import { parseOfficialFixtureParticipantKeys, parseOfficialSource } from "./parsers";
import { fallbackCatalog, getPublishedCatalog, listRunnableSources } from "./repository";
import {
  CALENDAR_SOURCE_LIMITS,
  CalendarSourceBudget,
  CalendarSourceLimitError,
  fetchBoundedCalendarSource,
} from "./source-transport";
import type { FootballCandidatePayload, OfficialCalendarEvent } from "./types";
import { validateOfficialCandidate } from "./validation";

export type RefreshTrigger = "scheduled_midnight" | "scheduled_closing" | "manual";

export class CalendarRefreshInProgressError extends Error {
  constructor(
    readonly activeRunId: string | null,
    readonly retryAfterSeconds: number
  ) {
    super("Calendar catalog refresh is already in progress.");
    this.name = "CalendarRefreshInProgressError";
  }
}

class CalendarRefreshLeaseLostError extends Error {
  constructor() {
    super("Calendar catalog refresh lease was lost.");
    this.name = "CalendarRefreshLeaseLostError";
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const OFFICIAL_SOURCE_HOSTS: Record<string, ReadonlySet<string>> = {
  conmebol: new Set(["gol.conmebol.com"]),
  formula1: new Set(["formula1.com", "www.formula1.com"]),
  fifa: new Set(["fifa.com", "www.fifa.com"]),
  government_holidays: new Set(["gov.br", "www.gov.br"]),
};
const MAX_OFFICIAL_EVENTS_PER_SOURCE = 2_000;

const OFFICIAL_FETCH_URLS: Record<string, readonly string[]> = {
  "cbf-brasileirao-2026": ["https://www.cbf.com.br/api/cbf/jogos/tabela-detalhada/campeonato/1260611"],
  "cbf-copa-do-brasil-2026": ["https://www.cbf.com.br/api/cbf/jogos/tabela-detalhada/campeonato/1260615"],
  "conmebol-libertadores-2026": [
    "https://gol.conmebol.com/libertadores/pt-br/fixture/view/5",
    "https://gol.conmebol.com/libertadores/pt-br/fixture/view/13",
    "https://gol.conmebol.com/libertadores/pt-br/fixture/view/3",
    "https://gol.conmebol.com/libertadores/pt-br/fixture/view/11",
    "https://gol.conmebol.com/libertadores/pt-br/fixture/view/714",
    "https://gol.conmebol.com/libertadores/pt-br/fixture/view/711",
    "https://gol.conmebol.com/libertadores/es/news/calendario-conmebol-libertadores-2026-dias-horarios-y-sedes-de-la-fase-de-grupos",
    "https://gol.conmebol.com/libertadores/pt-br/news/datas-e-horarios-assim-serao-disputadas-oitavas-de-final-da-conmebol-libertadores",
  ],
  "conmebol-sudamericana-2026": [
    "https://gol.conmebol.com/sudamericana/es/news/calendario-conmebol-sudamericana-2026-dias-horarios-y-sedes-de-la-fase-de-grupos",
    "https://gol.conmebol.com/sudamericana/pt-br/news/para-tomar-nota-assim-serao-disputados-os-playoffs-das-oitavas-de-final-da-conmebol",
    "https://gol.conmebol.com/sudamericana/pt-br/news/assim-serao-disputadas-oitavas-de-final-da-conmebol-sudamericana",
  ],
};

const stageError = (stage: string, error: unknown, url?: string) => {
  const message = error instanceof Error ? error.message : "Falha desconhecida";
  return new Error(`${stage}${url ? ` (${url})` : ""}: ${message}`, { cause: error });
};

const fetchOfficialEvents = async (
  source: Parameters<typeof parseOfficialSource>[2],
  budget: CalendarSourceBudget
) => {
  const urls = OFFICIAL_FETCH_URLS[source.id] ?? [source.official_url];
  const batches = await Promise.all(urls.map(async (url) => {
    let body: string;
    let contentType: string;
    try {
      if (source.parser_key === "cbf") {
        ({ body, contentType } = await fetchCbfOfficialSource(url, source.id, budget));
      } else {
        const allowedHosts = OFFICIAL_SOURCE_HOSTS[source.parser_key];
        if (!allowedHosts) {
          throw new CalendarSourceLimitError("source_parser_not_allowed");
        }
        ({ body, contentType } = await fetchBoundedCalendarSource({
          sourceId: source.id,
          input: url,
          allowedHosts,
          acceptedContentTypes: ["application/json", "text/html"],
          maxBytes: CALENDAR_SOURCE_LIMITS.officialResponseBytes,
          budget,
        }));
      }
    } catch (error) {
      throw stageError("official_fetch", error, url);
    }
    try {
      const events = parseOfficialSource(body, contentType, source, { sourceUrl: url });
      if (events.length === 0) throw new Error("nenhum evento oficial reconhecido");
      return {
        events,
        fixtureParticipantKeys: parseOfficialFixtureParticipantKeys(body, contentType, source, { sourceUrl: url }),
      };
    } catch (error) {
      budget.fail(source.id, "official_parser_failed");
      throw stageError("official_parser", error, url);
    }
  }));
  const events = Array.from(new Map(batches.flatMap((batch) => batch.events)
    .map((event) => [event.externalId, event])).values())
    .sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`));
  if (events.length > MAX_OFFICIAL_EVENTS_PER_SOURCE) {
    budget.fail(source.id, "source_event_limit_exceeded");
    throw new CalendarSourceLimitError("source_event_limit_exceeded");
  }
  const fixtureParticipantKeys = new Set(batches.flatMap((batch) => [...batch.fixtureParticipantKeys]));
  return { events, fixtureParticipantKeys };
};

const positiveRetryAfter = (value: unknown) => {
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : 1;
};

const claimCalendarRefresh = async (
  trigger: RefreshTrigger,
  requestedBy?: string
) => {
  const { data, error } = await getSupabaseAdminClient().rpc(
    "claim_calendar_pack_refresh",
    { p_trigger_kind: trigger, p_requested_by: requestedBy ?? null }
  );
  if (error) throw error;
  const claim = data as Record<string, unknown> | null;
  if (claim?.outcome === "in_progress") {
    throw new CalendarRefreshInProgressError(
      typeof claim.activeRunId === "string" && UUID_PATTERN.test(claim.activeRunId)
        ? claim.activeRunId
        : null,
      positiveRetryAfter(claim.retryAfterSeconds)
    );
  }
  if (
    claim?.outcome !== "acquired" ||
    typeof claim.runId !== "string" ||
    !UUID_PATTERN.test(claim.runId) ||
    typeof claim.leaseToken !== "string" ||
    !UUID_PATTERN.test(claim.leaseToken)
  ) {
    throw new Error("Invalid calendar refresh claim response.");
  }
  return { runId: claim.runId, leaseToken: claim.leaseToken };
};

const renewCalendarRefresh = async (runId: string, leaseToken: string) => {
  const { data, error } = await getSupabaseAdminClient().rpc(
    "renew_calendar_pack_refresh",
    { p_run_id: runId, p_lease_token: leaseToken }
  );
  if (error) throw error;
  if (data !== true) throw new CalendarRefreshLeaseLostError();
};

const releaseCalendarRefresh = async (runId: string, leaseToken: string) => {
  const { error } = await getSupabaseAdminClient().rpc(
    "release_calendar_pack_refresh",
    { p_run_id: runId, p_lease_token: leaseToken }
  );
  if (error) throw error;
};

const sourceErrorCode = (error: unknown) => {
  if (error instanceof CalendarSourceLimitError) return error.code;
  const message = error instanceof Error ? error.message : "";
  const stage = message.match(/^([a-z_]+)/)?.[1];
  return stage ? `${stage}_failed`.slice(0, 64) : "source_refresh_failed";
};

const candidateOfficialEvents = (payload: unknown) => {
  if (Array.isArray(payload)) return payload as OfficialCalendarEvent[];
  const candidate = payload as Partial<FootballCandidatePayload> | null;
  return Array.isArray(candidate?.officialEvents) ? candidate.officialEvents : [];
};

export const refreshCalendarCatalog = async ({
  trigger,
  requestedBy,
}: {
  trigger: RefreshTrigger;
  requestedBy?: string;
}) => {
  const admin = getSupabaseAdminClient();
  const lease = await claimCalendarRefresh(trigger, requestedBy);
  const run = { id: lease.runId };
  const budget = new CalendarSourceBudget();

  const summary = {
    checked: 0,
    unchanged: 0,
    shadow: 0,
    publishable: 0,
    quarantined: 0,
    failed: 0,
    unmatched: 0,
    sources: budget.snapshot(),
  };

  try {
    const published = (await getPublishedCatalog()) ?? fallbackCatalog();
    let candidatePacks: CalendarPack[] = published.packs;
    const sources = await listRunnableSources();
    const publishableCandidateIds: string[] = [];
    for (const source of sources) {
      await renewCalendarRefresh(run.id, lease.leaseToken);
      summary.checked += 1;
      try {
        const [officialSource, feedEvents, mappingResult] = await Promise.all([
          fetchOfficialEvents(source, budget),
          fetchGeFootballFeed(source, fetch, budget)
            .catch((error) => { throw stageError("ge_feed", error); }),
          admin.from("calendar_pack_external_ids")
            .select("authority, external_id, canonical_id, participant_fingerprint")
            .eq("competition", source.competition)
            .eq("season", source.season)
            .in("authority", [source.authority, "GE"]),
        ]);
        const { events: officialEvents, fixtureParticipantKeys } = officialSource;
        if (mappingResult.error) throw stageError("mapping_lookup", mappingResult.error);
        const officialMappings = new Map<string, string>();
        const geMappings = new Map<string, string>();
        const geMappingFingerprints = new Map<string, string>();
        for (const mapping of mappingResult.data ?? []) {
          (mapping.authority === "GE" ? geMappings : officialMappings)
            .set(mapping.external_id, mapping.canonical_id);
          if (mapping.authority === "GE" && mapping.participant_fingerprint) {
            geMappingFingerprints.set(mapping.external_id, mapping.participant_fingerprint);
          }
        }
        let reconciliation;
        try {
          reconciliation = source.feed_provider === "GE"
            ? reconcileGeFootballFeed({
                source, officialEvents, feedEvents, officialFixtureParticipantKeys: fixtureParticipantKeys,
                officialMappings, geMappings, geMappingFingerprints,
              })
            : {
                reconciledEvents: officialEvents,
                unmatchedFeedEvents: [],
                issues: [],
                providerMappings: [],
              };
        } catch (error) {
          throw stageError("reconciliation", error);
        }
        const events = reconciliation.reconciledEvents;
        summary.unmatched += reconciliation.unmatchedFeedEvents.length;

        const { data: previousCandidate } = await admin
          .from("calendar_pack_candidates")
          .select("payload")
          .eq("source_id", source.id)
          .in("status", ["shadow", "publishable", "published", "unchanged"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const previousEvents = candidateOfficialEvents(previousCandidate?.payload);
        const issues = [
          ...validateOfficialCandidate({ previous: previousEvents, candidate: officialEvents }),
          ...reconciliation.issues,
          ...missingOfficialMatchIssues(reconciliation.unmatchedFeedEvents),
        ];
        const proposed = issues.length === 0
          ? applyOfficialSourceToCatalog(candidatePacks, source, events)
          : candidatePacks;
        const diff = diffCatalogs(candidatePacks, proposed);
        const unchanged = diff.added.length + diff.changed.length + diff.removed.length === 0;
        const status = issues.length > 0
          ? "quarantined"
          : unchanged
            ? "unchanged"
            : source.rollout_status === "active" ? "publishable" : "shadow";

        summary[status as "unchanged" | "shadow" | "publishable" | "quarantined"] += 1;
        const { data: candidate, error: candidateError } = await admin
          .from("calendar_pack_candidates")
          .insert({
            run_id: run.id,
            source_id: source.id,
            base_release_id: published.releaseId,
            material_hash: materialHash(proposed),
            payload: source.feed_provider === "GE" ? {
              provider: "GE",
              feedEvents,
              officialEvents,
              reconciledEvents: events,
              unmatchedFeedEvents: reconciliation.unmatchedFeedEvents,
            } satisfies FootballCandidatePayload : events,
            diff,
            validation_issues: issues,
            status,
          })
          .select("id")
          .single();
        if (candidateError) throw candidateError;
        if (status === "publishable") {
          candidatePacks = proposed;
          publishableCandidateIds.push(candidate.id);
        }
        if (issues.length === 0) {
          const mappings = events.map((event) => {
            const deterministicId = canonicalEventId(source, event.externalId);
            const relevant = proposed.flatMap((pack) => pack.events).filter((packEvent) =>
              packEvent.id === deterministicId ||
              packEvent.notes?.some((note) => note.includes(`: ${event.externalId}.`)) ||
              (packEvent.date === event.date && packEvent.homeTeam === event.homeTeam && packEvent.awayTeam === event.awayTeam)
            );
            return {
              authority: source.authority,
              competition: source.competition,
              season: source.season,
              external_id: event.externalId,
              canonical_id: relevant[0]?.id ?? deterministicId,
              participant_fingerprint: `${event.homeTeamId ?? event.homeTeam}|${event.awayTeamId ?? event.awayTeam}`,
            };
          }).concat(reconciliation.providerMappings.map((mapping) => ({
            authority: "GE",
            competition: source.competition,
            season: source.season,
            external_id: mapping.providerExternalId,
            canonical_id: mapping.canonicalId,
            participant_fingerprint: mapping.participantFingerprint,
          })));
          if (mappings.length > 0) {
            const { error: mappingError } = await admin.from("calendar_pack_external_ids")
              .upsert(mappings, { onConflict: "authority,competition,season,external_id", ignoreDuplicates: true });
            if (mappingError) throw mappingError;
          }
        }
        await admin.from("calendar_pack_sources").update({
          last_checked_at: new Date().toISOString(),
          last_successful_at: issues.length ? source.last_successful_at : new Date().toISOString(),
          last_error: issues.length ? issues.map((issue) => issue.message).join(" ") : null,
        }).eq("id", source.id);
      } catch (error) {
        summary.failed += 1;
        const errorCode = sourceErrorCode(error);
        console.error("[calendar-packs.refresh.source]", {
          sourceId: source.id,
          errorCode,
        });
        await admin.from("calendar_pack_sources").update({
          last_checked_at: new Date().toISOString(), last_error: errorCode,
        }).eq("id", source.id);
        await admin.from("calendar_pack_candidates").insert({
          run_id: run.id, source_id: source.id, base_release_id: published.releaseId,
          material_hash: published.materialHash, payload: [], diff: {},
          validation_issues: [{ code: "invalid_shape", message: errorCode }], status: "failed",
        });
      }
      summary.sources = budget.snapshot();
    }

    await renewCalendarRefresh(run.id, lease.leaseToken);
    const nextHash = materialHash(candidatePacks);
    let releaseId = published.releaseId;
    if (!published.releaseId || nextHash !== published.materialHash) {
      const { data: release, error } = await admin.rpc("publish_calendar_pack_release", {
        p_material_hash: nextHash,
        p_catalog: candidatePacks,
        p_source_run_id: run.id,
        p_release_kind: published.releaseId ? "automatic" : "bootstrap",
        p_published_by: requestedBy ?? null,
      });
      if (error) throw stageError("publication", error);
      releaseId = release as string;
    }
    if (publishableCandidateIds.length > 0) {
      await admin.from("calendar_pack_candidates").update({ status: "published" }).in("id", publishableCandidateIds);
    }

    const status = summary.failed > 0
      ? "partial"
      : summary.quarantined > 0 || summary.unmatched > 0
        ? "quarantined"
        : "succeeded";
    await admin.from("calendar_pack_update_runs").update({
      status,
      finished_at: new Date().toISOString(),
      summary: { ...summary, sources: budget.snapshot() },
    }).eq("id", run.id);
    return { runId: run.id, releaseId, status, summary };
  } catch (error) {
    await admin.from("calendar_pack_update_runs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      summary: { ...summary, sources: budget.snapshot() },
      error: sourceErrorCode(error),
    }).eq("id", run.id);
    throw error;
  } finally {
    try {
      await releaseCalendarRefresh(run.id, lease.leaseToken);
    } catch (releaseError) {
      console.error("[calendar-packs.refresh.release]", {
        runId: run.id,
        errorCode: sourceErrorCode(releaseError),
      });
    }
  }
};
