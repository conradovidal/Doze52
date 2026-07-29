"use client";

import { create } from "zustand";
import { addDays, format, parseISO } from "date-fns";
import { persist } from "zustand/middleware";
import {
  CATEGORY_COLOR_BASE_AMBER,
  CATEGORY_COLOR_BASE_BLUE,
  CATEGORY_COLOR_BASE_CYAN,
  CATEGORY_COLOR_BASE_GRAPHITE,
  CATEGORY_COLOR_BASE_GREEN,
  CATEGORY_COLOR_BASE_LIME,
  CATEGORY_COLOR_BASE_ORANGE,
  CATEGORY_COLOR_BASE_RED,
  CATEGORY_COLOR_BASE_VIOLET,
  CATEGORY_COLOR_BASE_YELLOW,
  DEFAULT_CATEGORY_COLOR,
  ONBOARDING_CATEGORY_COLOR_BY_ID,
  getNearestCategoryColor,
} from "./category-palette";
import {
  normalizeProfileIconId,
  type ProfileIconId,
} from "./profile-icons";
import type { CalendarEvent, CalendarProfile, CategoryItem } from "./types";
import type {
  OnboardingCategoryChoice,
  OnboardingContext,
} from "./onboarding";
import { formula12026Pack } from "./calendar-packs/formula-1-2026";
import { holidays2026Packs } from "./calendar-packs/holidays-2026";

export type EventInput = {
  title: string;
  categoryId: string;
  startDate: string;
  endDate: string;
  notes?: string;
  recurrenceType?: CalendarEvent["recurrenceType"];
  recurrenceUntil?: string;
};

export type CalendarViewMode = "year" | "quarter" | "month";
const CALENDAR_ZOOM_MIN_PERCENT = 100;
const CALENDAR_ZOOM_MAX_PERCENT = 180;

const clampCalendarZoomPercent = (value: number) =>
  Math.max(
    CALENDAR_ZOOM_MIN_PERCENT,
    Math.min(CALENDAR_ZOOM_MAX_PERCENT, Math.round(value))
  );

type StoreState = {
  profiles: CalendarProfile[];
  selectedProfileIds: string[];
  events: CalendarEvent[];
  categories: CategoryItem[];
  viewMode: CalendarViewMode;
  focusedQuarter: 0 | 1 | 2 | 3 | null;
  focusedMonth: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | null;
  calendarZoomPercent: number;
  replaceAllData: (payload: {
    profiles: CalendarProfile[];
    categories: CategoryItem[];
    events: CalendarEvent[];
  }) => void;
  resetToOnboardingData: () => void;
  loadOnboardingPersonalDemo: (year: number) => void;
  unlockOnboardingPersonalDemo: () => void;
  clearOnboardingPersonalDemo: () => void;
  configureOnboardingContext: (input: {
    context: OnboardingContext;
  }) => boolean;
  createOnboardingCategory: (input: {
    context: OnboardingContext;
    intent: "date" | "period";
    choice: OnboardingCategoryChoice;
    color?: string;
  }) => string | null;
  markLocalImported: (userId: string) => void;
  isLocalImported: (userId: string) => boolean;
  ensureEventMetadata: () => void;
  setSelectedProfiles: (profileIds: string[]) => void;
  toggleSelectedProfile: (profileId: string) => void;
  createProfile: (input: { name: string; icon: ProfileIconId }) => string;
  updateProfile: (
    id: string,
    patch: Partial<Pick<CalendarProfile, "name" | "icon">>
  ) => void;
  deleteProfile: (input: { profileId: string; reassignToProfileId: string }) => void;
  setProfilesOrder: (orderedIds: string[]) => void;
  addEvent: (input: EventInput) => string | null;
  updateEvent: (id: string, input: EventInput) => void;
  moveEventByDelta: (id: string, deltaDays: number) => void;
  reorderEventInDay: (params: { eventId: string; dayIso: string; toIndex: number }) => void;
  normalizeDayOrder: (dayIso: string, eventIdsInDay: string[]) => void;
  deleteEvent: (id: string) => void;
  getEventById: (id: string) => CalendarEvent | undefined;
  setCalendarViewMode: (mode: CalendarViewMode) => void;
  focusQuarter: (quarter: 0 | 1 | 2 | 3) => void;
  focusMonth: (month: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11) => void;
  setCalendarZoomPercent: (percent: number) => void;
  resetCalendarFocusOnYearChange: () => void;
  createCategory: (input: { name: string; color: string; profileId: string }) => string;
  addCategory: (name: string, color: string, profileId?: string) => void;
  updateCategory: (id: string, patch: Partial<Omit<CategoryItem, "id">>) => void;
  deleteCategory: (id: string) => void;
  toggleCategoryVisibility: (id: string) => void;
  setAllCategoriesVisibility: (visible: boolean) => void;
  setCategoriesVisibility: (ids: string[], visible: boolean) => void;
  setCategoriesOrder: (orderedIds: string[]) => void;
  reorderCategories: (sourceId: string, targetId: string) => void;
};

const uid = () => crypto.randomUUID();
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LEGACY_CATEGORY_ID_MAP: Record<string, string> = {
  personal: "33333333-3333-4333-8333-333333333333",
  travel: "22222222-2222-4222-8222-222222222222",
  birthday: "11111111-1111-4111-8111-111111111111",
  work: "33333333-3333-4333-8333-333333333333",
  health: "33333333-3333-4333-8333-333333333333",
  other: "33333333-3333-4333-8333-333333333333",
};

const DEFAULT_PROFILE_COLOR = "#64748B";

const isUuid = (value: string) => UUID_RE.test(value);

const mapLegacyCategoryId = (rawId: string | undefined | null) => {
  if (!rawId) return null;
  return LEGACY_CATEGORY_ID_MAP[rawId] ?? rawId;
};

export const ONBOARDING_PROFILE_IDS = {
  professional: "44444444-4444-4444-8444-444444444441",
  personal: "44444444-4444-4444-8444-444444444442",
  family: "44444444-4444-4444-8444-444444444443",
} as const;

export const ONBOARDING_DEFAULT_PROFILE_ID = ONBOARDING_PROFILE_IDS.personal;

export const ONBOARDING_CATEGORY_IDS = {
  birthday: "11111111-1111-4111-8111-111111111111",
  travel: "22222222-2222-4222-8222-222222222222",
  events: "33333333-3333-4333-8333-333333333333",
  workMeetings: "55555555-5555-4555-8555-555555555551",
  workDeliveries: "55555555-5555-4555-8555-555555555552",
  workTrips: "55555555-5555-4555-8555-555555555553",
  familySchool: "66666666-6666-4666-8666-666666666661",
  familyHealth: "66666666-6666-4666-8666-666666666662",
  familyMoments: "66666666-6666-4666-8666-666666666663",
  customImportantDates: "77777777-7777-4777-8777-777777777771",
  customPeriods: "77777777-7777-4777-8777-777777777772",
  customOther: "77777777-7777-4777-8777-777777777773",
} as const;

export const ONBOARDING_DEFAULT_CATEGORY_ID = ONBOARDING_CATEGORY_IDS.events;
export const ONBOARDING_PERSONAL_DEMO_GROUP_ID =
  "onboarding-personal-demo-v4";
const ONBOARDING_PERSONAL_DEMO_GROUP_IDS = new Set([
  "onboarding-personal-demo-v1",
  "onboarding-personal-demo-v2",
  "onboarding-personal-demo-v3",
  ONBOARDING_PERSONAL_DEMO_GROUP_ID,
]);

export const isOnboardingPersonalDemoGroup = (groupId?: string) =>
  Boolean(groupId && ONBOARDING_PERSONAL_DEMO_GROUP_IDS.has(groupId));

const defaultCategoryColor =
  ONBOARDING_CATEGORY_COLOR_BY_ID[ONBOARDING_DEFAULT_CATEGORY_ID] ??
  DEFAULT_CATEGORY_COLOR;

const getLegacyDefaultProfiles = (): CalendarProfile[] => [
  {
    id: ONBOARDING_PROFILE_IDS.personal,
    name: "Pessoal",
    color: DEFAULT_PROFILE_COLOR,
    icon: "user",
    position: 0,
  },
];

