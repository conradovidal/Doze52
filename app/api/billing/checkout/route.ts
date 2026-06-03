import { NextResponse } from "next/server";

import { createCheckoutSession } from "@/lib/billing";
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
    console.error("[billing.checkout]", error);
    return NextResponse.json(
      { error: "Could not create Checkout session." },
      { status: 500 }
    );
  }
}
