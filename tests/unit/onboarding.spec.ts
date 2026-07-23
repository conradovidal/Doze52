import { expect, test } from "@playwright/test";
import {
  hasAuthorCalendarEvents,
  migrateGuidedOnboardingState,
  reduceGuidedOnboardingState,
  shouldShowGuidedOnboarding,
  type GuidedOnboardingState,
} from "../../lib/onboarding";
import {
  getOnboardingCategoryDefinition,
  getOnboardingDefaultCategories,
  getOnboardingDefaultProfiles,
  isOnboardingProfilesSnapshot,
  ONBOARDING_CATEGORY_IDS,
  ONBOARDING_PROFILE_IDS,
} from "../../lib/store";
import { materializeUserOwnedSnapshot } from "../../lib/snapshot-ownership";

const initialState = (): GuidedOnboardingState => ({
  version: 4,
  step: "context_selection",
});

const completedState = (): GuidedOnboardingState => ({
  version: 4,
  step: "completed",
  context: "personal",
  completedAt: "2026-07-20T10:05:00.000Z",
  postOnboardingEventsCreated: 0,
  postOnboardingCategoriesCreated: 0,
});

test("cria contexto, categorias incrementais e quatro eventos", () => {
  const configured = reduceGuidedOnboardingState(initialState(), {
    type: "configure_profile",
    context: "work",
    at: "2026-07-20T10:00:00.000Z",
  });
  expect(configured).toMatchObject({
    step: "profile_reveal",
    context: "work",
  });

  const dateCategorySelection = reduceGuidedOnboardingState(configured, {
    type: "continue_from_profile",
  });
  expect(dateCategorySelection.step).toBe("date_category_selection");

  let state = reduceGuidedOnboardingState(dateCategorySelection, {
    type: "choose_date_category",
    categoryId: ONBOARDING_CATEGORY_IDS.workDeliveries,
  });
  expect(state).toMatchObject({
    step: "date_instruction",
    dateCategoryId: ONBOARDING_CATEGORY_IDS.workDeliveries,
  });

  state = reduceGuidedOnboardingState(state, { type: "select_date" });
  state = reduceGuidedOnboardingState(state, {
    type: "date_saved",
    at: "2026-07-20T10:01:00.000Z",
  });
  expect(state).toMatchObject({
    step: "date_instruction",
    dateItemsCreated: 1,
  });

  state = reduceGuidedOnboardingState(state, { type: "select_date" });
  state = reduceGuidedOnboardingState(state, {
    type: "date_saved",
    at: "2026-07-20T10:02:00.000Z",
  });
  expect(state).toMatchObject({
    step: "period_category_selection",
    dateItemsCreated: 2,
  });

  state = reduceGuidedOnboardingState(state, {
    type: "choose_period_category",
    categoryId: ONBOARDING_CATEGORY_IDS.workTrips,
  });
  state = reduceGuidedOnboardingState(state, { type: "select_period" });
  state = reduceGuidedOnboardingState(state, {
    type: "period_saved",
    at: "2026-07-20T10:03:00.000Z",
  });
  expect(state).toMatchObject({
    step: "period_instruction",
    periodItemsCreated: 1,
  });

  state = reduceGuidedOnboardingState(state, { type: "select_period" });
  state = reduceGuidedOnboardingState(state, {
    type: "period_saved",
    at: "2026-07-20T10:04:00.000Z",
  });
  expect(state).toMatchObject({
    step: "completion_choice",
    periodItemsCreated: 2,
  });

  state = reduceGuidedOnboardingState(state, {
    type: "complete",
    at: "2026-07-20T10:05:00.000Z",
  });
  expect(state).toMatchObject({
    step: "completed",
    postOnboardingEventsCreated: 0,
    postOnboardingCategoriesCreated: 0,
  });
});

test("convite de conta exige dois eventos espontâneos", () => {
  const first = reduceGuidedOnboardingState(completedState(), {
    type: "record_post_onboarding_event",
    at: "2026-07-20T11:00:00.000Z",
  });
  expect(first.postOnboardingEventsCreated).toBe(1);
  expect(first.accountNudgeShownAt).toBeUndefined();

  const second = reduceGuidedOnboardingState(first, {
    type: "record_post_onboarding_event",
    at: "2026-07-20T11:01:00.000Z",
  });
  expect(second.postOnboardingEventsCreated).toBe(2);
  expect(second.accountNudgeShownAt).toBe("2026-07-20T11:01:00.000Z");
});

