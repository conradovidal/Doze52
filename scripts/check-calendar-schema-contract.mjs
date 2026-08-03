const EXPECTED_CONTRACT_VERSION = 1;
const supabaseUrl = (
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_DEV_URL
)?.trim();
const anonKey = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_DEV_ANON_KEY
)?.trim();
const isDeployment = process.env.VERCEL === "1";

if (!supabaseUrl || !anonKey) {
  if (isDeployment) {
    throw new Error(
      "Deploy bloqueado: configuração pública do Supabase ausente para validar o schema."
    );
  }
  console.log("Contrato do calendário não validado fora do ambiente de deploy.");
  process.exit(0);
}

const response = await fetch(
  `${supabaseUrl}/rest/v1/rpc/calendar_sync_contract_version`,
  {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  }
);

if (!response.ok) {
  throw new Error(
    `Deploy bloqueado: Supabase incompatível com a sincronização atômica (${response.status}).`
  );
}

const version = await response.json();
if (version !== EXPECTED_CONTRACT_VERSION) {
  throw new Error(
    `Deploy bloqueado: contrato ${String(version)} recebido; esperado ${EXPECTED_CONTRACT_VERSION}.`
  );
}

console.log(`Contrato do calendário validado: v${version}.`);
