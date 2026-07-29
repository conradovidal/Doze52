import { expect, test } from "@playwright/test";
import { POST } from "../../app/api/onboarding/region/route";
import { ONBOARDING_VERSION } from "../../lib/onboarding-region";

const createRequest = (
  body: unknown,
  headers: Record<string, string> = {}
) =>
  new Request("https://doze52.example/api/onboarding/region", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

const restoreVercelEnv = (value: string | undefined) => {
  if (value === undefined) {
    delete process.env.VERCEL_ENV;
    return;
  }
  process.env.VERCEL_ENV = value;
};

test("métrica regional não executa fora de produção", async () => {
  const previous = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  try {
    const response = await POST(
      createRequest({ uf: "RS", onboardingVersion: ONBOARDING_VERSION })
    );
    expect(response.status).toBe(204);
  } finally {
    restoreVercelEnv(previous);
  }
});

test("métrica regional exige mesma origem e payload exato", async () => {
  const previous = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "production";
  try {
    const crossOrigin = await POST(
      createRequest(
        { uf: "RS", onboardingVersion: ONBOARDING_VERSION },
        { origin: "https://outro.example", "sec-fetch-site": "cross-site" }
      )
    );
    expect(crossOrigin.status).toBe(403);

    const invalidPayload = await POST(
      createRequest(
        {
          uf: "RS",
          onboardingVersion: ONBOARDING_VERSION,
          visitorId: "não permitido",
        },
        {
          origin: "https://doze52.example",
          "sec-fetch-site": "same-origin",
        }
      )
    );
    expect(invalidPayload.status).toBe(400);
  } finally {
    restoreVercelEnv(previous);
  }
});
