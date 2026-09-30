import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// O valor é inlinado no build: cada deploy responde com o seu próprio id.
export function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_APP_BUILD_ID ?? "local" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
