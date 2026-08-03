import { expect, test } from "@playwright/test";

import { FREE_BILLING_STATUS } from "../../lib/entitlements";

test("status gratuito compartilhado não concede benefícios de assinatura", () => {
  expect(FREE_BILLING_STATUS).toEqual({
    plan: "free",
    status: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canManageBilling: false,
  });
});
