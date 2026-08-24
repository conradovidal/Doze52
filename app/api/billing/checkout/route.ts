import { NextResponse } from "next/server";

import {
  BillingCheckoutThrottledError,
  createCheckoutSession,
} from "@/lib/billing";
import { getAuthenticatedServerUser } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getAuthenticatedServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = await createCheckoutSession({
      user,
      requestUrl: request.url,
    });

    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof BillingCheckoutThrottledError) {
      return NextResponse.json(
        { error: "Checkout temporarily unavailable. Please retry shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
        }
      );
    }
    console.error("[billing.checkout]", error);
    return NextResponse.json(
      { error: "Could not create Checkout session." },
      { status: 500 }
    );
  }
}
