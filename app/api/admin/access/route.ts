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
  const [feedbackResult, calendarPacksResult] = await Promise.all([
    admin
      .from("product_feedback_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("product_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return NextResponse.json(
    {
      feedback: !feedbackResult.error && Boolean(feedbackResult.data),
      calendarPacks:
        !calendarPacksResult.error && Boolean(calendarPacksResult.data),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
