import { NextResponse } from "next/server";

import {
  getAuthenticatedServerUser,
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthenticatedServerUser();
  if (!user || !hasSupabaseAdminEnv) {
    return NextResponse.json(
      { feedback: false, calendarPacks: false },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const admin = getSupabaseAdminClient();
  // Uma só tabela de operadores vale para o feedback e para os calendários.
  const { data, error } = await admin
    .from("product_feedback_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const isAdmin = !error && Boolean(data);

  return NextResponse.json(
    { feedback: isAdmin, calendarPacks: isAdmin },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
