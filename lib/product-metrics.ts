"use client";

import { getTodayIsoInTimeZone } from "@/lib/date";
import type { GuidedOnboardingState } from "@/lib/onboarding";
import { logDevError, logProdError } from "@/lib/safe-log";
import { getSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase";

export type FirstTouchAttribution = Partial<{
  source: string;
  medium: string;
  campaign: string;
  content: string;
}>;

const FIRST_TOUCH_STORAGE_KEY = "doze52:first-touch:v1";
const MAX_ATTRIBUTION_LENGTH = 120;
const METRICS_TIME_ZONE = "America/Sao_Paulo";

const cleanAttributionValue = (value: string | null) => {
  const cleaned = value?.trim().slice(0, MAX_ATTRIBUTION_LENGTH);
  return cleaned || undefined;
};

export const attributionFromSearchParams = (
  params: URLSearchParams
): FirstTouchAttribution => ({
  source: cleanAttributionValue(params.get("utm_source")),
  medium: cleanAttributionValue(params.get("utm_medium")),
  campaign: cleanAttributionValue(params.get("utm_campaign")),
  content: cleanAttributionValue(params.get("utm_content")),
});

export const captureFirstTouchAttribution = () => {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(FIRST_TOUCH_STORAGE_KEY)) return;
    const attribution = attributionFromSearchParams(
      new URLSearchParams(window.location.search)
    );
    if (Object.values(attribution).every((value) => !value)) return;
    window.localStorage.setItem(
      FIRST_TOUCH_STORAGE_KEY,
      JSON.stringify(attribution)
    );
  } catch {
    // Attribution is optional and must never block the product.
  }
};

export const readFirstTouchAttribution = (): FirstTouchAttribution => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FIRST_TOUCH_STORAGE_KEY);
    if (!raw) return {};
    const value = JSON.parse(raw) as Record<string, unknown>;
    return {
      source: cleanAttributionValue(
        typeof value.source === "string" ? value.source : null
      ),
      medium: cleanAttributionValue(
        typeof value.medium === "string" ? value.medium : null
      ),
      campaign: cleanAttributionValue(
        typeof value.campaign === "string" ? value.campaign : null
      ),
      content: cleanAttributionValue(
        typeof value.content === "string" ? value.content : null
      ),
    };
  } catch {
    return {};
  }
};

export const toFunnelUpsertPayload = (
  userId: string,
  state: GuidedOnboardingState,
  attribution: FirstTouchAttribution
) => {
  const payload: Record<string, string> = { user_id: userId };
  if (state.context) payload.planning_context = state.context;
  if (state.startedAt) payload.onboarding_started_at = state.startedAt;
  if (state.profileConfiguredAt) {
    payload.profile_configured_at = state.profileConfiguredAt;
  }
  if (state.firstDateCreatedAt) {
    payload.first_point_event_at = state.firstDateCreatedAt;
  }
  if (state.firstPeriodCreatedAt) {
    payload.first_period_at = state.firstPeriodCreatedAt;
  }
  if (state.completedAt) payload.onboarding_completed_at = state.completedAt;
  if (attribution.source) payload.first_touch_source = attribution.source;
  if (attribution.medium) payload.first_touch_medium = attribution.medium;
  if (attribution.campaign) payload.first_touch_campaign = attribution.campaign;
  if (attribution.content) payload.first_touch_content = attribution.content;
  return payload;
};

const reportMetricsFailure = (context: string, error: unknown) => {
  logDevError(context, error instanceof Error ? error.message : String(error));
  logProdError("Falha ao registrar métrica agregada do produto.");
};

export const syncProductFunnelState = async (
  userId: string,
  state: GuidedOnboardingState
) => {
  if (!hasSupabaseEnv) return;
  try {
    const supabase = getSupabaseBrowserClient();
    const payload = toFunnelUpsertPayload(
      userId,
      state,
      readFirstTouchAttribution()
    );
    const { error } = await supabase
      .from("product_funnel_state")
      .upsert(payload, { onConflict: "user_id" });
    if (error) throw error;
  } catch (error) {
    reportMetricsFailure("product-metrics.funnel", error);
  }
};

export const recordProductActivityDay = async (userId: string) => {
  if (!hasSupabaseEnv) return;
  try {
    const supabase = getSupabaseBrowserClient();
    const activityDate = getTodayIsoInTimeZone(METRICS_TIME_ZONE);
    const { error } = await supabase.from("product_activity_days").upsert(
      { user_id: userId, activity_date: activityDate },
      { onConflict: "user_id,activity_date", ignoreDuplicates: true }
    );
    if (error) throw error;
  } catch (error) {
    reportMetricsFailure("product-metrics.activity", error);
  }
};
