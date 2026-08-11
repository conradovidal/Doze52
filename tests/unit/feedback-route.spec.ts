import { expect, test } from "@playwright/test";
import { POST } from "../../app/api/feedback/route";

const request = (origin = "https://doze52.example") =>
  new Request("https://doze52.example/api/feedback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      "sec-fetch-site": origin === "https://doze52.example" ? "same-origin" : "cross-site",
    },
    body: JSON.stringify({
      kind: "idea",
      message: "Uma mensagem válida",
      contactConsent: false,
      context: { route: "/", deviceClass: "desktop", onboardingStep: null },
    }),
  });

test("recusa mutação de outra origem", async () => {
  expect((await POST(request("https://outro.example"))).status).toBe(403);
});

test("recusa envio sem sessão autenticada", async () => {
  expect((await POST(request())).status).toBe(401);
});
