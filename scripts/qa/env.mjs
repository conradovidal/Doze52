const DEV_SUPABASE_PROJECT_REF = "jbdukjmbtffcgklsxjml";
const DEFAULT_ALLOWED_ORIGIN_PATTERN =
  "^https://doze52-[a-z0-9-]+-conrados-projects-843a6c32\\.vercel\\.app$";

export const QA_DEFAULTS = {
  browserEmail: "qa.browser@doze52.test",
  e2eEmail: "qa.e2e@doze52.test",
  projectRef: DEV_SUPABASE_PROJECT_REF,
};

export const requiredEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variavel obrigatoria ausente: ${name}.`);
  return value;
};

const extractSupabaseProjectRef = (rawUrl) => {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("SUPABASE_DEV_URL/NEXT_PUBLIC_SUPABASE_URL invalida.");
  }

  const match = url.hostname.match(/^([a-z0-9]+)\.supabase\.co$/i);
  if (!match) throw new Error("A URL informada nao e de um projeto Supabase hospedado.");
  return { projectRef: match[1], url: url.origin };
};

export const getDevSupabaseConfig = ({ requireServiceRole = false } = {}) => {
  const rawUrl =
    process.env.SUPABASE_DEV_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!rawUrl) {
    throw new Error(
      "Variavel obrigatoria ausente: SUPABASE_DEV_URL ou NEXT_PUBLIC_SUPABASE_URL."
    );
  }

  const expectedRef = requiredEnv("QA_SUPABASE_PROJECT_REF");
  if (expectedRef !== DEV_SUPABASE_PROJECT_REF) {
    throw new Error("QA_SUPABASE_PROJECT_REF nao corresponde ao projeto DEV permitido.");
  }

  const { projectRef, url } = extractSupabaseProjectRef(rawUrl);
  if (projectRef !== DEV_SUPABASE_PROJECT_REF) {
    throw new Error(
      `Operacao recusada: projeto Supabase ${projectRef} nao e o DEV permitido.`
    );
  }

  const anonKey =
    process.env.SUPABASE_DEV_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!anonKey) throw new Error("Chave publica do Supabase DEV ausente.");

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (requireServiceRole && !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente para o provisionamento DEV.");
  }

  return { anonKey, projectRef, serviceRoleKey, url };
};

export const getQaBaseUrl = () => {
  const rawBaseUrl = requiredEnv("QA_BASE_URL");
  let url;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    throw new Error("QA_BASE_URL invalida.");
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error("QA_BASE_URL nao pode conter credenciais, query string ou fragmento.");
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error("QA_BASE_URL deve apontar para a raiz do Preview.");
  }

  const patternSource =
    process.env.QA_ALLOWED_ORIGIN_PATTERN?.trim() || DEFAULT_ALLOWED_ORIGIN_PATTERN;
  let allowedPattern;
  try {
    allowedPattern = new RegExp(patternSource, "i");
  } catch {
    throw new Error("QA_ALLOWED_ORIGIN_PATTERN nao e uma expressao regular valida.");
  }

  if (!allowedPattern.test(url.origin)) {
    throw new Error(`Operacao recusada: ${url.origin} nao e um Preview autorizado.`);
  }
  if (url.hostname === "doze52.com.br" || !url.hostname.endsWith(".vercel.app")) {
    throw new Error("Operacao recusada: o smoke nunca pode executar em producao.");
  }

  return url.origin;
};

export const getQaCredentials = (purpose) => {
  const isBrowser = purpose === "browser-qa";
  const email =
    process.env[isBrowser ? "QA_BROWSER_EMAIL" : "QA_E2E_EMAIL"]?.trim() ||
    (isBrowser ? QA_DEFAULTS.browserEmail : QA_DEFAULTS.e2eEmail);
  const password = requiredEnv(isBrowser ? "QA_BROWSER_PASSWORD" : "QA_E2E_PASSWORD");

  if (password.length < 24) {
    throw new Error("As senhas de QA devem ter pelo menos 24 caracteres.");
  }
  if (!email.endsWith("@doze52.test")) {
    throw new Error("Contas de QA devem usar o dominio reservado @doze52.test.");
  }

  return { email: email.toLowerCase(), password, purpose };
};
