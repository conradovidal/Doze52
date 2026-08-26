import { expect, test } from "@playwright/test";
import type { GuidedOnboardingState } from "../../lib/onboarding";
import {
  attributionFromSearchParams,
  toFunnelUpsertPayload,
} from "../../lib/product-metrics";

test("normaliza UTMs e limita o tamanho dos valores", () => {
  const params = new URLSearchParams({
    utm_source: "linkedin",
    utm_medium: "social",
    utm_campaign: "d52_2026_w31_origem",
    utm_content: "x".repeat(200),
  });
  const attribution = attributionFromSearchParams(params);
  expect(attribution).toMatchObject({
    source: "linkedin",
    medium: "social",
    campaign: "d52_2026_w31_origem",
  });
  expect(attribution.content).toHaveLength(120);
});

test("converte o onboarding local em upsert idempotente", () => {
  const state: GuidedOnboardingState = {
    version: 12,
    step: "completed",
    context: "work",
    startedAt: "2026-08-11T10:00:00.000Z",
    profileConfiguredAt: "2026-08-11T10:01:00.000Z",
    firstDateCreatedAt: "2026-08-11T10:02:00.000Z",
    firstPeriodCreatedAt: "2026-08-11T10:03:00.000Z",
    completedAt: "2026-08-11T10:04:00.000Z",
  };
  expect(
    toFunnelUpsertPayload("user-1", state, {
      source: "linkedin",
      campaign: "d52_2026_w31_origem",
    })
  ).toEqual({
    user_id: "user-1",
    planning_context: "work",
    onboarding_started_at: "2026-08-11T10:00:00.000Z",
    profile_configured_at: "2026-08-11T10:01:00.000Z",
    first_point_event_at: "2026-08-11T10:02:00.000Z",
    first_period_at: "2026-08-11T10:03:00.000Z",
    onboarding_completed_at: "2026-08-11T10:04:00.000Z",
    first_touch_source: "linkedin",
    first_touch_campaign: "d52_2026_w31_origem",
  });
});