const getNeutralDefaultProfiles = (): CalendarProfile[] => [
  {
    id: ONBOARDING_PROFILE_IDS.personal,
    name: "Meu ano",
    color: DEFAULT_PROFILE_COLOR,
    icon: "calendar-days",
    position: 0,
  },
];

const getFeatureDefaultProfiles = (): CalendarProfile[] => [
  {
    id: ONBOARDING_PROFILE_IDS.professional,
    name: "Profissional",
    color: DEFAULT_PROFILE_COLOR,
    icon: "briefcase",
    position: 0,
  },
  {
    id: ONBOARDING_PROFILE_IDS.personal,
    name: "Pessoal",
    color: DEFAULT_PROFILE_COLOR,
    icon: "user",
    position: 1,
  },
  {
    id: ONBOARDING_PROFILE_IDS.family,
    name: "Familia",
    color: DEFAULT_PROFILE_COLOR,
    icon: "users",
    position: 2,
  },
];

const getPersonalDemoProfiles = (): CalendarProfile[] => [
  {
    id: ONBOARDING_PROFILE_IDS.personal,
    name: "Pessoal",
    color: DEFAULT_PROFILE_COLOR,
    icon: "user",
    position: 0,
  },
  {
    id: ONBOARDING_PROFILE_IDS.professional,
    name: "Profissional",
    color: DEFAULT_PROFILE_COLOR,
    icon: "briefcase",
    position: 1,
  },
];

export const getOnboardingDefaultProfiles = (): CalendarProfile[] => {
  return getNeutralDefaultProfiles().map((profile) => ({ ...profile }));
};

export const isOnboardingProfilesSnapshot = (profiles: CalendarProfile[]) => {
  const candidates = [
    getOnboardingDefaultProfiles(),
    getLegacyDefaultProfiles(),
    getFeatureDefaultProfiles(),
  ];
  return candidates.some((expected) => {
    if (profiles.length !== expected.length) return false;
    return expected.every((defaultProfile, index) => {
      const received = profiles[index];
      if (!received) return false;
      return (
        received.id === defaultProfile.id &&
        received.name === defaultProfile.name &&
        received.color.toLowerCase() === defaultProfile.color.toLowerCase() &&
        received.icon === defaultProfile.icon &&
        received.position === defaultProfile.position
      );
    });
  });
};

const getLegacyDefaultCategories = (): CategoryItem[] => [
  {
    id: ONBOARDING_CATEGORY_IDS.birthday,
    profileId: ONBOARDING_PROFILE_IDS.personal,
    name: "Aniversarios",
    color: ONBOARDING_CATEGORY_COLOR_BY_ID[ONBOARDING_CATEGORY_IDS.birthday],
    visible: true,
  },
  {
    id: ONBOARDING_CATEGORY_IDS.travel,
    profileId: ONBOARDING_PROFILE_IDS.personal,
    name: "Ferias/Viagens",
    color: ONBOARDING_CATEGORY_COLOR_BY_ID[ONBOARDING_CATEGORY_IDS.travel],
    visible: true,
  },
  {
    id: ONBOARDING_CATEGORY_IDS.events,
    profileId: ONBOARDING_PROFILE_IDS.personal,
    name: "Eventos",
    color: ONBOARDING_CATEGORY_COLOR_BY_ID[ONBOARDING_CATEGORY_IDS.events],
    visible: true,
  },
];

const getFeatureDefaultCategories = (): CategoryItem[] => [
  {
    id: ONBOARDING_CATEGORY_IDS.workMeetings,
    profileId: ONBOARDING_PROFILE_IDS.professional,
    name: "Reunioes",
    color: CATEGORY_COLOR_BASE_BLUE,
    visible: true,
  },
  {
    id: ONBOARDING_CATEGORY_IDS.workDeliveries,
    profileId: ONBOARDING_PROFILE_IDS.professional,
    name: "Entregas",
    color: CATEGORY_COLOR_BASE_VIOLET,
    visible: true,
  },
  {
    id: ONBOARDING_CATEGORY_IDS.workTrips,
    profileId: ONBOARDING_PROFILE_IDS.professional,
    name: "Viagens Trabalho",
    color: CATEGORY_COLOR_BASE_CYAN,
    visible: true,
  },
  {
    id: ONBOARDING_CATEGORY_IDS.birthday,
    profileId: ONBOARDING_PROFILE_IDS.personal,
    name: "Aniversarios",
    color: ONBOARDING_CATEGORY_COLOR_BY_ID[ONBOARDING_CATEGORY_IDS.birthday],
    visible: true,
  },
  {
    id: ONBOARDING_CATEGORY_IDS.travel,
    profileId: ONBOARDING_PROFILE_IDS.personal,
    name: "Ferias/Viagens",
    color: ONBOARDING_CATEGORY_COLOR_BY_ID[ONBOARDING_CATEGORY_IDS.travel],
    visible: true,
  },
  {
    id: ONBOARDING_CATEGORY_IDS.events,
    profileId: ONBOARDING_PROFILE_IDS.personal,
    name: "Eventos",
    color: ONBOARDING_CATEGORY_COLOR_BY_ID[ONBOARDING_CATEGORY_IDS.events],
    visible: true,
  },
  {
    id: ONBOARDING_CATEGORY_IDS.familySchool,
    profileId: ONBOARDING_PROFILE_IDS.family,
    name: "Escola",
    color: CATEGORY_COLOR_BASE_GREEN,
    visible: true,
  },
  {
    id: ONBOARDING_CATEGORY_IDS.familyHealth,
    profileId: ONBOARDING_PROFILE_IDS.family,
    name: "Saude Familia",
    color: CATEGORY_COLOR_BASE_AMBER,
    visible: true,
  },
  {
    id: ONBOARDING_CATEGORY_IDS.familyMoments,
    profileId: ONBOARDING_PROFILE_IDS.family,
    name: "Momentos",
    color: CATEGORY_COLOR_BASE_LIME,
    visible: true,
  },
];

const DEMO_CATEGORY_IDS = {
  friends: "99999999-0001-4000-8000-000000000002",
  family: "99999999-0001-4000-8000-000000000003",
  holidays: "99999999-0001-4000-8000-000000000004",
  formula1: "99999999-0001-4000-8000-000000000007",
  workEvents: "99999999-0001-4000-8000-000000000008",
} as const;

const demoCategory = (
  id: string,
  profileId: string,
  name: string,
  color: string,
  visible = true
): CategoryItem => ({
  id,
  profileId,
  name,
  color,
  visible,
  calendarPackGroupId: ONBOARDING_PERSONAL_DEMO_GROUP_ID,
});

const getPersonalDemoCategories = (): CategoryItem[] => [
  demoCategory(
    ONBOARDING_CATEGORY_IDS.events,
    ONBOARDING_PROFILE_IDS.personal,
    "Eventos",
    CATEGORY_COLOR_BASE_GRAPHITE
  ),
  demoCategory(
    DEMO_CATEGORY_IDS.family,
    ONBOARDING_PROFILE_IDS.personal,
    "Família",
    CATEGORY_COLOR_BASE_RED
  ),
  demoCategory(
    DEMO_CATEGORY_IDS.friends,
    ONBOARDING_PROFILE_IDS.personal,
    "Amigos",
    CATEGORY_COLOR_BASE_BLUE
  ),
  demoCategory(
    ONBOARDING_CATEGORY_IDS.travel,
    ONBOARDING_PROFILE_IDS.personal,
    "Viagens",
    CATEGORY_COLOR_BASE_GREEN
  ),
  demoCategory(
    ONBOARDING_CATEGORY_IDS.birthday,
    ONBOARDING_PROFILE_IDS.personal,
    "Aniversários",
    CATEGORY_COLOR_BASE_YELLOW
  ),
  demoCategory(
    DEMO_CATEGORY_IDS.holidays,
    ONBOARDING_PROFILE_IDS.personal,
    "Feriados",
    CATEGORY_COLOR_BASE_VIOLET
  ),
  demoCategory(
    DEMO_CATEGORY_IDS.formula1,
    ONBOARDING_PROFILE_IDS.personal,
    "Corridas F1",
    CATEGORY_COLOR_BASE_ORANGE,
    false
  ),
  demoCategory(
    DEMO_CATEGORY_IDS.workEvents,
    ONBOARDING_PROFILE_IDS.professional,
    "Eventos",
    CATEGORY_COLOR_BASE_GRAPHITE
  ),
  demoCategory(
    ONBOARDING_CATEGORY_IDS.workMeetings,
    ONBOARDING_PROFILE_IDS.professional,
    "Agendas importantes",
    CATEGORY_COLOR_BASE_BLUE
  ),
  demoCategory(
    ONBOARDING_CATEGORY_IDS.workTrips,
    ONBOARDING_PROFILE_IDS.professional,
    "Projetos",
    CATEGORY_COLOR_BASE_VIOLET
  ),
  demoCategory(
    ONBOARDING_CATEGORY_IDS.workDeliveries,
    ONBOARDING_PROFILE_IDS.professional,
    "Entregas",
    CATEGORY_COLOR_BASE_ORANGE
  ),
];

