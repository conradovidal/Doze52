import { NextResponse } from "next/server";
import {
  loadProductFeedbackAdminDashboard,
  upsertProductFeedbackItem,
} from "@/lib/product-feedback-server";
import { respondProductFeedbackError } from "@/lib/product-feedback-route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "create" | "update" | "merge_items";
      itemId?: string;
      targetItemId?: string;
      title?: string;
      summary?: string;
      publicNote?: string | null;
      area?: "Calendario" | "Perfis" | "Interface" | "Sincronizacao" | "Geral";
      status?: "backlog" | "in_progress" | "launched" | "archived";
      backlogRank?: number | null;
      startedAt?: string | null;
      launchedAt?: string | null;
      timelineLabel?: string | null;
      highlights?: string[] | string | null;
    };

    await upsertProductFeedbackItem({
      action: body.action ?? "update",
      itemId: body.itemId,
      targetItemId: body.targetItemId,
      title: body.title,
      summary: body.summary,
      publicNote: body.publicNote ?? null,
      area: body.area,
      status: body.status,
      backlogRank:
        typeof body.backlogRank === "number" ? body.backlogRank : null,
      startedAt: body.startedAt ?? null,
      launchedAt: body.launchedAt ?? null,
      timelineLabel: body.timelineLabel ?? null,
      highlights: body.highlights ?? null,
    });

    const dashboard = await loadProductFeedbackAdminDashboard();
    return NextResponse.json(dashboard);
  } catch (error) {
    return respondProductFeedbackError(error);
  }
}