test("categoria e evento também qualificam o convite uma única vez", () => {
  const category = reduceGuidedOnboardingState(completedState(), {
    type: "record_post_onboarding_category",
    at: "2026-07-20T11:00:00.000Z",
  });
  expect(category.accountNudgeShownAt).toBeUndefined();

  const event = reduceGuidedOnboardingState(category, {
    type: "record_post_onboarding_event",
    at: "2026-07-20T11:01:00.000Z",
  });
  expect(event.accountNudgeShownAt).toBe("2026-07-20T11:01:00.000Z");

  const ignored = reduceGuidedOnboardingState(event, {
    type: "record_post_onboarding_event",
    at: "2026-07-20T11:02:00.000Z",
  });
  expect(ignored).toEqual(event);
});

test("migra v3 com progresso sem reabrir fluxo incompatível", () => {
  expect(
    migrateGuidedOnboardingState({
      version: 3,
      step: "period_instruction",
      context: "personal",
      dateItemsCreated: 2,
      firstDateCreatedAt: "2026-07-20T10:01:00.000Z",
    })
  ).toMatchObject({
    version: 4,
    step: "completed",
    context: "personal",
    dateItemsCreated: 2,
  });

  expect(
    migrateGuidedOnboardingState({
      version: 3,
      step: "completed",
      completedAt: "2026-07-20T10:03:00.000Z",
    })
  ).toMatchObject({ version: 4, step: "completed" });
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
  expect(
    hasAuthorCalendarEvents([{ calendarPackGroupId: "feriados-2026" }])
  ).toBe(false);
  expect(
    hasAuthorCalendarEvents([{ calendarPackGroupId: undefined }])
  ).toBe(true);
});

test("oferece categorias específicas e genéricas por contexto", () => {
  expect(
    getOnboardingCategoryDefinition("personal", "date", "specific")
  ).toMatchObject({
    id: ONBOARDING_CATEGORY_IDS.birthday,
    name: "Aniversários",
  });
  expect(
    getOnboardingCategoryDefinition("work", "period", "specific")
  ).toMatchObject({
    id: ONBOARDING_CATEGORY_IDS.workTrips,
    name: "Projetos",
  });
  expect(
    getOnboardingCategoryDefinition("work", "date", "generic")
  ).toMatchObject({
    id: ONBOARDING_CATEGORY_IDS.customImportantDates,
    name: "Datas importantes",
  });
});

test("novo template começa com contexto neutro e nenhuma categoria", () => {
  expect(getOnboardingDefaultProfiles()[0]?.name).toBe("Meu ano");
  expect(getOnboardingDefaultCategories()).toEqual([]);
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
  const profile = profiles[0];
  if (!profile) throw new Error("Template sem contexto");
  const definition = getOnboardingCategoryDefinition(
    "personal",
    "date",
    "specific"
  );
  const category = {
    ...definition,
    profileId: profile.id,
    visible: true,
  };
  const snapshot = {
    profiles,
    categories: [category],
    events: [
      {
        id: "11111111-aaaa-4111-8111-111111111111",
        title: "Aniversário",
        categoryId: category.id,
        color: category.color,
        startDate: "2026-08-01",
        endDate: "2026-08-01",
        recurrenceType: "yearly" as const,
        createdAt: "2026-07-20T10:00:00.000Z",
        dayOrder: 0,
      },
    ],
  };
  const first = materializeUserOwnedSnapshot(snapshot);
  const second = materializeUserOwnedSnapshot(snapshot);
  const firstIds = new Set(
    [...first.profiles, ...first.categories, ...first.events].map(
      (item) => item.id
    )
  );
  const secondIds = new Set(
    [...second.profiles, ...second.categories, ...second.events].map(
      (item) => item.id
    )
  );
  expect([...firstIds].some((id) => secondIds.has(id))).toBe(false);
  expect(first.categories[0]?.profileId).toBe(first.profiles[0]?.id);
  expect(first.events[0]?.categoryId).toBe(first.categories[0]?.id);
});
