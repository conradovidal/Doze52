import { createClient } from "@supabase/supabase-js";
import {
  getDevSupabaseConfig,
  getQaCredentials,
} from "./env.mjs";

const config = getDevSupabaseConfig({ requireServiceRole: true });
const accounts = [getQaCredentials("browser-qa"), getQaCredentials("e2e")];
const admin = createClient(config.url, config.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const findUserByEmail = async (email) => {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase()
    );
    if (user) return user;
    if (data.users.length < 100) return null;
  }
  throw new Error("Limite de paginacao atingido ao procurar contas de QA.");
};

const provisionAccount = async ({ email, password, purpose }) => {
  const metadata = { environment: "dev", purpose };
  const existing = await findUserByEmail(email);

  if (existing) {
    const existingMetadata = existing.app_metadata ?? {};
    if (
      existingMetadata.environment !== metadata.environment ||
      existingMetadata.purpose !== metadata.purpose
    ) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, {
        app_metadata: { ...existingMetadata, ...metadata },
      });
      if (error) throw error;
    }
    return { created: false, id: existing.id, purpose };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: metadata,
  });
  if (error) throw error;
  if (!data.user) throw new Error(`Supabase nao retornou o usuario ${purpose}.`);
  return { created: true, id: data.user.id, purpose };
};

const provisioned = [];
for (const account of accounts) {
  provisioned.push(await provisionAccount(account));
}

const e2eUser = provisioned.find((account) => account.purpose === "e2e");
if (!e2eUser) throw new Error("Conta E2E nao provisionada.");

const proUntil = new Date();
proUntil.setUTCFullYear(proUntil.getUTCFullYear() + 5);
const { error: billingError } = await admin.from("billing_subscriptions").upsert(
  {
    user_id: e2eUser.id,
    stripe_customer_id: `qa_dev_customer_${e2eUser.id}`,
    stripe_subscription_id: `qa_dev_subscription_${e2eUser.id}`,
    stripe_price_id: "qa_dev_pro",
    status: "trialing",
    current_period_end: proUntil.toISOString(),
    cancel_at_period_end: false,
  },
  { onConflict: "user_id" }
);
if (billingError) throw billingError;

for (const account of provisioned) {
  console.log(`${account.purpose}: ${account.created ? "criada" : "ja existente"}.`);
}
console.log(`Supabase DEV confirmado: ${config.projectRef}.`);
console.log("Conta E2E configurada como Pro de QA sem cliente Stripe.");
