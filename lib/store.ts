"use client";

import { create } from "zustand";
import { addDays, format, parseISO } from "date-fns";
import { persist } from "zustand/middleware";
import {
  CATEGORY_PRESET_COLORS,
  ONBOARDING_CATEGORY_COLOR_BY_ID,
  PREVIOUS_ONBOARDING_COLOR_BY_ID,
} from "./category-palette";
import {
  normalizeProfileIconId,
  type ProfileIconId,
} from "./profile-icons";
import type { CalendarEvent, CalendarProfile, CategoryItem } from "./types";

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
  addEvent: (input: EventInput) => void;
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
} as const;

export const ONBOARDING_DEFAULT_CATEGORY_ID = ONBOARDING_CATEGORY_IDS.events;

const defaultCategoryColor =
  ONBOARDING_CATEGORY_COLOR_BY_ID[ONBOARDING_DEFAULT_CATEGORY_ID] ??
  CATEGORY_PRESET_COLORS[0];

const getLegacyDefaultProfiles = (): CalendarProfile[] => [
  {
    id: ONBOARDING_PROFILE_IDS.personal,
    name: "Pessoal",
    color: DEFAULT_PROFILE_COLOR,
    icon: "user",
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

export const getOnboardingDefaultProfiles = (): CalendarProfile[] => {
  return getFeatureDefaultProfiles().map((profile) => ({ ...profile }));
};

export const isOnboardingProfilesSnapshot = (profiles: CalendarProfile[]) => {
  const expected = getOnboardingDefaultProfiles();
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
    color: CATEGORY_PRESET_COLORS[0],
    visible: true,
  },
  {
    id: ONBOARDING_CATEGORY_IDS.workDeliveries,
    profileId: ONBOARDING_PROFILE_IDS.professional,
    name: "Entregas",
    color: CATEGORY_PRESET_COLORS[4],
    visible: true,
  },
  {
    id: ONBOARDING_CATEGORY_IDS.workTrips,
    profileId: ONBOARDING_PROFILE_IDS.professional,
    name: "Viagens Trabalho",
    color: CATEGORY_PRESET_COLORS[5],
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
    color: CATEGORY_PRESET_COLORS[1],
    visible: true,
  },
  {
    id: ONBOARDING_CATEGORY_IDS.familyHealth,
    profileId: ONBOARDING_PROFILE_IDS.family,
    name: "Saude Familia",
    color: CATEGORY_PRESET_COLORS[2],
    visible: true,
  },
  {
    id: ONBOARDING_CATEGORY_IDS.familyMoments,
    profileId: ONBOARDING_PROFILE_IDS.family,
    name: "Momentos",
    color: CATEGORY_PRESET_COLORS[6],
    visible: true,
  },
];

const getTemplateCategories = (options?: { legacyOnly?: boolean }) => {
  if (options?.legacyOnly) return getLegacyDefaultCategories();
  return getFeatureDefaultCategories();
};

export const ONBOARDING_DEFAULT_CATEGORIES: CategoryItem[] = getTemplateCategories();

export const getOnboardingDefaultCategories = (): CategoryItem[] =>
  getTemplateCategories().map((category) => ({ ...category }));

export const isOnboardingCategoriesSnapshot = (categories: CategoryItem[]) => {
  const expected = getOnboardingDefaultCategories();
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
};

const defaultProfiles: CalendarProfile[] = getOnboardingDefaultProfiles();
const defaultProfileId = ONBOARDING_DEFAULT_PROFILE_ID;
const defaultCategoryId = ONBOARDING_DEFAULT_CATEGORY_ID;
const normalizeColorForCompare = (value: string | undefined | null) =>
  (value ?? "").trim().toLowerCase();

const migrateOnboardingCategoryColors = (categories: CategoryItem[]) =>
  categories.map((category) => {
    const previousColor = PREVIOUS_ONBOARDING_COLOR_BY_ID[category.id];
    const nextColor = ONBOARDING_CATEGORY_COLOR_BY_ID[category.id];
    if (!previousColor || !nextColor) return category;
    if (
      normalizeColorForCompare(category.color) !==
      normalizeColorForCompare(previousColor)
    ) {
      return category;
    }
    return {
      ...category,
      color: nextColor,
    };
  });

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
    const normalizedName = profile.name?.trim() || "Perfil";
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
      addEvent: (input) =>
        set((state) => {
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
                id: uid(),
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
        }),
      updateEvent: (id, input) =>
        set((state) => ({
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
        })),
      moveEventByDelta: (id, deltaDays) =>
        set((state) => {
          if (deltaDays === 0) return state;
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
              return {
                ...evt,
                dayOrder: normalized.get(evt.id) ?? 0,
              };
            }),
          };
        }),
      deleteEvent: (id) =>
        set((state) => ({
          events: state.events.filter((evt) => evt.id !== id),
        })),
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
      version: 8,
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
        const categories = migrateOnboardingCategoryColors(
          normalizePersistedCategories(persisted.categories, profiles, {
            forLegacyData: useLegacyDefaults,
          })
        );
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
