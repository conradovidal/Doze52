import type { CalendarSnapshot } from "@/lib/sync";
import type { CalendarEvent, CalendarProfile, CategoryItem } from "@/lib/types";
import type {
  CalendarPack,
  CalendarPackCategory,
  CalendarPackEvent,
  CalendarPackSelection,
} from "./types";

const DEFAULT_PROFILE_COLOR = "#64748B";

export type CalendarPackImportStatus = "created" | "updated" | "already-exists";

export type CalendarPackImportResult = {
  snapshot: CalendarSnapshot;
  profileId: string;
  status: CalendarPackImportStatus;
  addedEventCount: number;
  skippedEventCount: number;
};

export type CalendarPackRemovalResult = {
  snapshot: CalendarSnapshot;
  removedProfileCount: number;
  removedCategoryCount: number;
  removedEventCount: number;
};

export type CalendarPackAvailability = {
  profileId: string | null;
  hasProfile: boolean;
  categoryIds: string[];
  hasAnyCategory: boolean;
  hasImportedEvents: boolean;
  hasMismatchedEvents: boolean;
  importedEventCount: number;
  totalEventCount: number;
  brazilEventCount: number;
  totalBrazilEventCount: number;
};

const normalizeLabel = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const getCalendarPackEvents = (
  pack: CalendarPack,
  selection: CalendarPackSelection
) =>
  selection === "brazil"
    ? pack.events.filter((event) => event.isBrazilMatch)
    : pack.events;

export const findPackProfile = (
  profiles: CalendarProfile[],
  pack: CalendarPack
) => {
  const byId = profiles.find((profile) => profile.id === pack.profile.id);
  if (byId) return byId;

  const packName = normalizeLabel(pack.profile.name);
  return profiles.find((profile) => normalizeLabel(profile.name) === packName) ?? null;
};

export const findPackCategory = (
  categories: CategoryItem[],
  profileId: string,
  packCategory: CalendarPackCategory
) => {
  const byId = categories.find((category) => category.id === packCategory.id);
  if (byId) return byId;

  const packName = normalizeLabel(packCategory.name);
  return (
    categories.find(
      (category) =>
        category.profileId === profileId && normalizeLabel(category.name) === packName
    ) ?? null
  );
};

const findPackCategoryAnywhere = (
  categories: CategoryItem[],
  packCategory: CalendarPackCategory
) => categories.find((category) => category.id === packCategory.id) ?? null;

const getPackEventIds = (event: CalendarPackEvent) => [
  event.id,
  ...(event.legacyIds ?? []),
];

const isSingleDayEvent = (event: Pick<CalendarEvent, "startDate" | "endDate">) =>
  event.startDate === event.endDate;

const buildDayOrderMap = (events: CalendarEvent[]) => {
  const maxOrderByDate = new Map<string, number>();

  for (const event of events) {
    if (!isSingleDayEvent(event)) continue;
    const previous = maxOrderByDate.get(event.startDate) ?? -1;
    maxOrderByDate.set(event.startDate, Math.max(previous, event.dayOrder));
  }

  return maxOrderByDate;
};

const nextDayOrder = (maxOrderByDate: Map<string, number>, date: string) => {
  const next = (maxOrderByDate.get(date) ?? -1) + 1;
  maxOrderByDate.set(date, next);
  return next;
};

const getPackEventNotes = (event: CalendarPackEvent) => {
  const phase = event.group ? `${event.phase} - Grupo ${event.group}` : event.phase;
  return [
    `Horario: ${event.time} (${event.timezone})`,
    event.weekend ? `Fim de semana: ${event.weekend}` : null,
    `Local: ${event.venue} - ${event.city}`,
    `Fase: ${phase}`,
    event.result ? `Resultado: ${event.result}` : null,
    ...(event.notes ?? []),
    `Fonte: ${event.source}`,
    `Verificado em: ${event.lastVerified}`,
  ]
    .filter(Boolean)
    .join("\n");
};

const hasEquivalentEvent = (
  events: CalendarEvent[],
  packEvent: CalendarPackEvent,
  categoryId: string
) => {
  const title = normalizeLabel(packEvent.title);
  const packEventIds = new Set(getPackEventIds(packEvent));
  return events.some(
    (event) =>
      packEventIds.has(event.id) ||
      (event.startDate === packEvent.date &&
        event.endDate === packEvent.date &&
        event.categoryId === categoryId &&
        normalizeLabel(event.title) === title)
  );
};

