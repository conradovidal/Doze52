import { NextResponse } from "next/server";

import { getBillingStatusForUser } from "@/lib/billing";
import { getAuthenticatedServerUser } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthenticatedServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getBillingStatusForUser(user.id);
    return NextResponse.json(status);
  } catch (error) {
    console.error("[billing.status]", error);
    return NextResponse.json(
      { error: "Could not load billing status." },
      { status: 500 }
    );
  }
}
