import { NextResponse } from "next/server";
import { isBrazilUf, ONBOARDING_VERSION } from "@/lib/onboarding-region";
import {
  InvalidJsonPayloadError,
  PayloadTooLargeError,
  readLimitedJsonObject,
} from "@/lib/http-json";
import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== "production") {
    return new NextResponse(null, { status: 204 });
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin !== requestUrl.origin || fetchSite !== "same-origin") {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await readLimitedJsonObject(request, 256);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: "Payload muito grande." }, { status: 413 });
    }
    if (!(error instanceof InvalidJsonPayloadError)) throw error;
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const keys = Object.keys(body);
  if (
    keys.length !== 2 ||
    !keys.includes("uf") ||
    !keys.includes("onboardingVersion") ||
    !isBrazilUf(body.uf) ||
    body.onboardingVersion !== ONBOARDING_VERSION
  ) {
    return NextResponse.json({ error: "UF ou versão inválida." }, { status: 400 });
  }

  if (!hasSupabaseAdminEnv) {
    return NextResponse.json(
      { error: "Métrica regional indisponível." },
      { status: 503 }
    );
  }

  const { error } = await getSupabaseAdminClient().rpc(
    "increment_onboarding_region_total",
    {
      p_onboarding_version: ONBOARDING_VERSION,
      p_uf: body.uf,
    }
  );

  if (error) {
    return NextResponse.json(
      { error: "Não foi possível registrar a região." },
      { status: 500 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
