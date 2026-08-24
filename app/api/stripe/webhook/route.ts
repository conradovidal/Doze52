import { NextResponse } from "next/server";

import { processStripeWebhookEvent } from "@/lib/billing";
import { PayloadTooLargeError, readLimitedText } from "@/lib/http-json";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import { STRIPE_WEBHOOK_MAX_BODY_BYTES } from "@/lib/stripe-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  let payload: string;
  try {
    payload = await readLimitedText(request, STRIPE_WEBHOOK_MAX_BODY_BYTES);
  } catch (error) {
    if (!(error instanceof PayloadTooLargeError)) throw error;
    return NextResponse.json(
      { error: "Stripe webhook payload is too large." },
      { status: 413 }
    );
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret()
    );
  } catch {
    console.warn("[stripe.webhook.verify]", { result: "invalid_signature" });
    return NextResponse.json(
      { error: "Invalid Stripe signature." },
      { status: 400 }
    );
  }

  try {
    const result = await processStripeWebhookEvent(event);
    console.info("[stripe.webhook.result]", {
      eventId: event.id,
      eventType: event.type,
      eventCreatedAt: new Date(event.created * 1000).toISOString(),
      result: result.duplicate ? "duplicate" : "processed",
      attemptCount: result.attemptCount,
    });
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error("[stripe.webhook.process]", {
      eventId: event.id,
      eventType: event.type,
      eventCreatedAt: new Date(event.created * 1000).toISOString(),
      result: "failed",
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "Could not process Stripe webhook." },
      { status: 500 }
    );
  }
}
