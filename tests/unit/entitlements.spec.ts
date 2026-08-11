import { expect, test } from "@playwright/test";

import {
  FREE_BILLING_STATUS,
  isCalendarSpreadsheetProGateEnabled,
} from "../../lib/entitlements";

test("status gratuito compartilhado não concede benefícios de assinatura", () => {
  expect(FREE_BILLING_STATUS).toEqual({
    plan: "free",
    status: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canManageBilling: false,
  });
});
test("importação por Excel exige Pro apenas em produção", () => {
  expect(
    isCalendarSpreadsheetProGateEnabled({
      nodeEnv: "production",
      deploymentEnv: "production",
    })
  ).toBe(true);
  expect(
    isCalendarSpreadsheetProGateEnabled({
      nodeEnv: "production",
      deploymentEnv: "preview",
    })
  ).toBe(false);
  expect(
    isCalendarSpreadsheetProGateEnabled({ nodeEnv: "development" })
  ).toBe(false);
  expect(
    isCalendarSpreadsheetProGateEnabled({ nodeEnv: "production" })
  ).toBe(true);
});
