import { NextResponse } from "next/server";
import {
  createProductFeedbackSubmission,
  loadProductFeedbackSnapshot,
} from "@/lib/product-feedback-server";
import { respondProductFeedbackError } from "@/lib/product-feedback-route";
import { getAuthenticatedServerUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      rawText?: string;
      proposedArea?: string | null;
      matchedItemId?: string | null;
      castVote?: boolean;
      replaceVoteItemId?: string | null;
      honeypot?: string | null;
    };

    const result = await createProductFeedbackSubmission({
      rawText: body.rawText ?? "",
      proposedArea: (body.proposedArea ?? null) as
        | "Calendario"
        | "Perfis"
        | "Interface"
        | "Sincronizacao"
        | "Geral"
        | null,
      matchedItemId: body.matchedItemId ?? null,
      castVote: body.castVote ?? false,
      replaceVoteItemId: body.replaceVoteItemId ?? null,
      honeypot: body.honeypot ?? null,
    });

    const user = await getAuthenticatedServerUser();
    const snapshot = await loadProductFeedbackSnapshot(user?.id ?? null);

    return NextResponse.json({
      submission: result.submission,
      voteResult: result.voteResult,
      snapshot,
    });
  } catch (error) {
    return respondProductFeedbackError(error);
  }
}
