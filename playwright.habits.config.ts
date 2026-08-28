import { defineConfig, devices } from "@playwright/test";

const mobileProjects = [320, 390, 430].map((width) => ({
  name: `mobile-${width}`,
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  },
}));

const desktopProjects = [768, 1024, 1440].map((width) => ({
  name: `desktop-${width}`,
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width, height: 900 },
  },
}));

export default defineConfig({
  testDir: "./tests/habits-e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3200",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [...mobileProjects, ...desktopProjects],
  webServer: {
    command:
      "NEXT_PUBLIC_FEATURE_HABITS_PROTOTYPE=true VERCEL_ENV=preview NEXT_PUBLIC_APP_ENV=local npx next build --webpack && NEXT_PUBLIC_FEATURE_HABITS_PROTOTYPE=true VERCEL_ENV=preview NEXT_PUBLIC_APP_ENV=local npm run start -- --hostname 127.0.0.1 --port 3200",
    url: "http://127.0.0.1:3200",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
