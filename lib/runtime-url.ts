const FALLBACK_LOCAL_URL = "http://localhost:3000";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export function getAppBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return trimTrailingSlash(window.location.origin);
  }

  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return trimTrailingSlash(envUrl.trim());
  }

  return FALLBACK_LOCAL_URL;
}