const toDemoIsoDate = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const getCarnivalRange = (year: number) => {
  const ranges: Record<number, [string, string]> = {
    2025: ["2025-03-01", "2025-03-05"],
    2026: ["2026-02-14", "2026-02-18"],
    2027: ["2027-02-06", "2027-02-10"],
  };
  return (
    ranges[year] ?? [
      toDemoIsoDate(year, 2, 14),
      toDemoIsoDate(year, 2, 18),
    ]
  );
};

type PersonalDemoEventInput = {
  key: string;
  title: string;
  categoryId: string;
  startDate: string;
  endDate?: string;
  recurrenceType?: CalendarEvent["recurrenceType"];
};

const getPersonalDemoEvents = (year: number): CalendarEvent[] => {
  const [carnivalStart, carnivalEnd] = getCarnivalRange(year);
  const eventInputs: PersonalDemoEventInput[] = [
    {
      key: "summer-festival",
      title: "Festival de verão",
      categoryId: ONBOARDING_CATEGORY_IDS.events,
      startDate: toDemoIsoDate(year, 1, 17),
    },
    {
      key: "food-fair",
      title: "Feira gastronômica",
      categoryId: ONBOARDING_CATEGORY_IDS.events,
      startDate: toDemoIsoDate(year, 2, 7),
    },
    {
      key: "music-festival",
      title: "Festival de música",
      categoryId: ONBOARDING_CATEGORY_IDS.events,
      startDate: toDemoIsoDate(year, 3, 14),
      endDate: toDemoIsoDate(year, 3, 15),
    },
    {
      key: "theater-play",
      title: "Peça de teatro",
      categoryId: ONBOARDING_CATEGORY_IDS.events,
      startDate: toDemoIsoDate(year, 4, 25),
    },
    {
      key: "araujo-vianna-concert",
      title: "Show no Araújo Vianna",
      categoryId: ONBOARDING_CATEGORY_IDS.events,
      startDate: toDemoIsoDate(year, 5, 16),
    },
    {
      key: "neighborhood-party",
      title: "Festa do bairro",
      categoryId: ONBOARDING_CATEGORY_IDS.events,
      startDate: toDemoIsoDate(year, 6, 20),
    },
    {
      key: "winter-festival",
      title: "Festival de inverno",
      categoryId: ONBOARDING_CATEGORY_IDS.events,
      startDate: toDemoIsoDate(year, 7, 11),
    },
    {
      key: "film-showcase",
      title: "Mostra de cinema",
      categoryId: ONBOARDING_CATEGORY_IDS.events,
      startDate: toDemoIsoDate(year, 8, 15),
    },
    {
      key: "design-fair",
      title: "Feira de design",
      categoryId: ONBOARDING_CATEGORY_IDS.events,
      startDate: toDemoIsoDate(year, 9, 5),
    },
    {
      key: "book-fair",
      title: "Feira do Livro",
      categoryId: ONBOARDING_CATEGORY_IDS.events,
      startDate: toDemoIsoDate(year, 10, 30),
      endDate: toDemoIsoDate(year, 11, 15),
    },
    {
      key: "year-end-concert",
      title: "Show de fim de ano",
      categoryId: ONBOARDING_CATEGORY_IDS.events,
      startDate: toDemoIsoDate(year, 11, 21),
    },
    {
      key: "christmas-concert",
      title: "Concerto de Natal",
      categoryId: ONBOARDING_CATEGORY_IDS.events,
      startDate: toDemoIsoDate(year, 12, 12),
    },
    {
      key: "kids-summer-break",
      title: "Férias de verão",
      categoryId: DEMO_CATEGORY_IDS.family,
      startDate: toDemoIsoDate(year, 1, 2),
      endDate: toDemoIsoDate(year, 1, 18),
    },
    {
      key: "family-lunch-parents",
      title: "Almoço com os pais",
      categoryId: DEMO_CATEGORY_IDS.family,
      startDate: toDemoIsoDate(year, 1, 25),
    },
    {
      key: "school-year-start",
      title: "Volta às aulas",
      categoryId: DEMO_CATEGORY_IDS.family,
      startDate: toDemoIsoDate(year, 2, 18),
    },
    {
      key: "family-march-lunch",
      title: "Almoço em família",
      categoryId: DEMO_CATEGORY_IDS.family,
      startDate: toDemoIsoDate(year, 3, 8),
    },
    {
      key: "family-easter",
      title: "Páscoa em família",
      categoryId: DEMO_CATEGORY_IDS.family,
      startDate: toDemoIsoDate(year, 4, 5),
    },
    {
      key: "mothers-day",
      title: "Dia das Mães",
      categoryId: DEMO_CATEGORY_IDS.family,
      startDate: toDemoIsoDate(year, 5, 10),
    },
    {
      key: "wedding-anniversary",
      title: "Aniversário de casamento",
      categoryId: DEMO_CATEGORY_IDS.family,
      startDate: toDemoIsoDate(year, 5, 23),
    },
    {
      key: "school-june-party",
      title: "Festa junina da escola",
      categoryId: DEMO_CATEGORY_IDS.family,
      startDate: toDemoIsoDate(year, 6, 27),
    },
    {
      key: "kids-winter-break",
      title: "Férias das crianças",
      categoryId: DEMO_CATEGORY_IDS.family,
      startDate: toDemoIsoDate(year, 7, 20),
      endDate: toDemoIsoDate(year, 8, 2),
    },
    {
      key: "school-second-semester",
      title: "Volta às aulas",
      categoryId: DEMO_CATEGORY_IDS.family,
      startDate: toDemoIsoDate(year, 8, 3),
    },
    {
      key: "grandparents-sunday",
      title: "Domingo com os avós",
      categoryId: DEMO_CATEGORY_IDS.family,
      startDate: toDemoIsoDate(year, 9, 27),
    },
    {
      key: "childrens-day",
      title: "Dia das Crianças",
      categoryId: DEMO_CATEGORY_IDS.family,
      startDate: toDemoIsoDate(year, 10, 12),
    },
    {
      key: "school-showcase",
      title: "Apresentação da escola",
      categoryId: DEMO_CATEGORY_IDS.family,
      startDate: toDemoIsoDate(year, 11, 28),
    },
    {
      key: "school-year-end",
      title: "Encerramento das aulas",
      categoryId: DEMO_CATEGORY_IDS.family,
      startDate: toDemoIsoDate(year, 12, 18),
    },
    {
      key: "family-christmas",
      title: "Natal em família",
      categoryId: DEMO_CATEGORY_IDS.family,
      startDate: toDemoIsoDate(year, 12, 24),
      endDate: toDemoIsoDate(year, 12, 26),
    },
    ...[
      [1, 10, "Jantar da turma"],
      [1, 31, "Almoço de verão com os amigos"],
      [2, 7, "Churrasco no parque"],
      [2, 27, "Cinema com os amigos"],
      [3, 6, "Happy hour"],
      [3, 21, "Noite de jogos"],
      [4, 11, "Brunch de sábado"],
      [4, 25, "Encontro da faculdade"],
      [5, 9, "Jantar em casa"],
      [5, 30, "Bar com a turma"],
      [6, 13, "Casamento da Ana e do Lucas"],
      [6, 26, "Arraiá dos amigos"],
      [7, 4, "Café com a Júlia"],
      [7, 18, "Piquenique no parque"],
      [8, 22, "Noite de fondue"],
      [9, 19, "Churrasco de primavera"],
      [10, 10, "Reencontro da turma"],
      [11, 7, "Cinema e jantar"],
      [12, 19, "Amigo secreto"],
    ].map(([month, day, title], index) => ({
      key: `friends-${index + 1}`,
      title: String(title),
      categoryId: DEMO_CATEGORY_IDS.friends,
      startDate: toDemoIsoDate(year, Number(month), Number(day)),
    })),
    {
      key: "carnival-paraty",
      title: "Carnaval em Paraty",
      categoryId: ONBOARDING_CATEGORY_IDS.travel,
      startDate: carnivalStart,
      endDate: carnivalEnd,
    },
    {
      key: "bento-goncalves-weekend",
      title: "Fim de semana em Bento Gonçalves",
      categoryId: ONBOARDING_CATEGORY_IDS.travel,
      startDate: toDemoIsoDate(year, 4, 18),
      endDate: toDemoIsoDate(year, 4, 21),
    },
    {
      key: "gramado-weekend",
      title: "Fim de semana em Gramado",
      categoryId: ONBOARDING_CATEGORY_IDS.travel,
      startDate: toDemoIsoDate(year, 5, 29),
      endDate: toDemoIsoDate(year, 5, 31),
    },
    {
      key: "maceio-family-holidays",
      title: "Férias em família — Maceió",
      categoryId: ONBOARDING_CATEGORY_IDS.travel,
      startDate: toDemoIsoDate(year, 7, 25),
      endDate: toDemoIsoDate(year, 7, 30),
    },
    {
      key: "florianopolis-holiday",
      title: "Feriado em Florianópolis",
      categoryId: ONBOARDING_CATEGORY_IDS.travel,
      startDate: toDemoIsoDate(year, 9, 5),
      endDate: toDemoIsoDate(year, 9, 7),
    },
    {
      key: "new-year-tiradentes",
      title: "Ano Novo em Tiradentes",
      categoryId: ONBOARDING_CATEGORY_IDS.travel,
      startDate: toDemoIsoDate(year, 12, 27),
      endDate: toDemoIsoDate(year + 1, 1, 3),
    },
    ...[
      [2, 8, "Aniversário da mãe"],
      [3, 3, "Aniversário da Carla"],
      [4, 21, "Aniversário da Lia"],
      [5, 16, "Aniversário do pai"],
      [6, 22, "Aniversário do Pedro"],
      [7, 12, "Aniversário da Ana"],
      [8, 29, "Aniversário do Lucas"],
      [9, 12, "Aniversário do Bruno"],
      [11, 6, "Aniversário da Marina"],
      [12, 2, "Aniversário da Renata"],
    ].map(([month, day, title], index) => ({
      key: `birthday-${index + 1}`,
      title: String(title),
      categoryId: ONBOARDING_CATEGORY_IDS.birthday,
      startDate: toDemoIsoDate(year, Number(month), Number(day)),
      recurrenceType: "yearly" as const,
    })),
    {
      key: "strategy-planning",
      title: "Planejamento estratégico",
      categoryId: DEMO_CATEGORY_IDS.workEvents,
      startDate: toDemoIsoDate(year, 1, 12),
      endDate: toDemoIsoDate(year, 1, 16),
    },
    ...[
      [4, 6, "Q1"],
      [7, 6, "Q2"],
      [10, 5, "Q3"],
      [12, 14, "Q4"],
    ].map(([month, day, quarter]) => ({
      key: `results-${quarter}`,
      title: `Revisão de resultados ${quarter}`,
      categoryId: DEMO_CATEGORY_IDS.workEvents,
      startDate: toDemoIsoDate(year, Number(month), Number(day)),
    })),
    ...[
      [2, 6],
      [5, 8],
      [8, 7],
      [11, 6],
    ].map(([month, day], index) => ({
      key: `all-hands-${index + 1}`,
      title: "All Hands",
      categoryId: ONBOARDING_CATEGORY_IDS.workMeetings,
      startDate: toDemoIsoDate(year, month, day),
    })),
    ...[
      [4, 9],
      [7, 9],
      [10, 8],
    ].map(([month, day], index) => ({
      key: `qbr-${index + 1}`,
      title: "QBR",
      categoryId: ONBOARDING_CATEGORY_IDS.workMeetings,
      startDate: toDemoIsoDate(year, month, day),
    })),
    {
      key: "mobile-experience",
      title: "Nova experiência mobile",
      categoryId: ONBOARDING_CATEGORY_IDS.workTrips,
      startDate: toDemoIsoDate(year, 2, 2),
      endDate: toDemoIsoDate(year, 5, 29),
    },
    {
      key: "smb-expansion",
      title: "Expansão para PMEs",
      categoryId: ONBOARDING_CATEGORY_IDS.workTrips,
      startDate: toDemoIsoDate(year, 4, 13),
      endDate: toDemoIsoDate(year, 8, 28),
    },
    {
      key: "onboarding-evolution",
      title: "Evolução do onboarding",
      categoryId: ONBOARDING_CATEGORY_IDS.workTrips,
      startDate: toDemoIsoDate(year, 8, 3),
      endDate: toDemoIsoDate(year, 11, 13),
    },
    ...[
      [1, 23, "Roadmap do semestre"],
      [3, 20, "Protótipo validado"],
      [6, 18, "Lançamento mobile"],
      [9, 25, "Relatório para o conselho"],
      [12, 4, "Plano do próximo ano"],
    ].map(([month, day, title]) => ({
      key: `delivery-${String(title).toLowerCase().replaceAll(" ", "-")}`,
      title: String(title),
      categoryId: ONBOARDING_CATEGORY_IDS.workDeliveries,
      startDate: toDemoIsoDate(year, Number(month), Number(day)),
    })),
  ];

  const holidayPack = holidays2026Packs.find(
    (pack) => pack.regionCode === "RS" && pack.year === year
  );
  const holidayEvents: PersonalDemoEventInput[] = holidayPack
    ? holidayPack.events.map((event) => ({
        key: `holiday-${event.id}`,
        title: event.title,
        categoryId: DEMO_CATEGORY_IDS.holidays,
        startDate: event.date,
        recurrenceType: event.recurrenceType,
      }))
    : [
        [1, 1, "Confraternização Universal"],
        [4, 21, "Tiradentes"],
        [5, 1, "Dia do Trabalho"],
        [9, 20, "Revolução Farroupilha"],
        [12, 25, "Natal"],
      ].map(([month, day, title]) => ({
        key: `holiday-${month}-${day}`,
        title: String(title),
        categoryId: DEMO_CATEGORY_IDS.holidays,
        startDate: toDemoIsoDate(year, Number(month), Number(day)),
        recurrenceType: "yearly" as const,
      }));

  const formulaEvents: PersonalDemoEventInput[] =
    formula12026Pack.year === year
      ? formula12026Pack.events.map((event) => ({
          key: `f1-${event.id}`,
          title: event.title,
          categoryId: DEMO_CATEGORY_IDS.formula1,
          startDate: event.date,
        }))
      : [];
  const allEventInputs = [
    ...eventInputs,
    ...holidayEvents,
    ...formulaEvents,
  ];
  const categoryColorById = new Map(
    getPersonalDemoCategories().map((category) => [
      category.id,
      category.color,
    ])
  );

  return allEventInputs.map((event, index) => ({
    id: `88888888-8888-4888-8${String(index).padStart(3, "0")}-888888888888`,
    title: event.title,
    categoryId: event.categoryId,
    color: categoryColorById.get(event.categoryId) ?? defaultCategoryColor,
    startDate: event.startDate,
    endDate: event.endDate ?? event.startDate,
    recurrenceType: event.recurrenceType,
    createdAt: `${year}-01-01T00:00:00.${String(index).padStart(3, "0")}Z`,
    dayOrder: 0,
    calendarPackGroupId: ONBOARDING_PERSONAL_DEMO_GROUP_ID,
    calendarPackEventKey: event.key,
  }));
};

