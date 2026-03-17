import { NextResponse } from "next/server";
import { findProductFeedbackMatches } from "@/lib/product-feedback-server";
import { respondProductFeedbackError } from "@/lib/product-feedback-route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string };
    const matches = await findProductFeedbackMatches(body.text ?? "");
    return NextResponse.json({ matches });
  } catch (error) {
    return respondProductFeedbackError(error);
  }
}
