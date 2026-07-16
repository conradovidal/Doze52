import { getDevSupabaseConfig, getQaBaseUrl } from "./env.mjs";

const baseUrl = getQaBaseUrl();
const supabase = getDevSupabaseConfig();

console.log("Configuracao de QA validada.");
console.log(`Preview: ${new URL(baseUrl).hostname}`);
console.log(`Supabase DEV: ${supabase.projectRef}`);
