import { NextResponse } from "next/server";
import { loadProductFeedbackAdminDashboard } from "@/lib/product-feedback-server";
import { respondProductFeedbackError } from "@/lib/product-feedback-route";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dashboard = await loadProductFeedbackAdminDashboard();
    return NextResponse.json(dashboard, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return respondProductFeedbackError(error);
  }
}
