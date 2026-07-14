import type { CalendarSnapshot } from "@/lib/sync";
import type { CalendarEvent, CalendarProfile, CategoryItem } from "@/lib/types";
import type {
  CalendarPack,
  CalendarPackCategory,
  CalendarPackEvent,
  CalendarPackSelection,
} from "./types";

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

const ENGLAND_FLAG = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
const SCOTLAND_FLAG = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";

const WORLD_CUP_FLAG_BY_TEAM = new Map<string, string>([
  ["África do Sul", "🇿🇦"],
  ["Alemanha", "🇩🇪"],
  ["Argélia", "🇩🇿"],
  ["Arábia Saudita", "🇸🇦"],
  ["Argentina", "🇦🇷"],
  ["Austrália", "🇦🇺"],
  ["Áustria", "🇦🇹"],
  ["Bélgica", "🇧🇪"],
  ["Bósnia e Herzegovina", "🇧🇦"],
  ["Brasil", "🇧🇷"],
  ["Cabo Verde", "🇨🇻"],
  ["Canadá", "🇨🇦"],
  ["Catar", "🇶🇦"],
  ["Colômbia", "🇨🇴"],
  ["Coreia do Sul", "🇰🇷"],
  ["Costa do Marfim", "🇨🇮"],
  ["Croácia", "🇭🇷"],
  ["Curaçao", "🇨🇼"],
  ["Egito", "🇪🇬"],
  ["Equador", "🇪🇨"],
  ["Escócia", SCOTLAND_FLAG],
  ["Espanha", "🇪🇸"],
  ["Estados Unidos", "🇺🇸"],
  ["França", "🇫🇷"],
  ["Gana", "🇬🇭"],
  ["Haiti", "🇭🇹"],
  ["Inglaterra", ENGLAND_FLAG],
  ["Irã", "🇮🇷"],
  ["Iraque", "🇮🇶"],
  ["Japão", "🇯🇵"],
  ["Jordânia", "🇯🇴"],
  ["Marrocos", "🇲🇦"],
  ["México", "🇲🇽"],
  ["Noruega", "🇳🇴"],
  ["Nova Zelândia", "🇳🇿"],
  ["Países Baixos", "🇳🇱"],
  ["Panamá", "🇵🇦"],
  ["Paraguai", "🇵🇾"],
  ["Portugal", "🇵🇹"],
  ["RD Congo", "🇨🇩"],
  ["Senegal", "🇸🇳"],
  ["Suécia", "🇸🇪"],
  ["Suíça", "🇨🇭"],
  ["Tchéquia", "🇨🇿"],
  ["Tunísia", "🇹🇳"],
  ["Turquia", "🇹🇷"],
  ["Uruguai", "🇺🇾"],
  ["Uzbequistão", "🇺🇿"],
]);

const getWorldCupEventTitle = (event: CalendarPackEvent) => {
  const homeFlag = WORLD_CUP_FLAG_BY_TEAM.get(event.homeTeam);
  const awayFlag = WORLD_CUP_FLAG_BY_TEAM.get(event.awayTeam);
  if (!homeFlag || !awayFlag) return event.title;

  const score = event.result?.match(/^(\d+)\s*x\s*(\d+)/i);
  return score
    ? `${homeFlag}${score[1]}x${score[2]}${awayFlag}`
    : `${homeFlag}x${awayFlag}`;
};

export const getCalendarPackEventTitle = (
  event: CalendarPackEvent,
  pack: CalendarPack
) =>
  pack.id.startsWith("world-cup-2026") ? getWorldCupEventTitle(event) : event.title;

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

const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

const getTimeZoneParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const valueByType = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(valueByType.get("year")),
    month: Number(valueByType.get("month")),
    day: Number(valueByType.get("day")),
    hour: Number(valueByType.get("hour")),
    minute: Number(valueByType.get("minute")),
  };
};

const getUtcDateForZonedTime = (date: string, time: string, timeZone: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const zonedParts = getTimeZoneParts(new Date(utcGuess), timeZone);
  const zonedAsUtc = Date.UTC(
    zonedParts.year,
    zonedParts.month - 1,
    zonedParts.day,
    zonedParts.hour,
    zonedParts.minute
  );
  const offset = zonedAsUtc - utcGuess;
  return new Date(utcGuess - offset);
};

const formatBrazilTime = (event: CalendarPackEvent) => {
  const date = getUtcDateForZonedTime(event.date, event.time, event.timezone);
  if (!date) return `${event.time} (Brasília)`;

  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  const brazilDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  if (brazilDate !== event.date) {
    const shortDate = new Intl.DateTimeFormat("pt-BR", {
      timeZone: BRAZIL_TIME_ZONE,
      day: "2-digit",
      month: "2-digit",
    }).format(date);
    return `${time} (Brasília, ${shortDate})`;
  }

  return `${time} (Brasília)`;
};

