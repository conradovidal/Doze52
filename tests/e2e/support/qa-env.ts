const DEV_SUPABASE_PROJECT_REF = "jbdukjmbtffcgklsxjml";
const DEFAULT_ALLOWED_ORIGIN_PATTERN =
  "^https://doze52-[a-z0-9-]+-conrados-projects-843a6c32\\.vercel\\.app$";

const requiredEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variavel obrigatoria ausente: ${name}.`);
  return value;
};

export const getQaBaseUrl = () => {
  const url = new URL(requiredEnv("QA_BASE_URL"));
  const pattern = new RegExp(
    process.env.QA_ALLOWED_ORIGIN_PATTERN?.trim() || DEFAULT_ALLOWED_ORIGIN_PATTERN,
    "i"
  );

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error("QA_BASE_URL deve ser uma origem limpa apontando para a raiz.");
  }
  if (!pattern.test(url.origin)) {
    throw new Error(`Operacao recusada: ${url.origin} nao e um Preview autorizado.`);
  }
  if (url.hostname === "doze52.com.br" || !url.hostname.endsWith(".vercel.app")) {
    throw new Error("Operacao recusada: o smoke nunca pode executar em producao.");
  }
  return url.origin;
};

export const getE2eCredentials = () => {
  const email = requiredEnv("QA_E2E_EMAIL").toLowerCase();
  const password = requiredEnv("QA_E2E_PASSWORD");
  const projectRef = requiredEnv("QA_SUPABASE_PROJECT_REF");

  if (projectRef !== DEV_SUPABASE_PROJECT_REF) {
    throw new Error("QA_SUPABASE_PROJECT_REF nao corresponde ao DEV permitido.");
  }
  if (!email.endsWith("@doze52.test") || password.length < 24) {
    throw new Error("Credenciais E2E fora do padrao seguro esperado.");
  }
  return { email, password };
};