export type OnboardingPersonalDemoSnapshot = {
  profiles: CalendarProfile[];
  categories: CategoryItem[];
  events: CalendarEvent[];
};

export const getOnboardingPersonalDemoSnapshot = (
  year: number
): OnboardingPersonalDemoSnapshot => ({
  profiles: getPersonalDemoProfiles().map((profile) => ({ ...profile })),
  categories: getPersonalDemoCategories().map((category) => ({ ...category })),
  events: getPersonalDemoEvents(year).map((event) => ({ ...event })),
});

export const isOnboardingPersonalDemoSnapshot = (
  snapshot: OnboardingPersonalDemoSnapshot
) =>
  (snapshot.categories.length === 6 ||
    snapshot.categories.length === 11 ||
    snapshot.categories.length === 14) &&
  snapshot.events.length > 0 &&
  snapshot.categories.every((category) =>
    isOnboardingPersonalDemoGroup(category.calendarPackGroupId)
  ) &&
  snapshot.events.every((event) =>
    isOnboardingPersonalDemoGroup(event.calendarPackGroupId)
  );

export const stripOnboardingPersonalDemo = (
  snapshot: OnboardingPersonalDemoSnapshot
): OnboardingPersonalDemoSnapshot => {
  const categories = snapshot.categories.filter(
    (category) => !isOnboardingPersonalDemoGroup(category.calendarPackGroupId)
  );
  const events = snapshot.events.filter(
    (event) => !isOnboardingPersonalDemoGroup(event.calendarPackGroupId)
  );

  if (
    categories.length === snapshot.categories.length &&
    events.length === snapshot.events.length
  ) {
    return snapshot;
  }

  const referencedProfileIds = new Set(
    categories.map((category) => category.profileId)
  );
  const profiles = snapshot.profiles.filter((profile) =>
    referencedProfileIds.has(profile.id)
  );

  return {
    profiles:
      profiles.length > 0 ? profiles : getOnboardingDefaultProfiles(),
    categories,
    events,
  };
};