export const getCalendarPackAvailability = (
  snapshot: CalendarSnapshot,
  pack: CalendarPack
): CalendarPackAvailability => {
  const profile = findPackProfile(snapshot.profiles, pack);
  const packCategories = pack.categories
    .map((packCategory) => findPackCategoryAnywhere(snapshot.categories, packCategory))
    .filter(Boolean) as CategoryItem[];
  const eventsById = new Map(snapshot.events.map((event) => [event.id, event]));
  const categoryIdByKey = new Map(pack.categories.map((category) => [category.key, category.id]));
  const importedEvents = pack.events.filter((event) =>
    getPackEventIds(event).some((eventId) => eventsById.has(eventId))
  );
  const importedBrazilEvents = importedEvents.filter((event) => event.isBrazilMatch);
  const hasMismatchedEvents = pack.events.some((packEvent) => {
    const event = eventsById.get(packEvent.id);
    const legacyEvent = (packEvent.legacyIds ?? [])
      .map((eventId) => eventsById.get(eventId))
      .find(Boolean);
    const expectedCategoryId = categoryIdByKey.get(packEvent.suggestedCategoryKey);
    const expectedNotes = getPackEventNotes(packEvent);
    return Boolean(
      legacyEvent ||
        (event && expectedCategoryId && event.categoryId !== expectedCategoryId) ||
        (event && (event.title !== packEvent.title || event.notes !== expectedNotes))
    );
  });
  const profileId = packCategories[0]?.profileId ?? profile?.id ?? null;

  return {
    profileId,
    hasProfile: Boolean(profile),
    categoryIds: packCategories.map((category) => category.id),
    hasAnyCategory: packCategories.length > 0,
    hasImportedEvents: importedEvents.length > 0,
    hasMismatchedEvents,
    importedEventCount: importedEvents.length,
    totalEventCount: pack.events.length,
    brazilEventCount: importedBrazilEvents.length,
    totalBrazilEventCount: pack.events.filter((event) => event.isBrazilMatch).length,
  };
};

export const findCalendarPackByProfileId = (
  snapshot: CalendarSnapshot,
  packs: readonly CalendarPack[],
  profileId: string
) => {
  for (const pack of packs) {
    const profile = findPackProfile(snapshot.profiles, pack);
    if (profile?.id === profileId) {
      return { pack, profile };
    }
  }
  return null;
};

export const findCalendarPackByCategoryId = (
  snapshot: CalendarSnapshot,
  packs: readonly CalendarPack[],
  categoryId: string
) => {
  const category = snapshot.categories.find((entry) => entry.id === categoryId);
  if (!category) return null;

  for (const pack of packs) {
    const packCategory = pack.categories.find((entry) => entry.id === category.id);
    const legacyCategory = pack.legacyCategoryIds?.includes(category.id)
      ? pack.categories[0]
      : null;
    if (!packCategory && !legacyCategory) continue;
    const profile = findPackProfile(snapshot.profiles, pack);
    return { pack, profile, category, packCategory: (packCategory ?? legacyCategory)! };
  }

  const profileMatch = findCalendarPackByProfileId(snapshot, packs, category.profileId);
  if (!profileMatch) return null;
  const packCategory = profileMatch.pack.categories.find(
    (entry) => normalizeLabel(entry.name) === normalizeLabel(category.name)
  );
  return packCategory
    ? { ...profileMatch, category, packCategory }
    : null;
};

