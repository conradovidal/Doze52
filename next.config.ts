import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // TEMP(onboarding-v2): remove this test control before merging into production.
    NEXT_PUBLIC_ONBOARDING_TEST_CONTROLS:
      process.env.NODE_ENV === "development" ||
      process.env.VERCEL_GIT_COMMIT_REF ===
        "codex/onboarding-v2-validation"
        ? "1"
        : "0",
  },
};

export default nextConfig;
