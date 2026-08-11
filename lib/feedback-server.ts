import { getAuthenticatedServerUser, getSupabaseAdminClient } from "@/lib/supabase-server";
import type { FeedbackKind, FeedbackStatus } from "@/lib/product-feedback";

export type FeedbackRow = {
  id: string;
  user_id: string;
  kind: FeedbackKind;
  message: string;
  technical_context: Record<string, unknown>;
  contact_consent: boolean;
  contact_email: string | null;
  status: FeedbackStatus;
  internal_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export const getFeedbackAdminUser = async () => {
  const user = await getAuthenticatedServerUser();
  if (!user) return null;
  const { data, error } = await getSupabaseAdminClient()
    .from("product_feedback_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  return user;
};

export const isSameOriginMutation = (request: Request) => {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return origin === requestUrl.origin &&
    (fetchSite === "same-origin" || fetchSite === "none");
};
