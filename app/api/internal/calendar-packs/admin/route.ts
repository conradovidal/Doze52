import { NextResponse } from "next/server";
import { getSupabaseAdminClient, getAuthenticatedServerUser } from "@/lib/supabase-server";
import { isProductAdmin } from "@/lib/calendar-catalog/repository";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthenticatedServerUser();
  if (!user || !(await isProductAdmin(user.id))) {
    return NextResponse.json({ error: "Acesso administrativo necessário." }, { status: 403 });
  }
  const admin = getSupabaseAdminClient();
  const [sources, runs, releases, candidates, state] = await Promise.all([
    admin.from("calendar_pack_sources").select("*").order("id"),
    admin.from("calendar_pack_update_runs").select("*").order("started_at", { ascending: false }).limit(30),
    admin.from("calendar_pack_releases").select("id, version, material_hash, release_kind, published_at").order("published_at", { ascending: false }).limit(20),
    admin.from("calendar_pack_candidates").select("id, run_id, source_id, diff, validation_issues, status, created_at").order("created_at", { ascending: false }).limit(60),
    admin.from("calendar_pack_catalog_state").select("current_release_id").eq("singleton", true).single(),
  ]);
  const error = [sources, runs, releases, candidates, state].find((result) => result.error)?.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    sources: sources.data, runs: runs.data, releases: releases.data,
    candidates: candidates.data, currentReleaseId: state.data?.current_release_id ?? null,
  });
}
