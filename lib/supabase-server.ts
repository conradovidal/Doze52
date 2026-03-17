import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const hasSupabaseServerEnv = Boolean(supabaseUrl && supabaseAnonKey);
export const hasSupabaseAdminEnv = Boolean(
  supabaseUrl && supabaseServiceRoleKey
);

let adminClient: SupabaseClient | null = null;

export const getSupabaseServerClient = async () => {
  if (!hasSupabaseServerEnv) {
    throw new Error(
      "Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Route/page reads still work without mutating cookies.
        }
      },
    },
  }) as SupabaseClient;
};

export const getSupabaseAdminClient = () => {
  if (!hasSupabaseAdminEnv) {
    throw new Error(
      "Supabase admin nao configurado. Defina SUPABASE_SERVICE_ROLE_KEY neste ambiente."
    );
  }
  if (!adminClient) {
    adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminClient;
};

export const getAuthenticatedServerUser = async () => {
  if (!hasSupabaseServerEnv) return null;
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
};
