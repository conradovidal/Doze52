import { expect, test } from "@playwright/test";

import { POST } from "../../app/api/stripe/webhook/route";
import { STRIPE_WEBHOOK_MAX_BODY_BYTES } from "../../lib/stripe-webhook";

const webhookRequest = (body: BodyInit, signature?: string) => {
  const init: RequestInit & { duplex?: "half" } = {
    method: "POST",
    headers: signature ? { "stripe-signature": signature } : undefined,
    body,
  };
  if (body instanceof ReadableStream) init.duplex = "half";
  return new Request("https://doze52.example/api/stripe/webhook", init);
};

test.beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_placeholder";
});

test("mantém 400 quando a assinatura está ausente", async () => {
  expect((await POST(webhookRequest("{}"))).status).toBe(400);
});

test("rejeita com 413 antes da verificação quando o corpo excede 1 MiB", async () => {
  const response = await POST(
    webhookRequest("x".repeat(STRIPE_WEBHOOK_MAX_BODY_BYTES + 1), "invalid")
  );
  expect(response.status).toBe(413);
});

test("corpo dentro do limite continua chegando à verificação Stripe", async () => {
  const response = await POST(webhookRequest("{}", "invalid"));
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({
    error: "Invalid Stripe signature.",
  });
});

test("corpo exatamente no limite continua chegando à verificação Stripe", async () => {
  const response = await POST(
    webhookRequest("x".repeat(STRIPE_WEBHOOK_MAX_BODY_BYTES), "invalid")
  );
  expect(response.status).toBe(400);
});
