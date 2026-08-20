import { NextResponse } from "next/server";
import { getFeedbackAdminUser, isSameOriginMutation } from "@/lib/feedback-server";
import { isFeedbackStatus } from "@/lib/product-feedback";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }
  const admin = await getFeedbackAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  const note = typeof body.internalNote === "string" ? body.internalNote.trim() : "";
  if (!isFeedbackStatus(body.status) || note.length > 4000) {
    return NextResponse.json({ error: "Atualização inválida." }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("product_feedback_submissions")
    .update({
      status: body.status,
      internal_note: note || null,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "Feedback não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ item: data });
}
