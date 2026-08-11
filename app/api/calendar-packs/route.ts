import { NextResponse } from "next/server";
import { hasSupabaseAdminEnv } from "@/lib/supabase-server";
import { fallbackCatalog, getPublishedCatalog } from "@/lib/calendar-catalog/repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let catalog = fallbackCatalog();
  if (hasSupabaseAdminEnv) {
    try {
      catalog = (await getPublishedCatalog()) ?? catalog;
    } catch (error) {
      console.error("[calendar-packs.get] using static fallback", error);
    }
  }

  const etag = `"${catalog.materialHash}"`;
  const headers = {
    ETag: etag,
    "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=3600",
  };
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  return NextResponse.json(catalog, { headers });
}
