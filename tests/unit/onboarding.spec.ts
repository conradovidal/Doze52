import { expect, test } from "@playwright/test";
import {
  GUIDED_CATEGORY_REVEAL_MS,
  GUIDED_DEMO_INTERACTION_THRESHOLD,
  getGuidedCategoryRevealRemainingMs,
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
  useStore,
} from "../../lib/store";
import { materializeUserOwnedSnapshot } from "../../lib/snapshot-ownership";
import { expandEventsForYear } from "../../lib/recurrence";
import {
  BRAZIL_UFS,
  isBrazilUf,
  ONBOARDING_VERSION,
} from "../../lib/onboarding-region";
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
  getNearestCategoryColor,
} from "../../lib/category-palette";

const initialState = (): GuidedOnboardingState => ({
  version: 11,
  step: "context_selection",
});

const completedState = (): GuidedOnboardingState => ({
  version: 11,
  step: "completed",
  context: "personal",
  completedAt: "2026-07-20T10:05:00.000Z",
  postOnboardingEventsCreated: 0,
  postOnboardingCategoriesCreated: 0,
});

test("métrica regional aceita apenas as 27 UFs na versão atual", () => {
  expect(ONBOARDING_VERSION).toBe(11);
  expect(BRAZIL_UFS).toHaveLength(27);
  expect(isBrazilUf("RS")).toBe(true);
  expect(isBrazilUf("BR")).toBe(false);
  expect(isBrazilUf("rs")).toBe(false);
});

