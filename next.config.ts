import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Identifica o build que o navegador está rodando; /api/version devolve o
    // do deploy atual para a app avisar quando há versão nova.
    NEXT_PUBLIC_APP_BUILD_ID:
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.VERCEL_DEPLOYMENT_ID ??
      "local",
    NEXT_PUBLIC_VERCEL_ENV:
      process.env.VERCEL_ENV ??
      (process.env.NODE_ENV === "development" ? "development" : "production"),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), geolocation=(), microphone=(), payment=(), usb=(), browsing-topics=()",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
