export const FEEDBACK_KINDS = ["idea", "problem", "other"] as const;
export const FEEDBACK_STATUSES = ["new", "reviewing", "closed"] as const;

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export type FeedbackDeviceClass = "mobile" | "tablet" | "desktop";

export type FeedbackTechnicalContext = {
  route: string;
  appVersion: string;
  deviceClass: FeedbackDeviceClass;
  onboardingStep: string | null;
};

export type FeedbackSubmissionInput = {
  kind: FeedbackKind;
  message: string;
  contactConsent: boolean;
  context: Omit<FeedbackTechnicalContext, "appVersion">;
};

export const feedbackKindLabels: Record<FeedbackKind, string> = {
  idea: "Ideia",
  problem: "Problema",
  other: "Outro",
};

export const feedbackStatusLabels: Record<FeedbackStatus, string> = {
  new: "Novo",
  reviewing: "Em análise",
  closed: "Encerrado",
};

export const isFeedbackKind = (value: unknown): value is FeedbackKind =>
  typeof value === "string" && FEEDBACK_KINDS.includes(value as FeedbackKind);

export const isFeedbackStatus = (value: unknown): value is FeedbackStatus =>
  typeof value === "string" &&
  FEEDBACK_STATUSES.includes(value as FeedbackStatus);

export const normalizeFeedbackMessage = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const isValidFeedbackMessage = (value: string) =>
  value.length >= 10 && value.length <= 2000;

const isDeviceClass = (value: unknown): value is FeedbackDeviceClass =>
  value === "mobile" || value === "tablet" || value === "desktop";

const normalizeRoute = (value: unknown) => {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  return value.split(/[?#]/, 1)[0].slice(0, 160) || "/";
};

const normalizeOnboardingStep = (value: unknown) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^[a-z0-9_]{1,64}$/.test(normalized) ? normalized : null;
};

export const normalizeFeedbackContext = (
  value: unknown,
  appVersion: string
): FeedbackTechnicalContext => {
  const candidate =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    route: normalizeRoute(candidate.route),
    appVersion: appVersion.slice(0, 64) || "unknown",
    deviceClass: isDeviceClass(candidate.deviceClass)
      ? candidate.deviceClass
      : "desktop",
    onboardingStep: normalizeOnboardingStep(candidate.onboardingStep),
  };
};

export const getFeedbackDeviceClass = (width: number): FeedbackDeviceClass => {
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
};

export const feedbackProtocol = (id: string) =>
  id.replaceAll("-", "").slice(0, 8).toUpperCase();
