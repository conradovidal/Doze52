import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /calendar-catalog\.dynamic\.spec\.ts/,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3100" },
  webServer: {
    command: "npm start -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
