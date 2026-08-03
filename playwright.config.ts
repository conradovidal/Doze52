import { defineConfig, devices } from "@playwright/test";

import { getQaBaseUrl } from "./tests/e2e/support/qa-env";

const baseURL = getQaBaseUrl();
const authStatePath = "playwright/.auth/e2e.json";
const mobileAuthStatePath = "playwright/.auth/e2e-mobile.json";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "setup-desktop",
      testMatch: /auth\.setup\.ts/,
      testIgnore: /auth\.mobile\.setup\.ts/,
    },
    {
      name: "setup-mobile",
      testMatch: /auth\.mobile\.setup\.ts/,
    },
    {
      name: "desktop-chromium",
      testIgnore: /(auth\.setup|auth\.mobile\.setup|mobile\.smoke\.spec)\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath,
      },
      dependencies: ["setup-desktop"],
    },
    {
      name: "mobile-chromium",
      testMatch: /mobile\.smoke\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
        storageState: mobileAuthStatePath,
      },
      dependencies: ["setup-mobile"],
    },
  ],
});
