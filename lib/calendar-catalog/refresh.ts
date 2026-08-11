import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import type { CalendarPack } from "@/lib/calendar-packs/types";
import { applyOfficialSourceToCatalog } from "./catalog-builder";
import { canonicalEventId } from "./catalog-builder";
import { diffCatalogs, materialHash } from "./material";
import { parseOfficialSource } from "./parsers";
import { fallbackCatalog, getPublishedCatalog, listRunnableSources } from "./repository";
import type { OfficialCalendarEvent } from "./types";
import { validateOfficialCandidate } from "./validation";

export type RefreshTrigger = "scheduled_midnight" | "scheduled_closing" | "manual";

export const refreshCalendarCatalog = async ({
  trigger,
  requestedBy,
}: {
  trigger: RefreshTrigger;
  requestedBy?: string;
}) => {
  const admin = getSupabaseAdminClient();
  const { data: run, error: runError } = await admin
    .from("calendar_pack_update_runs")
    .insert({ trigger_kind: trigger, requested_by: requestedBy ?? null, publish_enabled: true })
    .select("id")
    .single();
  if (runError) throw runError;

  const published = (await getPublishedCatalog()) ?? fallbackCatalog();
  let candidatePacks: CalendarPack[] = published.packs;
  const sources = await listRunnableSources();
  const summary = { checked: 0, unchanged: 0, shadow: 0, publishable: 0, quarantined: 0, failed: 0 };
  const publishableCandidateIds: string[] = [];

  try {
    for (const source of sources) {
      summary.checked += 1;
      try {
        const response = await fetch(source.official_url, {
          headers: { "user-agent": "Doze52-Calendar-Updater/1.0 (+https://doze52.com)" },
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.text();
        const events = parseOfficialSource(body, response.headers.get("content-type") ?? "", source);

        const { data: previousCandidate } = await admin
          .from("calendar_pack_candidates")
          .select("payload")
          .eq("source_id", source.id)
          .in("status", ["shadow", "publishable", "published", "unchanged"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const previousEvents = (previousCandidate?.payload ?? []) as OfficialCalendarEvent[];
        const issues = validateOfficialCandidate({ previous: previousEvents, candidate: events });
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
            payload: events,
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
          });
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
        const message = error instanceof Error ? error.message : "Falha desconhecida";
        await admin.from("calendar_pack_sources").update({
          last_checked_at: new Date().toISOString(), last_error: message,
        }).eq("id", source.id);
        await admin.from("calendar_pack_candidates").insert({
          run_id: run.id, source_id: source.id, base_release_id: published.releaseId,
          material_hash: published.materialHash, payload: [], diff: {},
          validation_issues: [{ code: "invalid_shape", message }], status: "failed",
        });
      }
    }

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
      if (error) throw error;
      releaseId = release as string;
    }
    if (publishableCandidateIds.length > 0) {
      await admin.from("calendar_pack_candidates").update({ status: "published" }).in("id", publishableCandidateIds);
    }

    const status = summary.failed > 0 ? "partial" : summary.quarantined > 0 ? "quarantined" : "succeeded";
    await admin.from("calendar_pack_update_runs").update({
      status, finished_at: new Date().toISOString(), summary,
    }).eq("id", run.id);
    return { runId: run.id, releaseId, status, summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida";
    await admin.from("calendar_pack_update_runs").update({
      status: "failed", finished_at: new Date().toISOString(), summary, error: message,
    }).eq("id", run.id);
    throw error;
  }
};
