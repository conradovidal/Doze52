import { NextResponse } from "next/server";

import { processStripeWebhookEvent } from "@/lib/billing";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      getStripeWebhookSecret()
    );
  } catch (error) {
    console.error("[stripe.webhook.verify]", error);
    return NextResponse.json(
      { error: "Invalid Stripe signature." },
      { status: 400 }
    );
  }

  try {
    const result = await processStripeWebhookEvent(event);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error("[stripe.webhook.process]", error);
    return NextResponse.json(
      { error: "Could not process Stripe webhook." },
      { status: 500 }
    );
  }
}
