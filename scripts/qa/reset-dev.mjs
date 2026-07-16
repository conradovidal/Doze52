import { createClient } from "@supabase/supabase-js";
import { getDevSupabaseConfig, getQaCredentials } from "./env.mjs";

const config = getDevSupabaseConfig();
const credentials = getQaCredentials("e2e");
const supabase = createClient(config.url, config.anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: signInData, error: signInError } =
  await supabase.auth.signInWithPassword(credentials);
if (signInError) throw signInError;

const user = signInData.user;
if (
  !user ||
  user.email?.toLowerCase() !== credentials.email ||
  user.app_metadata?.environment !== "dev" ||
  user.app_metadata?.purpose !== "e2e"
) {
  throw new Error("Reset recusado: a sessao nao pertence a conta E2E do ambiente DEV.");
}

for (const table of ["events", "categories", "calendar_profiles"]) {
  const { error } = await supabase.from(table).delete().eq("user_id", user.id);
  if (error) throw new Error(`Falha ao limpar ${table}: ${error.message}`);
}

for (const table of ["events", "categories", "calendar_profiles"]) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (error) throw new Error(`Falha ao verificar ${table}: ${error.message}`);
  if (count !== 0) throw new Error(`Reset incompleto: ${table} ainda possui registros.`);
}

await supabase.auth.signOut({ scope: "local" });
console.log(`Dados da conta E2E removidos com RLS no Supabase DEV ${config.projectRef}.`);
