import { NextResponse } from "next/server";
import {
  loadProductFeedbackSnapshot,
} from "@/lib/product-feedback-server";
import { respondProductFeedbackError } from "@/lib/product-feedback-route";
import { getAuthenticatedServerUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getAuthenticatedServerUser();
    const snapshot = await loadProductFeedbackSnapshot(user?.id ?? null);
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return respondProductFeedbackError(error);
  }
}
