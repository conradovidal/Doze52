import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

import {
  billingCheckoutIdempotencyKey,
  createIntegrationIdentifier,
} from "../../lib/billing";

const ATTEMPT_A = "6f71bb42-30b8-4c09-8b32-872fd1a67a48";
const ATTEMPT_B = "e2752dad-f965-4e2c-9eab-d4ddae4ada60";

test("gera chaves de idempotência estáveis e separadas por recurso", () => {
  expect(billingCheckoutIdempotencyKey("customer", ATTEMPT_A)).toBe(
    `doze52_customer_${ATTEMPT_A}`
  );
  expect(billingCheckoutIdempotencyKey("session", ATTEMPT_A)).toBe(
    `doze52_session_${ATTEMPT_A}`
  );
  expect(billingCheckoutIdempotencyKey("session", ATTEMPT_A)).not.toBe(
    billingCheckoutIdempotencyKey("session", ATTEMPT_B)
  );
});

test("gera integration identifier determinístico e válido para o Stripe", () => {
  const first = createIntegrationIdentifier(ATTEMPT_A);

  expect(first).toBe(createIntegrationIdentifier(ATTEMPT_A));
  expect(first).toMatch(/^doze52_[a-z]{8}$/);
  expect(first).not.toBe(createIntegrationIdentifier(ATTEMPT_B));
});

test("migração mantém o controle autoritativo, serializado e privado", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260824181914_harden_billing_checkout_creation.sql"
    ),
    "utf8"
  );

  expect(sql).toContain("for update;");
  expect(sql).toContain("v_guard.attempt_count >= 5");
  expect(sql).toContain("interval '10 minutes'");
  expect(sql).toContain("interval '60 seconds'");
  expect(sql).toContain("interval '2 minutes'");
  expect(sql).toContain("'attemptKey', v_guard.attempt_key");
  expect(sql.match(/security invoker/g)).toHaveLength(3);
  expect(sql).toContain("from public, anon, authenticated");
  expect(sql).toContain("to service_role;");
});
