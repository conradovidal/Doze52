import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { refreshCalendarCatalog, type RefreshTrigger } from "@/lib/calendar-catalog/refresh";
import { isProductAdmin } from "@/lib/calendar-catalog/repository";
import { getAuthenticatedServerUser, hasSupabaseAdminEnv } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 300;

const sameSecret = (received: string, expected: string) => {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
};

export async function POST(request: Request) {
  if (!hasSupabaseAdminEnv) {
    return NextResponse.json({ error: "Catálogo dinâmico não configurado." }, { status: 503 });
  }

  const expected = process.env.CALENDAR_PACK_REFRESH_SECRET ?? "";
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const cronAuthorized = Boolean(expected && bearer && sameSecret(bearer, expected));
  let requestedBy: string | undefined;
  let trigger: RefreshTrigger = request.headers.get("x-calendar-refresh-slot") === "closing"
    ? "scheduled_closing" : "scheduled_midnight";

  if (!cronAuthorized) {
    const requestUrl = new URL(request.url);
    if (request.headers.get("origin") !== requestUrl.origin) {
      return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    }
    const user = await getAuthenticatedServerUser();
    if (!user || !(await isProductAdmin(user.id))) {
      return NextResponse.json({ error: "Acesso administrativo necessário." }, { status: 403 });
    }
    requestedBy = user.id;
    trigger = "manual";
  }

  try {
    const result = await refreshCalendarCatalog({ trigger, requestedBy });
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    console.error("[calendar-packs.refresh]", error);
    return NextResponse.json({ error: "A atualização falhou e o último release foi preservado." }, { status: 500 });
  }
}