test("revelação de categoria dura 1,8 s e retoma pelo tempo restante", () => {
  expect(GUIDED_CATEGORY_REVEAL_MS).toBe(1_800);
  expect(
    getGuidedCategoryRevealRemainingMs(
      "2026-07-20T10:00:00.000Z",
      Date.parse("2026-07-20T10:00:00.350Z")
    )
  ).toBe(1_450);
  expect(
    getGuidedCategoryRevealRemainingMs(
      "2026-07-20T10:00:00.000Z",
      Date.parse("2026-07-20T10:00:02.000Z")
    )
  ).toBe(0);
  expect(getGuidedCategoryRevealRemainingMs(undefined)).toBe(1_800);
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

test("normaliza a antiga cor escura para uma opção oficial", () => {
  expect(getNearestCategoryColor("#1F2937")).toBe("#9CA6B4");
});

test("cria contexto, categorias incrementais e quatro eventos", () => {
  const configured = reduceGuidedOnboardingState(initialState(), {
    type: "configure_profile",
    context: "work",
    at: "2026-07-20T10:00:00.000Z",
  });
  expect(configured).toMatchObject({
    step: "date_category_selection",
    context: "work",
  });

  let state = reduceGuidedOnboardingState(configured, {
    type: "choose_date_category",
    categoryId: ONBOARDING_CATEGORY_IDS.workDeliveries,
    at: "2026-07-20T10:00:30.000Z",
  });
  expect(state).toMatchObject({
    step: "date_category_reveal",
    dateCategoryId: ONBOARDING_CATEGORY_IDS.workDeliveries,
    categoryRevealStartedAt: "2026-07-20T10:00:30.000Z",
  });
  state = reduceGuidedOnboardingState(state, {
    type: "finish_category_reveal",
  });
  expect(state.categoryRevealStartedAt).toBeUndefined();

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
    at: "2026-07-20T10:02:30.000Z",
  });
  expect(state).toMatchObject({
    step: "period_category_reveal",
    categoryRevealStartedAt: "2026-07-20T10:02:30.000Z",
  });
  state = reduceGuidedOnboardingState(state, {
    type: "finish_category_reveal",
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
    step: "edit_instruction",
    periodItemsCreated: 2,
  });

  state = reduceGuidedOnboardingState(state, {
    type: "open_edit_preview",
  });
  expect(state.step).toBe("edit_preview");
  state = reduceGuidedOnboardingState(state, {
    type: "finish_edit_preview",
  });
  expect(state.step).toBe("calendar_instruction");

  state = reduceGuidedOnboardingState(state, {
    type: "open_calendar",
  });
  expect(state.step).toBe("calendar_selection");
  state = reduceGuidedOnboardingState(state, {
    type: "close_calendar",
  });
  expect(state.step).toBe("calendar_instruction");
  state = reduceGuidedOnboardingState(state, {
    type: "open_calendar",
  });
  state = reduceGuidedOnboardingState(state, {
    type: "calendar_added",
    uf: "RS",
    at: "2026-07-20T10:04:30.000Z",
  });
  expect(state).toMatchObject({
    step: "year_instruction",
    holidayUf: "RS",
  });

  state = reduceGuidedOnboardingState(state, {
    type: "continue_from_year",
  });
  expect(state.step).toBe("theme_instruction");

  state = reduceGuidedOnboardingState(state, {
    type: "confirm_theme",
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

test("um único evento não qualifica o convite e o estado terminal não reconta", () => {
  const event = reduceGuidedOnboardingState(completedState(), {
    type: "record_post_onboarding_event",
    at: "2026-07-20T11:01:00.000Z",
  });
  expect(event.accountNudgeShownAt).toBeUndefined();

  const qualified = reduceGuidedOnboardingState(event, {
    type: "record_post_onboarding_event",
    at: "2026-07-20T11:02:00.000Z",
  });
  const ignored = reduceGuidedOnboardingState(qualified, {
    type: "record_post_onboarding_event",
    at: "2026-07-20T11:03:00.000Z",
  });
  expect(ignored).toEqual(qualified);
});

test("sandbox qualifica o convite com cinco alvos únicos", () => {
  expect(GUIDED_DEMO_INTERACTION_THRESHOLD).toBe(5);
  let state = reduceGuidedOnboardingState(
    {
      ...initialState(),
      step: "date_details",
      context: "personal",
      startedAt: "2026-07-20T10:00:00.000Z",
    },
    { type: "enter_demo_exploration", at: "2026-07-20T11:00:00.000Z" }
  );
  expect(state).toMatchObject({
    version: 11,
    step: "demo_exploration",
    demoInteractionKeys: [],
  });
  expect(state.context).toBeUndefined();

  const keys = [
    "profile:personal",
    "category:family",
    "category:gremio",
    "event:festival",
    "toolbar:theme",
  ];
  keys.forEach((key, index) => {
    state = reduceGuidedOnboardingState(state, {
      type: "record_demo_interaction",
      key,
      at: `2026-07-20T11:0${index}:00.000Z`,
    });
  });
  expect(state.demoInteractionKeys).toEqual(keys);
  expect(state.demoInviteEligibleAt).toBe("2026-07-20T11:04:00.000Z");

  const duplicate = reduceGuidedOnboardingState(state, {
    type: "record_demo_interaction",
    key: "category:gremio",
  });
  expect(duplicate).toEqual(state);
  expect(
    reduceGuidedOnboardingState(state, { type: "restart_from_demo" })
  ).toEqual(initialState());
});

test("saída antecipada preserva progresso e convida após três criações únicas", () => {
  let state = reduceGuidedOnboardingState(initialState(), {
    type: "configure_profile",
    context: "personal",
  });
  state = reduceGuidedOnboardingState(state, {
    type: "dismiss_preserving",
    at: "2026-08-03T10:00:00.000Z",
  });
  expect(state).toMatchObject({
    version: 11,
    step: "dismissed_preserved",
    context: "personal",
    postExitCreationKeys: [],
  });

  state = reduceGuidedOnboardingState(state, {
    type: "record_post_exit_creation",
    key: "category:1",
  });
  state = reduceGuidedOnboardingState(state, {
    type: "record_post_exit_creation",
    key: "category:1",
  });
  state = reduceGuidedOnboardingState(state, {
    type: "record_post_exit_creation",
    key: "event:1",
  });
  expect(state.accountNudgeShownAt).toBeUndefined();
  state = reduceGuidedOnboardingState(state, {
    type: "record_post_exit_creation",
    key: "profile:1",
    at: "2026-08-03T10:05:00.000Z",
  });
  expect(state.postExitCreationKeys).toEqual([
    "category:1",
    "event:1",
    "profile:1",
  ]);
  expect(state.accountNudgeShownAt).toBe("2026-08-03T10:05:00.000Z");
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
    version: 11,
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
  ).toMatchObject({ version: 11, step: "completed" });

  expect(
    migrateGuidedOnboardingState({
      version: 4,
      step: "completion_choice",
      context: "personal",
      dateItemsCreated: 2,
      periodItemsCreated: 2,
    })
  ).toMatchObject({
    version: 11,
    step: "calendar_instruction",
    context: "personal",
  });
});

test("migra v6 sem perder períodos e posiciona calendários depois deles", () => {
  expect(
    migrateGuidedOnboardingState({
      version: 6,
      step: "theme_instruction",
      context: "personal",
      dateItemsCreated: 2,
      periodItemsCreated: 0,
    })
  ).toMatchObject({
    version: 11,
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
    version: 11,
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
    version: 11,
    step: "calendar_instruction",
    periodItemsCreated: 2,
  });
});

test("migra v6 com tema confirmado e preserva a confirmação", () => {
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
    version: 11,
    step: "calendar_instruction",
    themeConfirmedAt: "2026-07-20T10:04:30.000Z",
  });
});

test("migra v7 sem reabrir terminais e consolida o passo de contexto", () => {
  expect(
    migrateGuidedOnboardingState({
      version: 7,
      step: "profile_reveal",
      context: "personal",
    })
  ).toMatchObject({
    version: 11,
    step: "date_category_selection",
  });

  expect(
    migrateGuidedOnboardingState({
      version: 7,
      step: "completion_choice",
      context: "personal",
      dateItemsCreated: 2,
      periodItemsCreated: 2,
      themeConfirmedAt: "2026-07-20T10:04:30.000Z",
    })
  ).toMatchObject({
    version: 11,
    step: "calendar_instruction",
    themeConfirmedAt: "2026-07-20T10:04:30.000Z",
  });

  expect(
    migrateGuidedOnboardingState({
      version: 7,
      step: "completed",
      completedAt: "2026-07-20T10:05:00.000Z",
    })
  ).toMatchObject({ version: 11, step: "completed" });
});

test("migra v8 sem repetir revelações e preserva estados terminais", () => {
  expect(
    migrateGuidedOnboardingState({
      version: 8,
      step: "date_instruction",
      context: "work",
      dateCategoryId: ONBOARDING_CATEGORY_IDS.workDeliveries,
    })
  ).toMatchObject({
    version: 11,
    step: "date_instruction",
    context: "work",
  });

  expect(
    migrateGuidedOnboardingState({
      version: 8,
      step: "completed",
      completedAt: "2026-07-20T10:05:00.000Z",
    })
  ).toMatchObject({ version: 11, step: "completed" });
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

test("modo de demonstração libera a interface sem reabrir o painel", () => {
  const demo = reduceGuidedOnboardingState(initialState(), {
    type: "enter_demo_exploration",
    at: "2026-07-20T10:00:00.000Z",
  });
  expect(
    shouldShowGuidedOnboarding({
      state: demo,
      legacyState: "pending",
      hasAuthorEvents: true,
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

test("demonstração monta dois contextos e categorias pessoais e profissionais", () => {
  const snapshot = getOnboardingPersonalDemoSnapshot(2026);
  expect(snapshot.profiles.map((profile) => profile.name)).toEqual([
    "Pessoal",
    "Profissional",
  ]);
  expect(snapshot.categories.map((category) => category.name)).toEqual([
    "Eventos",
    "Família",
    "Amigos",
    "Viagens",
    "Aniversários",
    "Feriados",
    "Corridas F1",
    "Eventos",
    "Rituais",
    "Produto",
    "Marketing",
    "Performance Review",
    "Entregas",
  ]);
  expect(snapshot.categories.map((category) => category.color)).toEqual([
    "#9CA6B4",
    "#EF8F8F",
    "#4F8FD6",
    "#58B76F",
    "#E1D15D",
    "#B79AEF",
    "#EBA16D",
    "#9CA6B4",
    "#4F8FD6",
    "#B79AEF",
    "#EE9275",
    "#55B5A8",
    "#EBA16D",
  ]);
  expect(snapshot.events.length).toBeGreaterThan(150);
  expect(new Set(snapshot.events.map((event) => event.startDate.slice(5, 7))).size).toBe(12);
  expect(snapshot.events.map((event) => event.title)).toEqual(
    expect.arrayContaining([
      "Planejamento estratégico",
      "Encontro com clientes",
      "Conferência de produto",
      "All Hands",
      "QBR",
      "Descoberta da experiência mobile",
      "Beta da experiência mobile",
      "Evolução do onboarding",
      "Portal para PMEs",
      "Campanha de lançamento mobile",
      "Campanha de conteúdo para PMEs",
      "Campanha de retrospectiva do ano",
      "Fechamento de performance Q1",
      "Calibração e alinhamento Q4",
      "Roadmap do semestre",
      "Protótipo mobile validado",
      "Lançamento mobile",
      "Relatório para o conselho",
      "Plano do próximo ano",
    ])
  );
  expect(isOnboardingPersonalDemoSnapshot(snapshot)).toBe(true);
  expect(
    snapshot.events.every(
      (event) =>
        event.calendarPackGroupId === ONBOARDING_PERSONAL_DEMO_GROUP_ID
    )
  ).toBe(true);
  expect(snapshot.categories.filter((category) => !category.visible)).toEqual([]);
  expect(
    snapshot.categories.filter(
      (category) => category.profileId === ONBOARDING_PROFILE_IDS.professional
    ).map((category) => category.name)
  ).toEqual([
    "Eventos",
    "Rituais",
    "Produto",
    "Marketing",
    "Performance Review",
    "Entregas",
  ]);

  const productCategory = snapshot.categories.find(
    (category) =>
      category.profileId === ONBOARDING_PROFILE_IDS.professional &&
      category.name === "Produto"
  );
  const productPeriods = snapshot.events
    .filter((event) => event.categoryId === productCategory?.id)
    .toSorted((left, right) => left.startDate.localeCompare(right.startDate));
  expect(productPeriods).toHaveLength(4);
  for (const [index, event] of productPeriods.entries()) {
    const durationMs =
      Date.parse(`${event.endDate}T12:00:00Z`) -
      Date.parse(`${event.startDate}T12:00:00Z`);
    expect(durationMs / 86_400_000).toBeLessThanOrEqual(41);
    if (index > 0) {
      expect(productPeriods[index - 1].endDate < event.startDate).toBe(true);
    }
  }
  expect(
    snapshot.events.filter((event) => event.recurrenceType === "yearly").length
  ).toBeGreaterThanOrEqual(10);

  const personalCategories = snapshot.categories.filter(
    (category) => category.profileId === ONBOARDING_PROFILE_IDS.personal
  );
  const personalCategoryIds = new Map(
    personalCategories.map((category) => [category.name, category.id])
  );
  const countCategoryEvents = (name: string) =>
    snapshot.events.filter(
      (event) => event.categoryId === personalCategoryIds.get(name)
    ).length;
  expect(countCategoryEvents("Eventos")).toBe(15);
  expect(countCategoryEvents("Família")).toBe(17);
  expect(countCategoryEvents("Amigos")).toBe(19);
  expect(countCategoryEvents("Viagens")).toBe(6);
  expect(countCategoryEvents("Aniversários")).toBe(10);
  expect(countCategoryEvents("Corridas F1")).toBeGreaterThan(20);

  const visiblePersonalCategoryIds = new Set(
    personalCategories
      .filter((category) => category.visible)
      .map((category) => category.id)
  );
  const visiblePersonalEvents = expandEventsForYear(snapshot.events, 2026).filter(
    (event) => visiblePersonalCategoryIds.has(event.categoryId)
  );
  expect(visiblePersonalEvents.length).toBeGreaterThanOrEqual(95);
  expect(visiblePersonalEvents.length).toBeLessThanOrEqual(105);

  const authorCategoryIds = new Set(
    personalCategories
      .filter(
        (category) =>
          category.name !== "Feriados" && category.name !== "Corridas F1"
      )
      .map((category) => category.id)
  );
  const weekdayAuthorEvents = snapshot.events.filter((event) => {
    if (!authorCategoryIds.has(event.categoryId)) return false;
    const weekday = new Date(`${event.startDate}T12:00:00Z`).getUTCDay();
    return weekday >= 1 && weekday <= 5;
  });
  expect(weekdayAuthorEvents.length).toBeGreaterThanOrEqual(12);

  expect(snapshot.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        title: "Férias de verão",
        startDate: "2026-01-02",
        endDate: "2026-01-18",
      }),
      expect.objectContaining({
        title: "Férias das crianças",
        startDate: "2026-07-20",
        endDate: "2026-08-02",
      }),
      expect.objectContaining({
        title: "Férias em família — Maceió",
        startDate: "2026-07-25",
        endDate: "2026-07-30",
      }),
      expect.objectContaining({
        title: "Ano Novo em Tiradentes",
        startDate: "2026-12-27",
        endDate: "2027-01-03",
      }),
      expect.objectContaining({ title: "Revolução Farroupilha" }),
    ])
  );
});

test("reconhece e remove snapshots demonstrativos v1 a v6", () => {
  for (const groupId of [
    "onboarding-personal-demo-v1",
    "onboarding-personal-demo-v2",
    "onboarding-personal-demo-v3",
    "onboarding-personal-demo-v4",
    "onboarding-personal-demo-v5",
    "onboarding-personal-demo-v6",
  ]) {
    const current = getOnboardingPersonalDemoSnapshot(2026);
    const legacy = {
      profiles: current.profiles,
      categories: current.categories.map((category) => ({
        ...category,
        calendarPackGroupId: groupId,
      })),
      events: current.events.map((event) => ({
        ...event,
        calendarPackGroupId: groupId,
      })),
    };
    expect(isOnboardingPersonalDemoSnapshot(legacy)).toBe(true);
    expect(stripOnboardingPersonalDemo(legacy).events).toEqual([]);
  }
});

test("demonstração é removida antes de qualquer importação", () => {
  const stripped = stripOnboardingPersonalDemo(
    getOnboardingPersonalDemoSnapshot(2026)
  );
  expect(stripped.profiles.map((profile) => profile.name)).toEqual(["Meu ano"]);
  expect(stripped.categories).toEqual([]);
  expect(stripped.events).toEqual([]);
});

test("sandbox libera criação, edição e exclusão sem preservar a origem demonstrativa", () => {
  const store = useStore.getState();
  store.loadOnboardingPersonalDemo(2026);
  store.unlockOnboardingPersonalDemo();

  const sandbox = useStore.getState();
  expect(
    sandbox.categories.every((category) => !category.calendarPackGroupId)
  ).toBe(true);
  expect(sandbox.events.every((event) => !event.calendarPackGroupId)).toBe(true);

  const categoryId = sandbox.categories[0]?.id;
  expect(categoryId).toBeTruthy();
  const eventId = sandbox.addEvent({
    title: "Novo evento no exemplo",
    categoryId: categoryId!,
    startDate: "2026-08-12",
    endDate: "2026-08-12",
  });
  expect(eventId).toBeTruthy();

  useStore.getState().updateEvent(eventId!, {
    title: "Evento ajustado no exemplo",
    categoryId: categoryId!,
    startDate: "2026-08-13",
    endDate: "2026-08-13",
  });
  expect(useStore.getState().getEventById(eventId!)?.title).toBe(
    "Evento ajustado no exemplo"
  );

  useStore.getState().deleteEvent(eventId!);
  expect(useStore.getState().getEventById(eventId!)).toBeUndefined();
  useStore.getState().resetToOnboardingData();
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
