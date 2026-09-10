import { defineConfig } from "@playwright/test";
const baseURL = process.env.CONTINUITY_BASE_URL ?? "http://127.0.0.1:3218";
const host = new URL(baseURL).hostname;
if (!(
  ["127.0.0.1", "localhost"].includes(host) ||
  /^doze52-[a-z0-9]{9}-conrados-projects-843a6c32\.vercel\.app$/.test(host)
)) {
  throw new Error(
    "A suíte de continuidade aceita apenas localhost ou um Preview isolado do Doze52.",
  );
}
export default defineConfig({
  testDir: "./tests/continuity",
  testMatch: "*.spec.ts",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: "list",
  use: {
    baseURL,
    actionTimeout: 15000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