export const getOnboardingCategoryDefinition = (
  context: OnboardingContext,
  intent: "date" | "period",
  choice: OnboardingCategoryChoice
) => {
  if (choice === "generic") {
    return intent === "date"
      ? {
          id: ONBOARDING_CATEGORY_IDS.customImportantDates,
          name: "Datas importantes",
          color: CATEGORY_COLOR_BASE_BLUE,
        }
      : {
          id: ONBOARDING_CATEGORY_IDS.customPeriods,
          name: "Períodos importantes",
          color: CATEGORY_COLOR_BASE_VIOLET,
        };
  }
  if (context === "personal") {
    return intent === "date"
      ? {
          id: ONBOARDING_CATEGORY_IDS.birthday,
          name: "Aniversários",
          color: CATEGORY_COLOR_BASE_AMBER,
        }
      : {
          id: ONBOARDING_CATEGORY_IDS.travel,
          name: "Férias e viagens",
          color: CATEGORY_COLOR_BASE_CYAN,
        };
  }
  return intent === "date"
    ? {
        id: ONBOARDING_CATEGORY_IDS.workDeliveries,
        name: "Entregas",
        color: CATEGORY_COLOR_BASE_ORANGE,
      }
    : {
        id: ONBOARDING_CATEGORY_IDS.workTrips,
        name: "Projetos",
        color: CATEGORY_COLOR_BASE_GREEN,
      };
};

const getTemplateCategories = (options?: { legacyOnly?: boolean }) => {
  if (options?.legacyOnly) return getLegacyDefaultCategories();
  return [];
};

export const ONBOARDING_DEFAULT_CATEGORIES: CategoryItem[] = getTemplateCategories();

export const getOnboardingDefaultCategories = (): CategoryItem[] =>
  getTemplateCategories().map((category) => ({ ...category }));

export const isOnboardingCategoriesSnapshot = (categories: CategoryItem[]) => {
  const candidates = [
    getOnboardingDefaultCategories(),
    getLegacyDefaultCategories(),
    getFeatureDefaultCategories(),
  ];
  return candidates.some((expected) => {
    if (categories.length !== expected.length) return false;
    return expected.every((defaultCategory, index) => {
      const received = categories[index];
      if (!received) return false;
      return (
        received.id === defaultCategory.id &&
        received.profileId === defaultCategory.profileId &&
        received.name === defaultCategory.name &&
        received.color.toLowerCase() === defaultCategory.color.toLowerCase() &&
        received.visible === defaultCategory.visible
      );
    });
  });
};

const defaultProfiles: CalendarProfile[] = getOnboardingDefaultProfiles();
const defaultProfileId = ONBOARDING_DEFAULT_PROFILE_ID;
const defaultCategoryId = ONBOARDING_DEFAULT_CATEGORY_ID;

const getAllProfileIds = (profiles: CalendarProfile[]) => profiles.map((profile) => profile.id);

const ensureSelectedProfileIds = (
  selectedIds: string[] | undefined,
  profiles: CalendarProfile[]
) => {
  if (profiles.length === 0) return [];
  const allProfileIds = getAllProfileIds(profiles);
  const valid = new Set(allProfileIds);
  const next = (selectedIds ?? []).filter((id, index, arr) => {
    if (!valid.has(id)) return false;
    return arr.indexOf(id) === index;
  });
  return next.length > 0 ? [next[0]] : [allProfileIds[0]];
};

const normalizePersistedProfiles = (
  persistedProfiles: CalendarProfile[] | undefined,
  options: { forLegacyData: boolean }
) => {
  const fallback = options.forLegacyData
    ? getLegacyDefaultProfiles()
    : getOnboardingDefaultProfiles();
  const source =
    persistedProfiles && persistedProfiles.length > 0 ? persistedProfiles : fallback;
  const seen = new Set<string>();
  const next: CalendarProfile[] = [];

  for (const profile of source) {
    const normalizedId =
      profile.id && profile.id.trim() && isUuid(profile.id) ? profile.id : uid();
    if (seen.has(normalizedId)) continue;
    seen.add(normalizedId);
    const normalizedName = profile.name?.trim() || "Contexto";
    const normalizedColor = DEFAULT_PROFILE_COLOR;
    next.push({
      ...profile,
      id: normalizedId,
      name: normalizedName,
      color: normalizedColor,
      icon: normalizeProfileIconId(
        (profile as { icon?: unknown }).icon,
        normalizedName
      ),
      position: next.length,
    });
  }

  return next.length > 0 ? next : fallback;
};

const normalizePersistedCategories = (
  persistedCategories: CategoryItem[] | undefined,
  profiles: CalendarProfile[],
  options: { forLegacyData: boolean }
) => {
  const fallbackCategories = options.forLegacyData
    ? getTemplateCategories({ legacyOnly: true })
    : getOnboardingDefaultCategories();
  const source =
    persistedCategories && persistedCategories.length > 0
      ? persistedCategories
      : fallbackCategories;
  const profileIds = new Set(profiles.map((profile) => profile.id));
  const fallbackProfileId = profileIds.has(defaultProfileId)
    ? defaultProfileId
    : (profiles[0]?.id ?? defaultProfileId);
  const seen = new Set<string>();
  const next: CategoryItem[] = [];

  for (const category of source) {
    const mappedCategoryId = mapLegacyCategoryId(category.id);
    const normalizedCategoryId =
      mappedCategoryId && mappedCategoryId.trim() && isUuid(mappedCategoryId)
        ? mappedCategoryId
        : uid();
    if (seen.has(normalizedCategoryId)) continue;
    seen.add(normalizedCategoryId);

    const normalizedProfileId =
      category.profileId && profileIds.has(category.profileId)
        ? category.profileId
        : fallbackProfileId;

    next.push({
      ...category,
      id: normalizedCategoryId,
      profileId: normalizedProfileId,
      name: category.name?.trim() || "Categoria",
      color:
        typeof category.color === "string" && category.color.trim().length > 0
          ? category.color
          : defaultCategoryColor,
      visible: typeof category.visible === "boolean" ? category.visible : true,
    });
  }

  return next.length > 0 ? next : getOnboardingDefaultCategories();
};

