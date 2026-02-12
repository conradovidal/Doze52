const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function sanitizeSiteUrl(url?: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function isLocalOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname;
    return LOCAL_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

const shouldAvoidLocalOrigin = () => {
  const vercelEnv = process.env.VERCEL_ENV;
  return vercelEnv === "preview" || vercelEnv === "production";
};

const withRuntimeGuard = (origin: string): string => {
  const fallbackOrigin = sanitizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (!fallbackOrigin) return origin;
  if (!shouldAvoidLocalOrigin()) return origin;
  if (!isLocalOrigin(origin)) return origin;
  if (isLocalOrigin(fallbackOrigin)) return origin;

  if (process.env.NODE_ENV !== "production") {
    console.warn("[origin] switched local origin to NEXT_PUBLIC_SITE_URL", {
      origin,
      fallbackOrigin,
    });
  }

  return fallbackOrigin;
};

export function getClientOrigin(): string {
  if (typeof window !== "undefined") {
    return withRuntimeGuard(window.location.origin);
  }

  const fromEnv = sanitizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (fromEnv) return withRuntimeGuard(fromEnv);
  return "http://localhost:3000";
}

export function getServerOriginFromHeaders(
  requestHeaders: Headers,
  requestUrl?: string
): string {
  const forwardedProto = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const forwardedHost = requestHeaders
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();

  if (forwardedHost) {
    const protocol =
      forwardedProto ||
      (LOCAL_HOSTS.has(forwardedHost.split(":")[0] ?? "") ? "http" : "https");
    return withRuntimeGuard(`${protocol}://${forwardedHost}`);
  }

  const host = requestHeaders.get("host")?.trim();
  if (host) {
    const protocol =
      forwardedProto || (LOCAL_HOSTS.has(host.split(":")[0] ?? "") ? "http" : "https");
    return withRuntimeGuard(`${protocol}://${host}`);
  }

  const fromRequest = sanitizeSiteUrl(requestUrl);
  if (fromRequest) return withRuntimeGuard(fromRequest);

  const fromEnv = sanitizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (fromEnv) return withRuntimeGuard(fromEnv);

  return "http://localhost:3000";
}
