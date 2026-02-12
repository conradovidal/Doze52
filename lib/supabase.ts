import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export const supabaseEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

export const hasSupabaseEnv = Boolean(supabaseEnv.url && supabaseEnv.anonKey);

let browserClient: SupabaseClient | null = null;
let didLogSupabaseEnv = false;

export const getSupabaseBrowserClient = () => {
  if (!hasSupabaseEnv) {
    throw new Error(
      "Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  if (!browserClient) {
    if (process.env.NODE_ENV !== "production" && !didLogSupabaseEnv) {
      console.log("[supabase]", process.env.NEXT_PUBLIC_SUPABASE_URL);
      didLogSupabaseEnv = true;
    }
    browserClient = createBrowserClient(supabaseEnv.url, supabaseEnv.anonKey);
  }
  return browserClient;
};
