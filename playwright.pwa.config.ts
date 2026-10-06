import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/pwa-e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3201",
  },
  projects: [
    {
      name: "desktop",
      grepInvert: /@mobile/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      grepInvert: /@desktop/,
      use: { ...devices["iPhone 14"], browserName: "chromium" },
    },
  ],
  webServer: {
    command:
      "VERCEL_ENV=preview NEXT_PUBLIC_APP_ENV=local npx next build --webpack && VERCEL_ENV=preview NEXT_PUBLIC_APP_ENV=local npm run start -- --hostname 127.0.0.1 --port 3201",
    url: "http://127.0.0.1:3201",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
