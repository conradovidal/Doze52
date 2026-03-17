import { NextResponse } from "next/server";
import { mutateProductFeedbackVote } from "@/lib/product-feedback-server";
import { respondProductFeedbackError } from "@/lib/product-feedback-route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      itemId?: string;
      replaceItemId?: string | null;
    };

    const result = await mutateProductFeedbackVote({
      itemId: body.itemId ?? "",
      replaceItemId: body.replaceItemId ?? null,
    });

    return NextResponse.json(result);
  } catch (error) {
    return respondProductFeedbackError(error);
  }
}