const normalizeEventDayOrder = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Math.max(0, Math.trunc(Number(value)));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const candidates = Object.values(value)
      .filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
      .map((entry) => Math.trunc(entry))
      .filter((entry) => entry >= 0);
    if (candidates.length > 0) return Math.min(...candidates);
  }
  return 0;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isIsoDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const parsed = parseISO(value);
  return !Number.isNaN(parsed.getTime());
};

const normalizeRecurrenceType = (
  value: unknown
): CalendarEvent["recurrenceType"] | undefined => {
  if (
    value === "weekly" ||
    value === "biweekly" ||
    value === "monthly" ||
    value === "yearly"
  ) {
    return value;
  }
  return undefined;
};

const normalizeRecurrenceUntil = (params: {
  value: unknown;
  recurrenceType: CalendarEvent["recurrenceType"];
  startDate: string;
}): string | undefined => {
  if (!params.recurrenceType || !isIsoDate(params.value)) return undefined;
  if (params.value < params.startDate) return undefined;
  return params.value;
};

const isSingleDayEvent = (evt: Pick<CalendarEvent, "startDate" | "endDate">) =>
  evt.startDate === evt.endDate;

const getQuarterFromMonth = (
  month: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11
): 0 | 1 | 2 | 3 => Math.floor(month / 3) as 0 | 1 | 2 | 3;

const nextSingleDayOrder = (events: CalendarEvent[], dayIso: string) => {
  const maxValue = events
    .filter((evt) => isSingleDayEvent(evt) && evt.startDate === dayIso)
    .reduce((acc, evt) => Math.max(acc, normalizeEventDayOrder(evt.dayOrder)), -1);
  return maxValue + 1;
};

const nextMultiDayOrder = (events: CalendarEvent[]) => {
  const maxValue = events
    .filter((evt) => !isSingleDayEvent(evt))
    .reduce((acc, evt) => Math.max(acc, normalizeEventDayOrder(evt.dayOrder)), -1);
  return maxValue + 1;
};

