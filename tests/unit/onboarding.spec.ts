import { expect, test } from "@playwright/test";
import {
  hasAuthorCalendarEvents,
  migrateGuidedOnboardingState,
  reduceGuidedOnboardingState,
  shouldShowGuidedOnboarding,
  type GuidedOnboardingState,
} from "../../lib/onboarding";
import {
  getOnboardingCategoryIdForIntent,
  getOnboardingDefaultCategories,
  getOnboardingDefaultProfiles,
  isOnboardingProfilesSnapshot,
  ONBOARDING_CATEGORY_IDS,
  ONBOARDING_PROFILE_IDS,
} from "../../lib/store";
import { materializeUserOwnedSnapshot } from "../../lib/snapshot-ownership";

const initialState = (): GuidedOnboardingState => ({
  version: 3,
  step: "context_selection",
});

test("configura contexto, data, período e chega à prévia sem reflexão", () => {
  const configured = reduceGuidedOnboardingState(initialState(), {
    type: "configure_profile",
    context: "work",
    at: "2026-07-20T10:00:00.000Z",
  });
  expect(configured).toMatchObject({
    step: "date_instruction",
    context: "work",
  });

  const dateDetails = reduceGuidedOnboardingState(configured, {
    type: "select_date",
  });
  const dateSaved = reduceGuidedOnboardingState(dateDetails, {
    type: "date_saved",
    at: "2026-07-20T10:01:00.000Z",
  });
  expect(dateSaved.step).toBe("period_instruction");
  expect(dateSaved.firstDateCreatedAt).toBe("2026-07-20T10:01:00.000Z");

  const periodDetails = reduceGuidedOnboardingState(dateSaved, {
    type: "select_period",
  });
  const preview = reduceGuidedOnboardingState(periodDetails, {
    type: "period_saved",
    at: "2026-07-20T10:02:00.000Z",
  });
  expect(preview.step).toBe("use_case_preview");
  expect(preview.firstPeriodCreatedAt).toBe("2026-07-20T10:02:00.000Z");
});

test("Outro pede nome antes de configurar o perfil", () => {
  const custom = reduceGuidedOnboardingState(initialState(), {
    type: "choose_context",
    context: "custom",
  });
  expect(custom.step).toBe("custom_profile");
  expect(custom.context).toBe("custom");
});

test("migre v2 em andamento removendo reflexão e preserve terminais", () => {
  expect(
    migrateGuidedOnboardingState({
      version: 2,
      step: "reflection",
      startedAt: "2026-07-20T10:00:00.000Z",
      firstItemCreatedAt: "2026-07-20T10:01:00.000Z",
    })
  ).toMatchObject({
    version: 3,
    step: "period_instruction",
    context: "personal",
    firstDateCreatedAt: "2026-07-20T10:01:00.000Z",
  });

  expect(
    migrateGuidedOnboardingState({
      version: 2,
      step: "completed",
      completedAt: "2026-07-20T10:03:00.000Z",
    })
  ).toMatchObject({ version: 3, step: "completed" });
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

test("eventos de calendários prontos não contam como autorais", () => {
  expect(hasAuthorCalendarEvents([{ calendarPackGroupId: "feriados-2026" }])).toBe(false);
  expect(hasAuthorCalendarEvents([{ calendarPackGroupId: undefined }])).toBe(true);
});

test("mapeia as intenções para as categorias corretas", () => {
  expect(getOnboardingCategoryIdForIntent("personal", "date")).toBe(
    ONBOARDING_CATEGORY_IDS.birthday
  );
  expect(getOnboardingCategoryIdForIntent("work", "date")).toBe(
    ONBOARDING_CATEGORY_IDS.workDeliveries
  );
  expect(getOnboardingCategoryIdForIntent("work", "period")).toBe(
    ONBOARDING_CATEGORY_IDS.workTrips
  );
  expect(getOnboardingCategoryIdForIntent("custom", "period")).toBe(
    ONBOARDING_CATEGORY_IDS.customPeriods
  );
});

test("novo template neutro e Pessoal legado continuam reconhecidos", () => {
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
    events: [{
      id: "11111111-aaaa-4111-8111-111111111111",
      title: "Viagem",
      categoryId: sourceCategory.id,
      color: sourceCategory.color,
      startDate: "2026-08-01",
      endDate: "2026-08-10",
      createdAt: "2026-07-20T10:00:00.000Z",
      dayOrder: 0,
    }],
  };
  const first = materializeUserOwnedSnapshot(snapshot);
  const second = materializeUserOwnedSnapshot(snapshot);
  const firstIds = new Set([...first.profiles, ...first.categories, ...first.events].map((item) => item.id));
  const secondIds = new Set([...second.profiles, ...second.categories, ...second.events].map((item) => item.id));
  expect([...firstIds].some((id) => secondIds.has(id))).toBe(false);
  expect(first.categories[0]?.profileId).toBe(first.profiles[0]?.id);
  expect(first.events[0]?.categoryId).toBe(first.categories[0]?.id);
});
