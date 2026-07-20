import { expect, test } from "@playwright/test";
import {
  hasAuthorCalendarEvents,
  reduceGuidedOnboardingState,
  shouldShowGuidedOnboarding,
  type GuidedOnboardingState,
} from "../../lib/onboarding";
import {
  getOnboardingDefaultCategories,
  getOnboardingDefaultProfiles,
  isOnboardingProfilesSnapshot,
  ONBOARDING_PROFILE_IDS,
} from "../../lib/store";
import { materializeUserOwnedSnapshot } from "../../lib/snapshot-ownership";

const initialState = (): GuidedOnboardingState => ({
  version: 2,
  step: "intro",
});

test("avança pelos prompts sem exigir reflexão", () => {
  const started = reduceGuidedOnboardingState(initialState(), {
    type: "start",
    at: "2026-07-20T10:00:00.000Z",
  });
  const firstItem = reduceGuidedOnboardingState(started, {
    type: "item_created",
    isPeriod: false,
    at: "2026-07-20T10:01:00.000Z",
  });
  expect(firstItem.step).toBe("period_prompt");
  expect(firstItem.firstItemCreatedAt).toBe("2026-07-20T10:01:00.000Z");

  const context = reduceGuidedOnboardingState(firstItem, {
    type: "skip_period",
  });
  expect(context.step).toBe("context_prompt");

  const reflection = reduceGuidedOnboardingState(context, {
    type: "continue_to_reflection",
  });
  expect(reflection.step).toBe("reflection");

  const save = reduceGuidedOnboardingState(reflection, {
    type: "skip_reflection",
  });
  expect(save.step).toBe("save");
  expect(save.reflection).toBeUndefined();
});

test("um primeiro período pula o prompt redundante", () => {
  const next = reduceGuidedOnboardingState(initialState(), {
    type: "item_created",
    isPeriod: true,
    at: "2026-07-20T10:01:00.000Z",
  });

  expect(next.step).toBe("context_prompt");
  expect(next.firstPeriodCreatedAt).toBe("2026-07-20T10:01:00.000Z");
});

test("dispensa e conclusão são terminais para a elegibilidade", () => {
  const dismissed = reduceGuidedOnboardingState(initialState(), {
    type: "dismiss",
    at: "2026-07-20T10:00:00.000Z",
  });
  expect(
    shouldShowGuidedOnboarding({
      state: dismissed,
      legacyState: "pending",
      hasAuthorEvents: false,
      authLoading: false,
      isAuthenticated: false,
      remoteReady: false,
    })
  ).toBe(false);

  expect(
    shouldShowGuidedOnboarding({
      state: initialState(),
      legacyState: "completed",
      hasAuthorEvents: false,
      authLoading: false,
      isAuthenticated: false,
      remoteReady: false,
    })
  ).toBe(false);
});

test("conta autenticada só recebe o fluxo depois da carga remota", () => {
  const input = {
    state: initialState(),
    legacyState: "pending" as const,
    hasAuthorEvents: false,
    authLoading: false,
    isAuthenticated: true,
    remoteReady: false,
  };

  expect(shouldShowGuidedOnboarding(input)).toBe(false);
  expect(shouldShowGuidedOnboarding({ ...input, remoteReady: true })).toBe(true);
});

test("eventos de calendários prontos não contam como eventos autorais", () => {
  expect(
    hasAuthorCalendarEvents([
      { calendarPackGroupId: "feriados-2026" },
      { calendarPackGroupId: "formula-1-2026" },
    ])
  ).toBe(false);
  expect(
    hasAuthorCalendarEvents([
      { calendarPackGroupId: "feriados-2026" },
      { calendarPackGroupId: undefined },
    ])
  ).toBe(true);
});

test("novo template é neutro e o template Pessoal continua reconhecido", () => {
  expect(getOnboardingDefaultProfiles()[0]?.name).toBe("Meu ano");
  expect(
    isOnboardingProfilesSnapshot([
      {
        id: ONBOARDING_PROFILE_IDS.personal,
        name: "Pessoal",
        color: "#64748B",
        icon: "user",
        position: 0,
      },
    ])
  ).toBe(true);
});

test("materialização cria IDs distintos e preserva relacionamentos", () => {
  const profiles = getOnboardingDefaultProfiles();
  const categories = getOnboardingDefaultCategories();
  const sourceCategory = categories[0];
  if (!sourceCategory) throw new Error("Template sem categoria");

  const snapshot = {
    profiles,
    categories,
    events: [
      {
        id: "11111111-aaaa-4111-8111-111111111111",
        title: "Viagem",
        categoryId: sourceCategory.id,
        color: sourceCategory.color,
        startDate: "2026-08-01",
        endDate: "2026-08-10",
        createdAt: "2026-07-20T10:00:00.000Z",
        dayOrder: 0,
      },
    ],
  };

  const firstAccount = materializeUserOwnedSnapshot(snapshot);
  const secondAccount = materializeUserOwnedSnapshot(snapshot);
  const firstIds = new Set([
    ...firstAccount.profiles.map((profile) => profile.id),
    ...firstAccount.categories.map((category) => category.id),
    ...firstAccount.events.map((event) => event.id),
  ]);
  const secondIds = new Set([
    ...secondAccount.profiles.map((profile) => profile.id),
    ...secondAccount.categories.map((category) => category.id),
    ...secondAccount.events.map((event) => event.id),
  ]);

  expect([...firstIds].some((id) => secondIds.has(id))).toBe(false);
  expect(
    firstAccount.profiles.some(
      (profile) => profile.id === firstAccount.categories[0]?.profileId
    )
  ).toBe(true);
  expect(
    firstAccount.categories.some(
      (category) => category.id === firstAccount.events[0]?.categoryId
    )
  ).toBe(true);
});
