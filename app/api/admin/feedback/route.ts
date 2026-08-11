import { NextResponse } from "next/server";
import { getFeedbackAdminUser } from "@/lib/feedback-server";
import { isFeedbackKind, isFeedbackStatus } from "@/lib/product-feedback";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await getFeedbackAdminUser())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const kind = params.get("kind");
  const period = params.get("period");
  const cursor = params.get("cursor");
  const limit = 25;

  let query = getSupabaseAdminClient()
    .from("product_feedback_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  if (status && isFeedbackStatus(status)) query = query.eq("status", status);
  if (kind && isFeedbackKind(kind)) query = query.eq("kind", kind);
  if (cursor) query = query.lt("created_at", cursor);
  if (period === "7d") {
    query = query.gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
  } else if (period === "30d") {
    query = query.gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());
  }

  const { data, error } = await query;
  if (error) {
    console.error("[feedback.admin.list]", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Não foi possível carregar a fila." }, { status: 500 });
  }
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return NextResponse.json({
    items,
    nextCursor: hasMore ? items.at(-1)?.created_at ?? null : null,
  });
}