const getWorldCupEventNotes = (event: CalendarPackEvent) => {
  const phase = event.group ? `${event.phase}, grupo ${event.group}` : event.phase;
  return [
    `${event.homeTeam} x ${event.awayTeam}`,
    formatBrazilTime(event),
    phase,
    event.venue && event.city ? `${event.venue}, ${event.city}` : null,
  ]
    .filter(Boolean)
    .join("\n");
};

const getHolidayEventNotes = (event: CalendarPackEvent) =>
  [
    event.phase,
    `Abrangência: ${event.city}`,
    ...(event.notes ?? []),
    `Fonte: ${event.source}`,
    `Verificado em: ${event.lastVerified}`,
  ]
    .filter(Boolean)
    .join("\n");

export const getCalendarPackEventNotes = (
  event: CalendarPackEvent,
  pack: CalendarPack
) => {
  if (pack.id.startsWith("world-cup-2026")) {
    return getWorldCupEventNotes(event);
  }
  if (pack.id.startsWith("holidays-")) {
    return getHolidayEventNotes(event);
  }

  if (pack.id.startsWith("brasileirao-2026")) {
    return [
      `Horário: ${event.time} (${event.timezone})`,
      `Local: ${event.venue} - ${event.city}`,
      `Fase: ${event.phase}`,
      ...(event.notes ?? []),
      `Fonte: ${event.source}`,
      `Verificado em: ${event.lastVerified}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

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
  categoryId: string,
  expectedTitle: string
) => {
  const titles = new Set([
    normalizeLabel(expectedTitle),
    normalizeLabel(packEvent.title),
  ]);
  const packEventIds = new Set(getPackEventIds(packEvent));
  return events.some(
    (event) =>
      packEventIds.has(event.id) ||
      (event.startDate === packEvent.date &&
        event.endDate === packEvent.date &&
        event.categoryId === categoryId &&
        titles.has(normalizeLabel(event.title)))
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
  const legacyCategories = (pack.legacyCategoryIds ?? [])
    .map((categoryId) =>
      snapshot.categories.find((category) => category.id === categoryId)
    )
    .filter(Boolean) as CategoryItem[];
  const allPackCategories = [...packCategories, ...legacyCategories].filter(
    (category, index, categories) =>
      categories.findIndex((candidate) => candidate.id === category.id) === index
  );
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
    const expectedTitle = getCalendarPackEventTitle(packEvent, pack);
    const expectedNotes = getCalendarPackEventNotes(packEvent, pack);
    return Boolean(
      legacyEvent ||
        (event && expectedCategoryId && event.categoryId !== expectedCategoryId) ||
        (event &&
          (event.title !== expectedTitle ||
            event.notes !== expectedNotes ||
            event.recurrenceType !== packEvent.recurrenceType ||
            event.recurrenceUntil !== packEvent.recurrenceUntil))
    );
  });
  const profileId = allPackCategories[0]?.profileId ?? profile?.id ?? null;

  return {
    profileId,
    hasProfile: Boolean(profile),
    categoryIds: allPackCategories.map((category) => category.id),
    hasAnyCategory: allPackCategories.length > 0,
    hasImportedEvents: importedEvents.length > 0,
    hasMismatchedEvents,
    importedEventCount: importedEvents.length,
    totalEventCount: pack.events.length,
    brazilEventCount: importedBrazilEvents.length,
    totalBrazilEventCount: pack.events.filter((event) => event.isBrazilMatch).length,
  };
};

const getAllPackEventIds = (pack: CalendarPack) =>
  new Set(pack.events.flatMap(getPackEventIds));

export const isCalendarPackVariantInstalled = (
  snapshot: CalendarSnapshot,
  pack: CalendarPack,
  variants: readonly CalendarPack[]
) => {
  if (variants.length === 1) {
    const availability = getCalendarPackAvailability(snapshot, pack);
    return availability.hasAnyCategory || availability.hasImportedEvents;
  }

  const siblingEventIds = new Set(
    variants
      .filter((variant) => variant.id !== pack.id)
      .flatMap((variant) => variant.events.flatMap(getPackEventIds))
  );
  const exclusiveEventIds = pack.events
    .flatMap(getPackEventIds)
    .filter((eventId) => !siblingEventIds.has(eventId));

  return snapshot.events.some((event) => exclusiveEventIds.includes(event.id));
};

export const importCalendarPackVariant = (
  snapshot: CalendarSnapshot,
  pack: CalendarPack,
  variants: readonly CalendarPack[],
  selection: CalendarPackSelection,
  targetProfileId: string
): CalendarPackImportResult => {
  if (pack.variantGroup?.selectionMode !== "replace" || variants.length === 1) {
    return importCalendarPack(snapshot, pack, selection, targetProfileId);
  }

  const selectedEventIds = getAllPackEventIds(pack);
  const siblingExclusiveEventIds = new Set(
    variants
      .filter((variant) => variant.id !== pack.id)
      .flatMap((variant) => variant.events.flatMap(getPackEventIds))
      .filter((eventId) => !selectedEventIds.has(eventId))
  );
  const eventsWithoutPreviousVariant = snapshot.events.filter(
    (event) => !siblingExclusiveEventIds.has(event.id)
  );
  const removedEventCount = snapshot.events.length - eventsWithoutPreviousVariant.length;
  const categoriesWithoutEmptyLegacy = snapshot.categories.filter(
    (category) =>
      !(pack.legacyCategoryIds ?? []).includes(category.id) ||
      eventsWithoutPreviousVariant.some((event) => event.categoryId === category.id)
  );
  const cleanedSnapshot = {
    ...snapshot,
    categories: categoriesWithoutEmptyLegacy,
    events: eventsWithoutPreviousVariant,
  };
  const result = importCalendarPack(cleanedSnapshot, pack, selection, targetProfileId);

  return removedEventCount > 0 && result.status === "already-exists"
    ? { ...result, status: "updated" }
    : result;
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
  selection: CalendarPackSelection,
  targetProfileId: string
): CalendarPackImportResult => {
  const targetProfile = snapshot.profiles.find(
    (profile) => profile.id === targetProfileId
  );
  if (!targetProfile) {
    throw new Error("Target profile not found.");
  }

  const selectedPackEvents = getCalendarPackEvents(pack, selection);
  const selectedCategoryKeys = new Set(
    selectedPackEvents.map((event) => event.suggestedCategoryKey)
  );
  const selectedPackCategories = pack.categories.filter((category) =>
    selectedCategoryKeys.has(category.key)
  );
  const profileId = targetProfile.id;
  const hadExistingPackCategory = selectedPackCategories.some((packCategory) =>
    Boolean(findPackCategoryAnywhere(snapshot.categories, packCategory))
  );
  const packEventIdsBeforeImport = new Set(
    selectedPackEvents.flatMap(getPackEventIds)
  );
  const hadExistingPackEvent = snapshot.events.some((event) =>
    packEventIdsBeforeImport.has(event.id)
  );
  const nextProfiles = [...snapshot.profiles];

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
    const expectedTitle = getCalendarPackEventTitle(packEvent, pack);
    const expectedNotes = getCalendarPackEventNotes(packEvent, pack);
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
        title: expectedTitle,
        categoryId,
        color: category.color,
        startDate: packEvent.date,
        endDate: packEvent.date,
        notes: expectedNotes,
        recurrenceType: packEvent.recurrenceType,
        recurrenceUntil: packEvent.recurrenceUntil,
      };
      const changed =
        currentEvent.title !== nextEvent.title ||
        currentEvent.categoryId !== nextEvent.categoryId ||
        currentEvent.color !== nextEvent.color ||
        currentEvent.startDate !== nextEvent.startDate ||
        currentEvent.endDate !== nextEvent.endDate ||
        currentEvent.notes !== nextEvent.notes ||
        currentEvent.recurrenceType !== nextEvent.recurrenceType ||
        currentEvent.recurrenceUntil !== nextEvent.recurrenceUntil;
      if (changed) {
        nextEvents[existingEventIndex] = nextEvent;
        updatedEventCount += 1;
      }
      skippedEventCount += 1;
      continue;
    }

    if (!categoryId || hasEquivalentEvent(nextEvents, packEvent, categoryId, expectedTitle)) {
      skippedEventCount += 1;
      continue;
    }

    nextEvents.push({
      id: packEvent.id,
      title: expectedTitle,
      categoryId,
      color: category?.color ?? pack.categories[0]?.color ?? "#2563EB",
      startDate: packEvent.date,
      endDate: packEvent.date,
      notes: expectedNotes,
      recurrenceType: packEvent.recurrenceType,
      recurrenceUntil: packEvent.recurrenceUntil,
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
    !hadExistingPackCategory &&
    !hadExistingPackEvent &&
    (addedCategoryCount > 0 || addedEventCount > 0)
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
  pack: CalendarPack,
  relatedPacks: readonly CalendarPack[] = [pack]
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
  const packEventIds = new Set(
    relatedPacks.flatMap((relatedPack) => relatedPack.events.flatMap(getPackEventIds))
  );
  const eventsWithoutPack = snapshot.events.filter(
    (event) => !packEventIds.has(event.id)
  );
  const nextCategoriesWithoutPack = snapshot.categories.filter(
    (category) =>
      !categoryIdsToRemove.has(category.id) ||
      eventsWithoutPack.some((event) => event.categoryId === category.id)
  );
  const shouldRemoveProfile = profile
    ? !nextCategoriesWithoutPack.some((category) => category.profileId === profile.id)
    : false;
  const profileIdToRemove = profile?.id ?? null;
  const nextProfiles = shouldRemoveProfile
    ? snapshot.profiles.filter((entry) => entry.id !== profileIdToRemove)
    : snapshot.profiles;
  const nextEvents = eventsWithoutPack;

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
