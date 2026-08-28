import { expect, test } from "@playwright/test";

import { isTemporalFocusPreviewAvailable } from "../../lib/feature-flags";

test("prévia de foco temporal exige flag explícita", () => {
  expect(
    isTemporalFocusPreviewAvailable({
      nodeEnv: "development",
      appEnv: "local",
    })
  ).toBe(false);
});

test("prévia de foco temporal pode ser ativada em local, DEV e Preview", () => {
  expect(
    isTemporalFocusPreviewAvailable({
      flag: "true",
      nodeEnv: "development",
    })
  ).toBe(true);
  expect(
    isTemporalFocusPreviewAvailable({
      flag: "true",
      nodeEnv: "production",
      appEnv: "dev",
    })
  ).toBe(true);
  expect(
    isTemporalFocusPreviewAvailable({
      flag: "true",
      nodeEnv: "production",
      deploymentEnv: "preview",
    })
  ).toBe(true);
});

test("prévia de foco temporal permanece desativada em produção", () => {
  expect(
    isTemporalFocusPreviewAvailable({
      flag: "true",
      nodeEnv: "production",
      appEnv: "dev",
      deploymentEnv: "production",
    })
  ).toBe(false);
});
