"use client";

type AppEnv = "local" | "dev" | "prod" | "unknown";

const resolveAppEnv = (): AppEnv => {
  const value = process.env.NEXT_PUBLIC_APP_ENV;
  if (value === "local" || value === "dev" || value === "prod") return value;
  return "unknown";
};

export function EnvBadge() {
  const appEnv = resolveAppEnv();
  const showInProd = process.env.NEXT_PUBLIC_SHOW_ENV_BADGE === "true";
  const shouldShow = appEnv === "prod" ? showInProd : true;

  if (!shouldShow) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-3 left-3 z-50 select-none rounded-md border border-neutral-300/70 bg-neutral-100/80 px-2 py-1 text-[10px] uppercase tracking-wide text-neutral-600"
      aria-hidden="true"
    >
      env: {appEnv}
    </div>
  );
}
