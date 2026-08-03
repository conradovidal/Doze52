import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VERCEL_ENV:
      process.env.VERCEL_ENV ??
      (process.env.NODE_ENV === "development" ? "development" : "production"),
  },
};

export default nextConfig;
