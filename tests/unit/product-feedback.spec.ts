import { expect, test } from "@playwright/test";
import {
  feedbackProtocol,
  getFeedbackDeviceClass,
  isValidFeedbackMessage,
  normalizeFeedbackContext,
  normalizeFeedbackMessage,
} from "../../lib/product-feedback";

test("valida e normaliza a mensagem", () => {
  expect(normalizeFeedbackMessage("  uma ideia útil  ")).toBe("uma ideia útil");
  expect(isValidFeedbackMessage("curta")).toBe(false);
  expect(isValidFeedbackMessage("x".repeat(10))).toBe(true);
  expect(isValidFeedbackMessage("x".repeat(2001))).toBe(false);
});

test("mantém somente contexto técnico permitido", () => {
  expect(normalizeFeedbackContext({
    route: "/calendario?evento=privado#detalhe",
    deviceClass: "mobile",
    onboardingStep: "date_instruction",
    events: [{ title: "privado" }],
  }, "commit-123")).toEqual({
    route: "/calendario",
    appVersion: "commit-123",
    deviceClass: "mobile",
    onboardingStep: "date_instruction",
  });
});

test("classifica dispositivo e gera protocolo curto", () => {
  expect(getFeedbackDeviceClass(390)).toBe("mobile");
  expect(getFeedbackDeviceClass(800)).toBe("tablet");
  expect(getFeedbackDeviceClass(1440)).toBe("desktop");
  expect(feedbackProtocol("12345678-abcd-ef00-1111-222233334444")).toBe("12345678");
});