export const importCalendarPack = (
  snapshot: CalendarSnapshot,
  pack: CalendarPack,
  selection: CalendarPackSelection
): CalendarPackImportResult => {
  const selectedPackEvents = getCalendarPackEvents(pack, selection);
  const existingProfile = findPackProfile(snapshot.profiles, pack);
  const selectedCategoryKeys = new Set(
    selectedPackEvents.map((event) => event.suggestedCategoryKey)
  );
  const selectedPackCategories = pack.categories.filter((category) =>
    selectedCategoryKeys.has(category.key)
  );
  const shouldCreateProfile = selectedPackCategories.some(
    (packCategory) => !findPackCategoryAnywhere(snapshot.categories, packCategory)
  );
  const profileId =
    existingProfile?.id ??
    (shouldCreateProfile ? pack.profile.id : snapshot.profiles[0]?.id ?? pack.profile.id);

  let nextProfiles = existingProfile
    ? snapshot.profiles.map((profile) =>
        profile.id === existingProfile.id
          ? {
              ...profile,
              name: pack.profile.name,
              color: DEFAULT_PROFILE_COLOR,
              icon: pack.profile.icon,
            }
          : profile
      )
    : [...snapshot.profiles];

  if (shouldCreateProfile && !existingProfile) {
    nextProfiles = [
      ...nextProfiles,
      {
        id: profileId,
        name: pack.profile.name,
        color: DEFAULT_PROFILE_COLOR,
        icon: pack.profile.icon,
        position: snapshot.profiles.length,
      },
    ];
  }

  const categoryIdByKey = new Map<string, string>();
  let addedCategoryCount = 0;
  let updatedCategoryCount = 0;
  let nextCategories = [...snapshot.categories];

  for (const packCategory of selectedPackCategories) {
    const existingCategory =
      findPackCategoryAnywhere(nextCategories, packCategory) ??
      findPackCategory(nextCategories, profileId, packCategory);
    if (existingCategory) {
      categoryIdByKey.set(packCategory.key, existingCategory.id);
      if (
        existingCategory.name !== packCategory.name ||
        existingCategory.color !== packCategory.color
      ) {
        nextCategories = nextCategories.map((category) =>
          category.id === existingCategory.id
            ? { ...category, name: packCategory.name, color: packCategory.color }
            : category
        );
        updatedCategoryCount += 1;
      }
      continue;
    }

    categoryIdByKey.set(packCategory.key, packCategory.id);
    addedCategoryCount += 1;
    nextCategories.push({
      id: packCategory.id,
      profileId,
      name: packCategory.name,
      color: packCategory.color,
      visible: true,
    });
  }

  const categoriesById = new Map(nextCategories.map((category) => [category.id, category]));
  const orderByDate = buildDayOrderMap(snapshot.events);
  const nextEvents = [...snapshot.events];
  const legacyEventIdsToRemove = new Set<string>();
  let addedEventCount = 0;
  let updatedEventCount = 0;
  let skippedEventCount = 0;

  for (const packEvent of selectedPackEvents) {
    const categoryId =
      categoryIdByKey.get(packEvent.suggestedCategoryKey) ??
      categoryIdByKey.get(pack.categories[0]?.key ?? "") ??
      nextCategories[0]?.id;

    const category = categoryId ? categoriesById.get(categoryId) : null;
    const legacyIds = new Set(packEvent.legacyIds ?? []);
    const currentEventIndex = nextEvents.findIndex((event) => event.id === packEvent.id);
    const legacyEventIndex = nextEvents.findIndex((event) => legacyIds.has(event.id));
    const existingEventIndex =
      currentEventIndex >= 0 ? currentEventIndex : legacyEventIndex;
    for (const legacyId of legacyIds) {
      legacyEventIdsToRemove.add(legacyId);
    }
    if (existingEventIndex >= 0 && categoryId && category) {
      const currentEvent = nextEvents[existingEventIndex];
      const nextEvent = {
        ...currentEvent,
        id: packEvent.id,
        title: packEvent.title,
        categoryId,
        color: category.color,
        startDate: packEvent.date,
        endDate: packEvent.date,
        notes: getPackEventNotes(packEvent),
      };
      const changed =
        currentEvent.title !== nextEvent.title ||
        currentEvent.categoryId !== nextEvent.categoryId ||
        currentEvent.color !== nextEvent.color ||
        currentEvent.startDate !== nextEvent.startDate ||
        currentEvent.endDate !== nextEvent.endDate ||
        currentEvent.notes !== nextEvent.notes;
      if (changed) {
        nextEvents[existingEventIndex] = nextEvent;
        updatedEventCount += 1;
      }
      skippedEventCount += 1;
      continue;
    }

    if (!categoryId || hasEquivalentEvent(nextEvents, packEvent, categoryId)) {
      skippedEventCount += 1;
      continue;
    }

    nextEvents.push({
      id: packEvent.id,
      title: packEvent.title,
      categoryId,
      color: category?.color ?? pack.categories[0]?.color ?? "#2563EB",
      startDate: packEvent.date,
      endDate: packEvent.date,
      notes: getPackEventNotes(packEvent),
      createdAt: new Date().toISOString(),
      dayOrder: nextDayOrder(orderByDate, packEvent.date),
    });
    addedEventCount += 1;
  }

  const legacyCategoryIds = new Set(pack.legacyCategoryIds ?? []);
  const eventsAfterLegacyCleanup = legacyEventIdsToRemove.size
    ? nextEvents.filter((event) => !legacyEventIdsToRemove.has(event.id))
    : nextEvents;
  const removedLegacyEventCount = nextEvents.length - eventsAfterLegacyCleanup.length;
  const categoriesAfterLegacyCleanup =
    legacyCategoryIds.size > 0
      ? nextCategories.filter(
          (category) =>
            !legacyCategoryIds.has(category.id) ||
            eventsAfterLegacyCleanup.some((event) => event.categoryId === category.id)
        )
      : nextCategories;
  const removedLegacyCategoryCount =
    nextCategories.length - categoriesAfterLegacyCleanup.length;

  const status: CalendarPackImportStatus =
    shouldCreateProfile && !existingProfile
      ? "created"
      : addedCategoryCount > 0 ||
          updatedCategoryCount > 0 ||
          addedEventCount > 0 ||
          updatedEventCount > 0 ||
          removedLegacyEventCount > 0 ||
          removedLegacyCategoryCount > 0
        ? "updated"
        : "already-exists";
  const resultProfileId =
    selectedPackCategories
      .map((packCategory) => categoryIdByKey.get(packCategory.key))
      .map((categoryId) => (categoryId ? categoriesById.get(categoryId)?.profileId : null))
      .find(Boolean) ?? profileId;

  return {
    snapshot: {
      profiles: nextProfiles,
      categories: categoriesAfterLegacyCleanup,
      events: eventsAfterLegacyCleanup,
    },
    profileId: resultProfileId,
    status,
    addedEventCount,
    skippedEventCount,
  };
};

