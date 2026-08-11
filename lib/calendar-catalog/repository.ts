import "server-only";
import { calendarPacks } from "@/lib/calendar-packs";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import type { CalendarPack } from "@/lib/calendar-packs/types";
import type { CalendarCatalog, CalendarCatalogSource } from "./types";
import { materialHash } from "./material";

export const fallbackCatalog = (): CalendarCatalog => ({
  schemaVersion: 1,
  releaseId: null,
  version: 0,
  publishedAt: null,
  materialHash: materialHash(calendarPacks),
  packs: [...calendarPacks] as CalendarPack[],
});

export const getPublishedCatalog = async (): Promise<CalendarCatalog | null> => {
  const admin = getSupabaseAdminClient();
  const { data: state, error: stateError } = await admin
    .from("calendar_pack_catalog_state")
    .select("current_release_id")
    .eq("singleton", true)
    .maybeSingle();
  if (stateError) throw stateError;
  if (!state?.current_release_id) return null;

  const { data, error } = await admin
    .from("calendar_pack_releases")
    .select("id, version, material_hash, catalog, published_at")
    .eq("id", state.current_release_id)
    .single();
  if (error) throw error;
  return {
    schemaVersion: 1,
    releaseId: data.id,
    version: Number(data.version),
    publishedAt: data.published_at,
    materialHash: data.material_hash,
    packs: data.catalog as CalendarPack[],
  };
};

export const listRunnableSources = async () => {
  const { data, error } = await getSupabaseAdminClient()
    .from("calendar_pack_sources")
    .select("*")
    .in("rollout_status", ["shadow", "active"])
    .order("id");
  if (error) throw error;
  return data as CalendarCatalogSource[];
};

export const isProductAdmin = async (userId: string) => {
  const { data, error } = await getSupabaseAdminClient()
    .from("product_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
};
