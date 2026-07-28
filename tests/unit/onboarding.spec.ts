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
  getOnboardingPersonalDemoSnapshot,
  isOnboardingPersonalDemoSnapshot,
  isOnboardingProfilesSnapshot,
  ONBOARDING_CATEGORY_IDS,
  ONBOARDING_PERSONAL_DEMO_GROUP_ID,
  ONBOARDING_PROFILE_IDS,
  stripOnboardingPersonalDemo,
} from "../../lib/store";
import { materializeUserOwnedSnapshot } from "../../lib/snapshot-ownership";
import {
  CATEGORY_COLOR_BASE_AMBER,
  CATEGORY_COLOR_BASE_BLUE,
  CATEGORY_COLOR_BASE_CORAL,
  CATEGORY_COLOR_BASE_GREEN,
  CATEGORY_COLOR_BASE_OLIVE,
  CATEGORY_COLOR_BASE_ORANGE,
  CATEGORY_COLOR_BASE_SAND,
  CATEGORY_COLOR_BASE_TEAL,
  CATEGORY_COLOR_BASE_VIOLET,
  CATEGORY_PRESET_COLORS,
} from "../../lib/category-palette";

const initialState = (): GuidedOnboardingState => ({
  version: 7,
  step: "context_selection",
});

const completedState = (): GuidedOnboardingState => ({
  version: 7,
  step: "completed",
  context: "personal",
  completedAt: "2026-07-20T10:05:00.000Z",
  postOnboardingEventsCreated: 0,
  postOnboardingCategoriesCreated: 0,
});

test("organiza 24 cores e mantém padrões distintos no onboarding", () => {
  expect(CATEGORY_PRESET_COLORS).toHaveLength(24);
  expect(CATEGORY_PRESET_COLORS).toContain(CATEGORY_COLOR_BASE_CORAL);
  expect(CATEGORY_PRESET_COLORS).toContain(CATEGORY_COLOR_BASE_TEAL);
  expect(CATEGORY_PRESET_COLORS).toContain(CATEGORY_COLOR_BASE_OLIVE);
  expect(CATEGORY_PRESET_COLORS).toContain(CATEGORY_COLOR_BASE_SAND);
  expect(CATEGORY_PRESET_COLORS).toEqual([
    "#E1D15D", "#E7B957", "#EBA16D", "#EE9275", "#EF8F8F", "#F4A6B8", "#F09CCF", "#C78AD9",
    "#B79AEF", "#8EA5F7", "#4F8FD6", "#93C5FD", "#72CFE3", "#5EC9C5", "#55B5A8", "#86C7A0",
    "#58B76F", "#A8CD6C", "#B7B86F", "#D6A060", "#D9BE8C", "#CBD5E1", "#D0D3DA", "#9CA6B4",
  ]);

  expect(
    getOnboardingCategoryDefinition("personal", "date", "specific").color
  ).toBe(CATEGORY_COLOR_BASE_AMBER);
  expect(
    getOnboardingCategoryDefinition("personal", "date", "generic").color
  ).toBe(CATEGORY_COLOR_BASE_BLUE);
  expect(
    getOnboardingCategoryDefinition("personal", "period", "specific").color
  ).not.toBe(
    getOnboardingCategoryDefinition("personal", "period", "generic").color
  );
  expect(
    getOnboardingCategoryDefinition("work", "date", "specific").color
  ).toBe(CATEGORY_COLOR_BASE_ORANGE);
  expect(
    getOnboardingCategoryDefinition("work", "period", "generic").color
  ).toBe(CATEGORY_COLOR_BASE_VIOLET);
  expect(
    getOnboardingCategoryDefinition("work", "period", "specific").color
  ).toBe(CATEGORY_COLOR_BASE_GREEN);
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
    step: "theme_instruction",
    periodItemsCreated: 2,
  });

  state = reduceGuidedOnboardingState(state, {
    type: "confirm_theme",
    at: "2026-07-20T10:04:30.000Z",
  });
  expect(state).toMatchObject({
    step: "edit_instruction",
    themeConfirmedAt: "2026-07-20T10:04:30.000Z",
  });

  state = reduceGuidedOnboardingState(state, {
    type: "open_inline_edit",
  });
  expect(state.step).toBe("edit_active");
  state = reduceGuidedOnboardingState(state, {
    type: "close_inline_edit",
  });
  expect(state.step).toBe("completion_choice");

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
    version: 7,
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
  ).toMatchObject({ version: 7, step: "completed" });

  expect(
    migrateGuidedOnboardingState({
      version: 4,
      step: "completion_choice",
      context: "personal",
      dateItemsCreated: 2,
      periodItemsCreated: 2,
    })
  ).toMatchObject({
    version: 7,
    step: "theme_instruction",
    context: "personal",
  });
});

test("migra v6 sem perder períodos e posiciona o tema depois deles", () => {
  expect(
    migrateGuidedOnboardingState({
      version: 6,
      step: "theme_instruction",
      context: "personal",
      dateItemsCreated: 2,
      periodItemsCreated: 0,
    })
  ).toMatchObject({
    version: 7,
    step: "period_category_selection",
    dateItemsCreated: 2,
  });

  expect(
    migrateGuidedOnboardingState({
      version: 6,
      step: "period_instruction",
      context: "personal",
      dateItemsCreated: 2,
      periodItemsCreated: 1,
    })
  ).toMatchObject({
    version: 7,
    step: "period_instruction",
    periodItemsCreated: 1,
  });

  const state = migrateGuidedOnboardingState({
    version: 6,
    step: "edit_active",
    context: "personal",
    dateItemsCreated: 2,
    periodItemsCreated: 2,
  });
  expect(state).toMatchObject({
    version: 7,
    step: "theme_instruction",
    periodItemsCreated: 2,
  });
});

test("migra v6 com tema confirmado sem repetir a etapa", () => {
  expect(
    migrateGuidedOnboardingState({
      version: 6,
      step: "edit_instruction",
      context: "personal",
      dateItemsCreated: 2,
      periodItemsCreated: 2,
      themeConfirmedAt: "2026-07-20T10:04:30.000Z",
    })
  ).toMatchObject({
    version: 7,
    step: "edit_instruction",
    themeConfirmedAt: "2026-07-20T10:04:30.000Z",
  });
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

test("demonstração pessoal monta um ano completo e identificável", () => {
  const snapshot = getOnboardingPersonalDemoSnapshot(2026);
  expect(snapshot.profiles.map((profile) => profile.name)).toEqual([
    "Pessoal",
    "Família",
    "Profissional",
  ]);
  expect(snapshot.categories.map((category) => category.name)).toEqual([
    "Aniversários",
    "Férias e viagens",
    "Família e escola",
    "Saúde e bem-estar",
    "Celebrações",
    "Projetos pessoais",
  ]);
  expect(snapshot.events).toHaveLength(22);
  expect(isOnboardingPersonalDemoSnapshot(snapshot)).toBe(true);
  expect(
    snapshot.events.every(
      (event) =>
        event.calendarPackGroupId === ONBOARDING_PERSONAL_DEMO_GROUP_ID
    )
  ).toBe(true);
  expect(
    snapshot.events.filter((event) => event.recurrenceType === "yearly")
  ).toHaveLength(4);
});

test("demonstração é removida antes de qualquer importação", () => {
  const stripped = stripOnboardingPersonalDemo(
    getOnboardingPersonalDemoSnapshot(2026)
  );
  expect(stripped.profiles.map((profile) => profile.name)).toEqual(["Meu ano"]);
  expect(stripped.categories).toEqual([]);
  expect(stripped.events).toEqual([]);
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