export const removeCalendarPack = (
  snapshot: CalendarSnapshot,
  pack: CalendarPack
): CalendarPackRemovalResult => {
  const profile = findPackProfile(snapshot.profiles, pack);
  const categoryIdsToRemove = new Set<string>(
    [
      ...pack.categories
        .map((packCategory) => findPackCategoryAnywhere(snapshot.categories, packCategory))
        .filter((category): category is CategoryItem => Boolean(category))
        .map((category) => category.id),
      ...(pack.legacyCategoryIds ?? []),
    ]
  );
  const packEventIds = new Set(pack.events.flatMap(getPackEventIds));

  const nextCategoriesWithoutPack = snapshot.categories.filter(
    (category) => !categoryIdsToRemove.has(category.id)
  );
  const shouldRemoveProfile = profile
    ? !nextCategoriesWithoutPack.some((category) => category.profileId === profile.id)
    : false;
  const profileIdToRemove = profile?.id ?? null;
  const nextProfiles = shouldRemoveProfile
    ? snapshot.profiles.filter((entry) => entry.id !== profileIdToRemove)
    : snapshot.profiles;
  const nextEvents = snapshot.events.filter(
    (event) => !packEventIds.has(event.id) && !categoryIdsToRemove.has(event.categoryId)
  );

  return {
    snapshot: {
      profiles: nextProfiles,
      categories: nextCategoriesWithoutPack,
      events: nextEvents,
    },
    removedProfileCount: snapshot.profiles.length - nextProfiles.length,
    removedCategoryCount: snapshot.categories.length - nextCategoriesWithoutPack.length,
    removedEventCount: snapshot.events.length - nextEvents.length,
  };
};

export const removeCalendarPackCategory = (
  snapshot: CalendarSnapshot,
  categoryId: string
): CalendarPackRemovalResult => {
  const category = snapshot.categories.find((entry) => entry.id === categoryId);
  if (!category) {
    return {
      snapshot,
      removedProfileCount: 0,
      removedCategoryCount: 0,
      removedEventCount: 0,
    };
  }

  const nextCategories = snapshot.categories.filter((entry) => entry.id !== category.id);
  const nextEvents = snapshot.events.filter((event) => event.categoryId !== category.id);

  return {
    snapshot: {
      profiles: snapshot.profiles,
      categories: nextCategories,
      events: nextEvents,
    },
    removedProfileCount: 0,
    removedCategoryCount: snapshot.categories.length - nextCategories.length,
    removedEventCount: snapshot.events.length - nextEvents.length,
  };
};
