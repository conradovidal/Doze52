import { NextResponse } from "next/server";

import {
  BillingNotFoundError,
  createCustomerPortalSession,
} from "@/lib/billing";
import { getAuthenticatedServerUser } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getAuthenticatedServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = await createCustomerPortalSession({
      userId: user.id,
      requestUrl: request.url,
    });

    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof BillingNotFoundError) {
      return NextResponse.json(
        { error: "No billing customer found." },
        { status: 404 }
      );
    }

    console.error("[billing.portal]", error);
    return NextResponse.json(
      { error: "Could not create Customer Portal session." },
      { status: 500 }
    );
  }
}
