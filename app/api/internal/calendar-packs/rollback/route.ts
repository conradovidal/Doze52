import { NextResponse } from "next/server";
import { getAuthenticatedServerUser, getSupabaseAdminClient } from "@/lib/supabase-server";
import { isProductAdmin } from "@/lib/calendar-catalog/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  if (request.headers.get("origin") !== requestUrl.origin) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }
  const user = await getAuthenticatedServerUser();
  if (!user || !(await isProductAdmin(user.id))) {
    return NextResponse.json({ error: "Acesso administrativo necessário." }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as { releaseId?: unknown; reason?: unknown } | null;
  if (!body || typeof body.releaseId !== "string" || typeof body.reason !== "string" || body.reason.trim().length < 3) {
    return NextResponse.json({ error: "Release e justificativa são obrigatórios." }, { status: 400 });
  }
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("rollback_calendar_pack_release", {
    p_to_release_id: body.releaseId,
    p_requested_by: user.id,
    p_reason: body.reason.trim(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ currentReleaseId: data });
}
