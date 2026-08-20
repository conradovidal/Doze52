import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /calendar-spreadsheet\.validation\.spec\.ts/,
  workers: 1,
  retries: 0,
  timeout: 10_000,
  reporter: "list",
});
