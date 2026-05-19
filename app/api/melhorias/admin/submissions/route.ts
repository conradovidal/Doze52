import { NextResponse } from "next/server";
import {
  loadProductFeedbackAdminDashboard,
  moderateProductFeedbackSubmission,
} from "@/lib/product-feedback-server";
import { respondProductFeedbackError } from "@/lib/product-feedback-route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      submissionId?: string;
      action?: "merge" | "promote" | "reject";
      targetItemId?: string | null;
      title?: string;
      summary?: string;
      publicNote?: string | null;
      area?: "Calendario" | "Perfis" | "Interface" | "Sincronizacao" | "Geral";
      status?: "backlog" | "in_progress" | "launched" | "archived";
      highlights?: string[] | string | null;
    };

    await moderateProductFeedbackSubmission({
      submissionId: body.submissionId ?? "",
      action: body.action ?? "reject",
      targetItemId: body.targetItemId ?? null,
      title: body.title,
      summary: body.summary,
      publicNote: body.publicNote ?? null,
      area: body.area,
      status: body.status,
      highlights: body.highlights ?? null,
    });

    const dashboard = await loadProductFeedbackAdminDashboard();
    return NextResponse.json(dashboard);
  } catch (error) {
    return respondProductFeedbackError(error);
  }
}
