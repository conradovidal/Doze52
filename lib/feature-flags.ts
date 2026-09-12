export const isCalendarProfilesFeatureEnabled =
  process.env.NEXT_PUBLIC_FEATURE_CALENDAR_PROFILES === "true";

// Enable only after continuity_contract_version() has been verified in the target environment.
export const isAccountContinuityEnabled =
  process.env.NEXT_PUBLIC_FEATURE_ACCOUNT_CONTINUITY === "true";