type LegacyEvent = Partial<CalendarEvent> & { category?: string };
type PersistedState = {
  profiles?: CalendarProfile[];
  selectedProfileIds?: string[];
  categories?: CategoryItem[];
  events?: LegacyEvent[];
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      profiles: getOnboardingDefaultProfiles(),
      selectedProfileIds: ensureSelectedProfileIds(undefined, defaultProfiles),
      events: [],
      categories: getOnboardingDefaultCategories(),
      viewMode: "year",
      focusedQuarter: null,
      focusedMonth: null,
      calendarZoomPercent: CALENDAR_ZOOM_MIN_PERCENT,
      replaceAllData: ({ profiles, categories, events }) =>
        set((state) => {
          const hasLegacyData = categories.length > 0 || events.length > 0;
          const nextProfiles = normalizePersistedProfiles(profiles, {
            forLegacyData: hasLegacyData && profiles.length === 0,
          });
          const nextCategories = normalizePersistedCategories(categories, nextProfiles, {
            forLegacyData: hasLegacyData && categories.length === 0,
          });
          return {
            profiles: nextProfiles,
            selectedProfileIds: ensureSelectedProfileIds(
              state.selectedProfileIds,
              nextProfiles
            ),
            categories: nextCategories,
            events,
          };
        }),
      resetToOnboardingData: () =>
        set(() => {
          const profiles = getOnboardingDefaultProfiles();
          return {
            profiles,
            selectedProfileIds: ensureSelectedProfileIds(undefined, profiles),
            categories: getOnboardingDefaultCategories(),
            events: [],
          };
        }),
      loadOnboardingPersonalDemo: (year) =>
        set(() => {
          const snapshot = getOnboardingPersonalDemoSnapshot(year);
          return {
            ...snapshot,
            selectedProfileIds: [ONBOARDING_PROFILE_IDS.personal],
          };
        }),
      unlockOnboardingPersonalDemo: () =>
        set((state) => ({
          categories: state.categories.map((category) =>
            isOnboardingPersonalDemoGroup(category.calendarPackGroupId)
              ? {
                  ...category,
                  calendarPackGroupId: undefined,
                  calendarPackVariantId: undefined,
                  calendarPackCategoryKey: undefined,
                  calendarPackVersion: undefined,
                }
              : category
          ),
          events: state.events.map((event) =>
            isOnboardingPersonalDemoGroup(event.calendarPackGroupId)
              ? {
                  ...event,
                  calendarPackGroupId: undefined,
                  calendarPackEventKey: undefined,
                }
              : event
          ),
        })),
      clearOnboardingPersonalDemo: () =>
        set((state) => {
          if (
            !isOnboardingPersonalDemoSnapshot({
              profiles: state.profiles,
              categories: state.categories,
              events: state.events,
            })
          ) {
            return state;
          }
          const profiles = getOnboardingDefaultProfiles();
          return {
            profiles,
            selectedProfileIds: ensureSelectedProfileIds(undefined, profiles),
            categories: getOnboardingDefaultCategories(),
            events: [],
          };
        }),
      configureOnboardingContext: ({ context }) => {
        let configured = false;
        set((state) => {
          if (state.events.some((event) => !event.calendarPackGroupId)) {
            return state;
          }
          const name =
            context === "personal"
              ? "Pessoal"
              : "Profissional";
          const icon =
            context === "personal"
              ? "user"
              : "briefcase";
          const id =
            context === "personal"
              ? ONBOARDING_PROFILE_IDS.personal
              : ONBOARDING_PROFILE_IDS.professional;
          const profile: CalendarProfile = {
            id,
            name,
            color: DEFAULT_PROFILE_COLOR,
            icon,
            position: 0,
          };

          configured = true;
          return {
            profiles: [profile],
            selectedProfileIds: [id],
            categories: [],
            events: [],
          };
        });
        return configured;
      },
      createOnboardingCategory: ({ context, intent, choice, color }) => {
        const definition = getOnboardingCategoryDefinition(
          context,
          intent,
          choice
        );
        const categoryColor = getNearestCategoryColor(
          color ?? definition.color
        );
        let createdId: string | null = null;
        set((state) => {
          const profileId =
            state.selectedProfileIds[0] ?? state.profiles[0]?.id ?? null;
          if (!profileId) return state;
          const existing = state.categories.find(
            (category) => category.id === definition.id
          );
          if (existing) {
            createdId = existing.id;
            return state;
          }
          createdId = definition.id;
          return {
            categories: [
              ...state.categories,
              {
                ...definition,
                color: categoryColor,
                profileId,
                visible: true,
              },
            ],
          };
        });
        return createdId;
      },
      markLocalImported: (userId) => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(`imported:${userId}`, "1");
      },
      isLocalImported: (userId) => {
        if (typeof window === "undefined") return false;
        return window.localStorage.getItem(`imported:${userId}`) === "1";
      },
      ensureEventMetadata: () =>
        set((state) => {
          let changed = false;
          const nextEvents = state.events.map((evt, idx) => {
            const id = evt.id ?? uid();
            const createdAt =
              evt.createdAt ?? new Date(Date.UTC(2024, 0, 1, 0, 0, idx)).toISOString();
            const dayOrder = normalizeEventDayOrder(evt.dayOrder);
            const notes =
              typeof evt.notes === "string" && evt.notes.trim().length > 0
                ? evt.notes.trim()
                : undefined;
            if (
              evt.id === id &&
              evt.createdAt === createdAt &&
              evt.dayOrder === dayOrder &&
              evt.notes === notes
            ) {
              return evt;
            }
            changed = true;
            return { ...evt, id, createdAt, dayOrder, notes };
          });
          return changed ? { events: nextEvents } : state;
        }),
      setSelectedProfiles: (profileIds) =>
        set((state) => ({
          selectedProfileIds: ensureSelectedProfileIds(profileIds, state.profiles),
        })),
      toggleSelectedProfile: (profileId) =>
        set((state) => {
          const profileExists = state.profiles.some((profile) => profile.id === profileId);
          if (!profileExists) return state;
          const currentSelectedId = ensureSelectedProfileIds(
            state.selectedProfileIds,
            state.profiles
          )[0];
          if (currentSelectedId === profileId) return state;
          return {
            selectedProfileIds: [profileId],
          };
        }),
      createProfile: (input) => {
        const name = input.name.trim();
        if (!name) return "";
        const id = uid();
        const icon = normalizeProfileIconId(input.icon, name);
        set((state) => {
          const nextProfiles = [
            ...state.profiles,
            {
              id,
              name,
              color: DEFAULT_PROFILE_COLOR,
              icon,
              position: state.profiles.length,
            },
          ];
          return {
            profiles: nextProfiles,
            selectedProfileIds: [id],
          };
        });
        return id;
      },
      updateProfile: (id, patch) =>
        set((state) => ({
          profiles: state.profiles.map((profile) => {
            if (profile.id !== id) return profile;
            const nextName = patch.name?.trim() || profile.name;
            return {
              ...profile,
              name: nextName,
              color: DEFAULT_PROFILE_COLOR,
              icon: normalizeProfileIconId(patch.icon ?? profile.icon, nextName),
            };
          }),
        })),
      deleteProfile: ({ profileId, reassignToProfileId }) =>
        set((state) => {
          if (state.profiles.length <= 1) return state;
          if (!state.profiles.some((profile) => profile.id === profileId)) return state;

          const availableTarget = state.profiles.find(
            (profile) => profile.id === reassignToProfileId && profile.id !== profileId
          );
          const fallbackTarget = state.profiles.find((profile) => profile.id !== profileId);
          const targetProfileId = availableTarget?.id ?? fallbackTarget?.id;
          if (!targetProfileId) return state;

          const nextProfiles = state.profiles
            .filter((profile) => profile.id !== profileId)
            .map((profile, index) => ({ ...profile, position: index }));

          return {
            profiles: nextProfiles,
            selectedProfileIds: ensureSelectedProfileIds(
              state.selectedProfileIds.filter((id) => id !== profileId),
              nextProfiles
            ),
            categories: state.categories.map((category) =>
              category.profileId === profileId
                ? { ...category, profileId: targetProfileId }
                : category
            ),
          };
        }),
      setProfilesOrder: (orderedIds) =>
        set((state) => {
          const byId = new Map(state.profiles.map((profile) => [profile.id, profile]));
          const next: CalendarProfile[] = [];
          for (const id of orderedIds) {
            const found = byId.get(id);
            if (!found) continue;
            next.push(found);
            byId.delete(id);
          }
          for (const profile of state.profiles) {
            if (byId.has(profile.id)) next.push(profile);
          }
          const normalized = next.map((profile, index) => ({
            ...profile,
            position: index,
          }));
          return {
            profiles: normalized,
            selectedProfileIds: ensureSelectedProfileIds(
              state.selectedProfileIds,
              normalized
            ),
          };
        }),
      addEvent: (input) => {
        const id = uid();
        let didAdd = false;
        set((state) => {
          const targetCategory = state.categories.find(
            (category) => category.id === input.categoryId
          );
          if (!targetCategory || targetCategory.calendarPackGroupId) return state;
          didAdd = true;
          const isSingleDay = input.startDate === input.endDate;
          const dayOrder = isSingleDay
            ? nextSingleDayOrder(state.events, input.startDate)
            : nextMultiDayOrder(state.events);
          const recurrenceType = normalizeRecurrenceType(input.recurrenceType);
          const recurrenceUntil = normalizeRecurrenceUntil({
            value: input.recurrenceUntil,
            recurrenceType,
            startDate: input.startDate,
          });
          return {
            events: [
              ...state.events,
              {
                id,
                title: input.title.trim(),
                categoryId: input.categoryId,
                color:
                  state.categories.find((c) => c.id === input.categoryId)?.color ??
                  defaultCategoryColor,
                startDate: input.startDate,
                endDate: input.endDate,
                notes: input.notes?.trim() || undefined,
                recurrenceType,
                recurrenceUntil,
                createdAt: new Date().toISOString(),
                dayOrder,
              },
            ],
          };
        });
        return didAdd ? id : null;
      },
      updateEvent: (id, input) =>
        set((state) => {
          const currentEvent = state.events.find((event) => event.id === id);
          const targetCategory = state.categories.find(
            (category) => category.id === input.categoryId
          );
          if (
            !currentEvent ||
            currentEvent.calendarPackGroupId ||
            !targetCategory ||
            (targetCategory.calendarPackGroupId &&
              targetCategory.id !== currentEvent.categoryId)
          ) {
            return state;
          }
          return {
            events: state.events.map((evt) => {
            if (evt.id !== id) return evt;
            const prevIsSingleDay = isSingleDayEvent(evt);
            const nextIsSingleDay = input.startDate === input.endDate;
            const mustRecalculateOrder = prevIsSingleDay !== nextIsSingleDay;
            const nextOrder = mustRecalculateOrder
              ? nextIsSingleDay
                ? nextSingleDayOrder(
                    state.events.filter((entry) => entry.id !== id),
                    input.startDate
                  )
                : nextMultiDayOrder(state.events.filter((entry) => entry.id !== id))
              : normalizeEventDayOrder(evt.dayOrder);
            const recurrenceType = normalizeRecurrenceType(input.recurrenceType);
            const recurrenceUntil = normalizeRecurrenceUntil({
              value: input.recurrenceUntil,
              recurrenceType,
              startDate: input.startDate,
            });
            return {
              ...evt,
              title: input.title.trim(),
              categoryId: input.categoryId,
              color:
                state.categories.find((c) => c.id === input.categoryId)?.color ??
                evt.color,
              startDate: input.startDate,
              endDate: input.endDate,
              notes: input.notes?.trim() || undefined,
              recurrenceType,
              recurrenceUntil,
              createdAt: evt.createdAt,
              dayOrder: nextOrder,
            };
            }),
          };
        }),
      moveEventByDelta: (id, deltaDays) =>
        set((state) => {
          if (deltaDays === 0) return state;
          if (state.events.find((event) => event.id === id)?.calendarPackGroupId) {
            return state;
          }
          return {
            events: state.events.map((evt) => {
              if (evt.id !== id) return evt;
              const movedStart = addDays(parseISO(evt.startDate), deltaDays);
              const movedEnd = addDays(parseISO(evt.endDate), deltaDays);
              return {
                ...evt,
                startDate: format(movedStart, "yyyy-MM-dd"),
                endDate: format(movedEnd, "yyyy-MM-dd"),
                recurrenceUntil: evt.recurrenceUntil
                  ? format(addDays(parseISO(evt.recurrenceUntil), deltaDays), "yyyy-MM-dd")
                  : undefined,
              };
            }),
          };
        }),
      reorderEventInDay: ({ eventId, dayIso: _dayIso, toIndex }) =>
        set((state) => {
          void _dayIso;
          if (
            state.events.find((event) => event.id === eventId)?.calendarPackGroupId
          ) {
            return state;
          }
          return {
            events: state.events.map((evt) =>
              evt.id === eventId
                ? {
                    ...evt,
                    dayOrder: Math.max(0, toIndex),
                  }
                : evt
            ),
          };
        }),
      normalizeDayOrder: (_dayIso, eventIdsInDay) =>
        set((state) => {
          void _dayIso;
          const eventSet = new Set(eventIdsInDay);
          const normalized = new Map<string, number>();
          eventIdsInDay.forEach((id, idx) => normalized.set(id, idx));

          return {
            events: state.events.map((evt) => {
              if (!eventSet.has(evt.id)) return evt;
              if (evt.calendarPackGroupId) return evt;
              return {
                ...evt,
                dayOrder: normalized.get(evt.id) ?? 0,
              };
            }),
          };
        }),
      deleteEvent: (id) =>
        set((state) => {
          if (state.events.find((event) => event.id === id)?.calendarPackGroupId) {
            return state;
          }
          return { events: state.events.filter((evt) => evt.id !== id) };
        }),
      getEventById: (id) => get().events.find((evt) => evt.id === id),
      setCalendarViewMode: (mode) =>
        set(() => ({
          viewMode: mode,
        })),
      focusQuarter: (quarter) =>
        set(() => ({
          viewMode: "quarter",
          focusedQuarter: quarter,
          focusedMonth: null,
        })),
      focusMonth: (month) =>
        set(() => ({
          viewMode: "month",
          focusedMonth: month,
          focusedQuarter: getQuarterFromMonth(month),
        })),
      setCalendarZoomPercent: (percent) =>
        set(() => ({
          calendarZoomPercent: clampCalendarZoomPercent(percent),
        })),
      resetCalendarFocusOnYearChange: () =>
        set(() => ({
          viewMode: "year",
          focusedQuarter: null,
          focusedMonth: null,
        })),
      createCategory: (input) => {
        const name = input.name.trim();
        if (!name) return "";
        const id = uid();
        set((state) => {
          const fallbackProfileId =
            state.selectedProfileIds[0] ?? state.profiles[0]?.id ?? defaultProfileId;
          const profileId = state.profiles.some((profile) => profile.id === input.profileId)
            ? input.profileId
            : fallbackProfileId;
          return {
            categories: [
              ...state.categories,
              {
                id,
                profileId,
                name,
                color: input.color,
                visible: true,
              },
            ],
          };
        });
        return id;
      },
      addCategory: (name, color, profileId) => {
        const currentProfileId =
          profileId ?? get().selectedProfileIds[0] ?? get().profiles[0]?.id ?? defaultProfileId;
        get().createCategory({ name, color, profileId: currentProfileId });
      },
      updateCategory: (id, patch) =>
        set((state) => {
          const fallbackProfileId = state.profiles[0]?.id ?? defaultProfileId;
          const nextCategories = state.categories.map((c) => {
            if (c.id !== id) return c;
            const nextProfileId =
              patch.profileId && state.profiles.some((profile) => profile.id === patch.profileId)
                ? patch.profileId
                : c.profileId || fallbackProfileId;
            return { ...c, ...patch, profileId: nextProfileId };
          });
          const nextColor = nextCategories.find((c) => c.id === id)?.color;
          return {
            categories: nextCategories,
            events:
              patch.color && nextColor
                ? state.events.map((evt) =>
                    evt.categoryId === id ? { ...evt, color: nextColor } : evt
                  )
                : state.events,
          };
        }),
      deleteCategory: (id) =>
        set((state) => {
          if (state.categories.length <= 1) return state;
          const targetCategory = state.categories.find((category) => category.id === id);
          if (!targetCategory) return state;

          const nextCategories = state.categories.filter((c) => c.id !== id);
          const fallbackSameProfile = nextCategories.find(
            (category) => category.profileId === targetCategory.profileId
          );
          const fallbackCategory = fallbackSameProfile ?? nextCategories[0];
          const fallbackId = fallbackCategory?.id ?? defaultCategoryId;
          const fallbackColor = fallbackCategory?.color ?? defaultCategoryColor;

          return {
            categories: nextCategories,
            events: state.events.map((evt) =>
              evt.categoryId === id
                ? { ...evt, categoryId: fallbackId, color: fallbackColor }
                : evt
            ),
          };
        }),
      toggleCategoryVisibility: (id) =>
        set((state) => ({
          categories: state.categories.map((c) =>
            c.id === id ? { ...c, visible: !c.visible } : c
          ),
        })),
      setAllCategoriesVisibility: (visible) =>
        set((state) => ({
          categories: state.categories.map((c) =>
            c.visible === visible ? c : { ...c, visible }
          ),
        })),
      setCategoriesVisibility: (ids, visible) =>
        set((state) => {
          if (ids.length === 0) return state;
          const targetIds = new Set(ids);
          return {
            categories: state.categories.map((c) =>
              targetIds.has(c.id) && c.visible !== visible ? { ...c, visible } : c
            ),
          };
        }),
      setCategoriesOrder: (orderedIds) =>
        set((state) => {
          const byId = new Map(state.categories.map((c) => [c.id, c]));
          const next: CategoryItem[] = [];
          for (const id of orderedIds) {
            const found = byId.get(id);
            if (!found) continue;
            next.push(found);
            byId.delete(id);
          }
          for (const category of state.categories) {
            if (byId.has(category.id)) next.push(category);
          }
          return { categories: next };
        }),
      reorderCategories: (sourceId, targetId) =>
        set((state) => {
          const sourceIndex = state.categories.findIndex((c) => c.id === sourceId);
          const targetIndex = state.categories.findIndex((c) => c.id === targetId);
          if (
            sourceIndex === -1 ||
            targetIndex === -1 ||
            sourceIndex === targetIndex
          ) {
            return state;
          }
          const next = [...state.categories];
          const [moved] = next.splice(sourceIndex, 1);
          next.splice(targetIndex, 0, moved);
          return { categories: next };
        }),
    }),
    {
      name: "yiv-store",
      version: 9,
      partialize: (state): PersistedState => ({
        profiles: state.profiles,
        selectedProfileIds: state.selectedProfileIds,
        categories: state.categories,
        events: state.events as LegacyEvent[],
      }),
      migrate: (state: unknown) => {
        const persisted = (state ?? {}) as PersistedState;
        const hasLegacyData =
          (persisted.categories?.length ?? 0) > 0 || (persisted.events?.length ?? 0) > 0;
        const hasPersistedProfiles = (persisted.profiles?.length ?? 0) > 0;
        const useLegacyDefaults = hasLegacyData && !hasPersistedProfiles;

        const profiles = normalizePersistedProfiles(persisted.profiles, {
          forLegacyData: useLegacyDefaults,
        });
        const categories = normalizePersistedCategories(persisted.categories, profiles, {
          forLegacyData: useLegacyDefaults,
        });
        const selectedProfileIds = ensureSelectedProfileIds(
          persisted.selectedProfileIds,
          profiles
        );

        const categoryIds = new Set(categories.map((category) => category.id));
        const fallbackCategoryId = categoryIds.has(defaultCategoryId)
          ? defaultCategoryId
          : (categories[0]?.id ?? defaultCategoryId);
        const fallbackColor =
          categories.find((category) => category.id === fallbackCategoryId)?.color ??
          defaultCategoryColor;

        const events =
          persisted.events?.map((evt, idx) => {
            const createdAt =
              evt.createdAt ??
              new Date(Date.UTC(2024, 0, 1, 0, 0, idx)).toISOString();
            const dayOrder = normalizeEventDayOrder(evt.dayOrder);
            const notes =
              typeof evt.notes === "string" && evt.notes.trim().length > 0
                ? evt.notes.trim()
                : undefined;
            const recurrenceType = normalizeRecurrenceType(evt.recurrenceType);
            const recurrenceUntil = normalizeRecurrenceUntil({
              value: evt.recurrenceUntil,
              recurrenceType,
              startDate: evt.startDate ?? "",
            });
            const mappedCategoryId =
              mapLegacyCategoryId(evt.categoryId) ??
              mapLegacyCategoryId(evt.category) ??
              fallbackCategoryId;
            const categoryId = categoryIds.has(mappedCategoryId)
              ? mappedCategoryId
              : fallbackCategoryId;
            const normalizedId =
              typeof evt.id === "string" && evt.id.trim() && isUuid(evt.id)
                ? evt.id
                : uid();
            return {
              ...evt,
              id: normalizedId,
              categoryId,
              createdAt,
              dayOrder,
              notes,
              recurrenceType,
              recurrenceUntil,
              color:
                categories.find((c: CategoryItem) => c.id === categoryId)?.color ??
                evt.color ??
                fallbackColor,
            };
          }) ?? [];

        return {
          ...persisted,
          profiles,
          selectedProfileIds,
          categories,
          events,
        };
      },
    }
  )
);
