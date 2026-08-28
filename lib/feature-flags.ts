export const isCalendarProfilesFeatureEnabled =
  process.env.NEXT_PUBLIC_FEATURE_CALENDAR_PROFILES === "true";

export const isHabitsPrototypeAvailable = (input: {
  flag?: string;
  deploymentEnv?: string;
  nodeEnv?: string;
  appEnv?: string;
}) => input.flag === "true";

export const isHabitsPrototypeEnabled = isHabitsPrototypeAvailable({
  flag: process.env.NEXT_PUBLIC_FEATURE_HABITS_PROTOTYPE,
  deploymentEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
  nodeEnv: process.env.NODE_ENV,
  appEnv: process.env.NEXT_PUBLIC_APP_ENV,
});
