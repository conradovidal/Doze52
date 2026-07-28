export const ONBOARDING_VERSION = 10;
export const ONBOARDING_REGION_TRACKED_STORAGE_KEY =
  "doze52:onboarding-region:v10";

export const BRAZIL_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type BrazilUf = (typeof BRAZIL_UFS)[number];

const BRAZIL_UF_SET = new Set<string>(BRAZIL_UFS);

export const isBrazilUf = (value: unknown): value is BrazilUf =>
  typeof value === "string" && BRAZIL_UF_SET.has(value);

export const trackOnboardingRegion = async (uf: string) => {
  if (
    typeof window === "undefined" ||
    process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    !isBrazilUf(uf)
  ) {
    return false;
  }

  try {
    if (window.localStorage.getItem(ONBOARDING_REGION_TRACKED_STORAGE_KEY)) {
      return false;
    }

    const response = await fetch("/api/onboarding/region", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uf, onboardingVersion: ONBOARDING_VERSION }),
      keepalive: true,
    });

    if (!response.ok) return false;
    window.localStorage.setItem(
      ONBOARDING_REGION_TRACKED_STORAGE_KEY,
      new Date().toISOString()
    );
    return true;
  } catch {
    return false;
  }
};
