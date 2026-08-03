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

export type CalendarPackReconciliationResult = {
  snapshot: CalendarSnapshot;
  updatedPackCount: number;
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

export const getCalendarPackGroupId = (pack: CalendarPack) =>
  pack.variantGroup?.id ?? pack.id;

export const isManagedCalendarPackCategory = (category?: CategoryItem | null) =>
  Boolean(category?.calendarPackGroupId);

export const isManagedCalendarPackEvent = (event?: CalendarEvent | null) =>
  Boolean(event?.calendarPackGroupId);

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
) => {
  return categories.find((category) => category.id === packCategory.id) ?? null;
};

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
  (event.notes ?? []).filter(Boolean).join("\n");

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
      event.competition,
      event.phase,
      `${event.time} · ${event.venue}${event.city ? `, ${event.city}` : ""}`,
      ...(event.notes ?? []),
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

export const isStrictSemanticPackEvent = (
  event: CalendarEvent,
  packEvent: CalendarPackEvent,
  pack: CalendarPack
) => {
  if (event.startDate !== packEvent.date || event.endDate !== packEvent.date) {
    return false;
  }

  const expectedTitles = new Set([
    normalizeLabel(getCalendarPackEventTitle(packEvent, pack)),
    normalizeLabel(packEvent.title),
  ]);
  const normalizedEventTitle = normalizeLabel(event.title);
  const team = normalizeLabel(pack.variantGroup?.optionLabel ?? "");
  const isSameTeamFixture =
    pack.id.startsWith("brasileirao-2026") &&
    team.length > 0 &&
    (` ${normalizedEventTitle} `).includes(` ${team} `) &&
    [...expectedTitles].some((expectedTitle) =>
      (` ${expectedTitle} `).includes(` ${team} `)
    ) &&
    /\b\d+\s+x\b|\bx\s+\d+\b/.test(normalizedEventTitle);
  if (!expectedTitles.has(normalizedEventTitle) && !isSameTeamFixture) {
    return false;
  }

  if (isSameTeamFixture) return true;

  const expectedNotes = normalizeLabel(getCalendarPackEventNotes(packEvent, pack));
  return (
    expectedNotes.length === 0 ||
    normalizeLabel(event.notes ?? "") === expectedNotes
  );
};

const LEGACY_HOLIDAY_TITLES = new Set(
  [
    "Nossa Senhora dos Navegantes",
    "Dia da Mulher",
    "Dia do Consumidor",
    "Dia das Mães",
    "Dia dos Namorados",
    "Dia dos Pais",
    "Dia do Cliente",
    "Natal",
  ].map(normalizeLabel)
);

export const isRecognizedLegacyPackEvent = (
  event: CalendarEvent,
  pack: CalendarPack
) => {
  if (event.startDate !== event.endDate) return false;

  if (pack.id.startsWith("brasileirao-2026")) {
    const team = normalizeLabel(pack.variantGroup?.optionLabel ?? "");
    const title = normalizeLabel(event.title);
    const isNearbySeason = [pack.year - 1, pack.year].includes(
      Number(event.startDate.slice(0, 4))
    );
    const hasTeam = team.length > 0 && (` ${title} `).includes(` ${team} `);
    const looksLikeScoredFixture = /\b\d+\s+x\b|\bx\s+\d+\b/.test(title);
    return isNearbySeason && hasTeam && looksLikeScoredFixture;
  }

  return (
    getCalendarPackGroupId(pack) === "holidays-by-state" &&
    Number(event.startDate.slice(0, 4)) === pack.year &&
    LEGACY_HOLIDAY_TITLES.has(normalizeLabel(event.title))
  );
};

const findStrictSemanticPackEvent = (
  events: CalendarEvent[],
  packEvent: CalendarPackEvent,
  pack: CalendarPack
) => events.find((event) => isStrictSemanticPackEvent(event, packEvent, pack));

export const getCalendarPackAvailability = (
  snapshot: CalendarSnapshot,
  pack: CalendarPack
): CalendarPackAvailability => {
  const profile = findPackProfile(snapshot.profiles, pack);
  const groupId = getCalendarPackGroupId(pack);
  const managedCategories = snapshot.categories.filter(
    (category) => category.calendarPackGroupId === groupId
  );
  const packCategories = pack.categories
    .map((packCategory) => findPackCategoryAnywhere(snapshot.categories, packCategory))
    .filter(Boolean) as CategoryItem[];
  const legacyCategories = (pack.legacyCategoryIds ?? [])
    .map((categoryId) =>
      snapshot.categories.find((category) => category.id === categoryId)
    )
    .filter(Boolean) as CategoryItem[];
  const allPackCategories = [
    ...managedCategories,
    ...packCategories,
    ...legacyCategories,
  ].filter(
    (category, index, categories) =>
      categories.findIndex((candidate) => candidate.id === category.id) === index
  );
  const eventsById = new Map(snapshot.events.map((event) => [event.id, event]));
  const categoryIdByKey = new Map(pack.categories.map((category) => [category.key, category.id]));
  const importedEvents = pack.events.filter((event) => {
    if (getPackEventIds(event).some((eventId) => eventsById.has(eventId))) {
      return true;
    }
    return (
      snapshot.events.some(
        (candidate) =>
          candidate.calendarPackGroupId === groupId &&
          candidate.calendarPackEventKey === event.id
      ) || Boolean(findStrictSemanticPackEvent(snapshot.events, event, pack))
    );
  });
  const hasRecognizedLegacyEvent = snapshot.events.some((event) =>
    isRecognizedLegacyPackEvent(event, pack)
  );
  const importedBrazilEvents = importedEvents.filter((event) => event.isBrazilMatch);
  const hasMismatchedEvents = pack.events.some((packEvent) => {
    const event =
      eventsById.get(packEvent.id) ??
      snapshot.events.find(
        (candidate) =>
          candidate.calendarPackGroupId === groupId &&
          candidate.calendarPackEventKey === packEvent.id
      ) ?? findStrictSemanticPackEvent(snapshot.events, packEvent, pack);
    const legacyEvent = (packEvent.legacyIds ?? [])
      .map((eventId) => eventsById.get(eventId))
      .find(Boolean);
    const expectedCategoryId =
      allPackCategories.find(
        (category) =>
          category.calendarPackCategoryKey === packEvent.suggestedCategoryKey
      )?.id ?? categoryIdByKey.get(packEvent.suggestedCategoryKey);
    const expectedTitle = getCalendarPackEventTitle(packEvent, pack);
    const expectedNotes = getCalendarPackEventNotes(packEvent, pack);
    return Boolean(
      legacyEvent ||
        (event && expectedCategoryId && event.categoryId !== expectedCategoryId) ||
        (event &&
          (event.title !== expectedTitle ||
            event.notes !== expectedNotes ||
            event.calendarPackGroupId !== groupId ||
            event.calendarPackEventKey !== packEvent.id ||
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
    hasImportedEvents: importedEvents.length > 0 || hasRecognizedLegacyEvent,
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

  const groupId = getCalendarPackGroupId(pack);
  const managedCategory = snapshot.categories.find(
    (category) => category.calendarPackGroupId === groupId
  );
  if (managedCategory?.calendarPackVariantId) {
    return managedCategory.calendarPackVariantId === pack.id;
  }

  const legacyEvidenceByVariant = variants.map((variant) => ({
    id: variant.id,
    count: snapshot.events.filter((event) =>
      isRecognizedLegacyPackEvent(event, variant)
    ).length,
  }));
  const strongestLegacyEvidence = [...legacyEvidenceByVariant].sort(
    (left, right) => right.count - left.count
  )[0];
  const secondStrongestLegacyEvidence = [...legacyEvidenceByVariant].sort(
    (left, right) => right.count - left.count
  )[1];
  if (
    strongestLegacyEvidence?.count > 0 &&
    strongestLegacyEvidence.count > (secondStrongestLegacyEvidence?.count ?? 0)
  ) {
    return strongestLegacyEvidence.id === pack.id;
  }

  const siblingEventIds = new Set(
    variants
      .filter((variant) => variant.id !== pack.id)
      .flatMap((variant) => variant.events.flatMap(getPackEventIds))
  );
  const exclusiveEventIds = pack.events
    .flatMap(getPackEventIds)
    .filter((eventId) => !siblingEventIds.has(eventId));

  if (exclusiveEventIds.length > 0) {
    return snapshot.events.some((event) => exclusiveEventIds.includes(event.id));
  }

  const candidateEventIds = getAllPackEventIds(pack);
  const siblingOnlyEventIds = new Set(
    variants
      .filter((variant) => variant.id !== pack.id)
      .flatMap((variant) => variant.events.flatMap(getPackEventIds))
      .filter((eventId) => !candidateEventIds.has(eventId))
  );
  const hasCandidateEvent = snapshot.events.some((event) =>
    candidateEventIds.has(event.id)
  );
  const hasSiblingOnlyEvent = snapshot.events.some((event) =>
    siblingOnlyEventIds.has(event.id)
  );

  return hasCandidateEvent && !hasSiblingOnlyEvent;
};

export const importCalendarPackVariant = (
  snapshot: CalendarSnapshot,
  pack: CalendarPack,
  variants: readonly CalendarPack[],
  selection: CalendarPackSelection,
  targetProfileId: string
): CalendarPackImportResult => {
  if (pack.variantGroup?.selectionMode !== "replace" || variants.length === 1) {
    return importCalendarPack(
      snapshot,
      pack,
      selection,
      targetProfileId,
      variants
    );
  }

  const selectedEventIds = getAllPackEventIds(pack);
  const siblingExclusiveEventIds = new Set(
    variants
      .filter((variant) => variant.id !== pack.id)
      .flatMap((variant) => variant.events.flatMap(getPackEventIds))
      .filter((eventId) => !selectedEventIds.has(eventId))
  );
  const eventsWithoutPreviousVariant = snapshot.events.filter(
    (event) =>
      !siblingExclusiveEventIds.has(event.id) ||
      (!event.calendarPackGroupId &&
        !variants.some((variant) =>
          variant.events.some((packEvent) => getPackEventIds(packEvent).includes(event.id))
        ))
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
  const result = importCalendarPack(
    cleanedSnapshot,
    pack,
    selection,
    targetProfileId,
    variants
  );

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

  if (category.calendarPackGroupId) {
    const pack =
      packs.find((entry) => entry.id === category.calendarPackVariantId) ??
      packs.find(
        (entry) => getCalendarPackGroupId(entry) === category.calendarPackGroupId
      );
    const packCategory = pack?.categories.find(
      (entry) => entry.key === category.calendarPackCategoryKey
    );
    if (pack && packCategory) {
      return {
        pack,
        profile:
          snapshot.profiles.find((entry) => entry.id === category.profileId) ?? null,
        category,
        packCategory,
      };
    }
  }

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
  const hasStrictPackEvent = profileMatch.pack.events.some((packEvent) =>
    snapshot.events
      .filter((event) => event.categoryId === category.id)
      .some((event) =>
        isStrictSemanticPackEvent(event, packEvent, profileMatch.pack)
      )
  );
  return packCategory && hasStrictPackEvent
    ? { ...profileMatch, category, packCategory }
    : null;
};

export const importCalendarPack = (
  snapshot: CalendarSnapshot,
  pack: CalendarPack,
  selection: CalendarPackSelection,
  targetProfileId: string,
  relatedPacks: readonly CalendarPack[] = [pack]
): CalendarPackImportResult => {
  const targetProfile = snapshot.profiles.find(
    (profile) => profile.id === targetProfileId
  );
  if (!targetProfile) {
    throw new Error("Target profile not found.");
  }

  const selectedPackEvents = getCalendarPackEvents(pack, selection);
  const groupId = getCalendarPackGroupId(pack);
  const selectedCategoryKeys = new Set(
    selectedPackEvents.map((event) => event.suggestedCategoryKey)
  );
  const selectedPackCategories = pack.categories.filter((category) =>
    selectedCategoryKeys.has(category.key)
  );
  const profileId = targetProfile.id;
  const hadExistingPackCategory = selectedPackCategories.some((packCategory) =>
    snapshot.categories.some(
      (category) =>
        category.calendarPackGroupId === groupId &&
        category.calendarPackCategoryKey === packCategory.key
    ) ||
    Boolean(findPackCategoryAnywhere(snapshot.categories, packCategory)) ||
    snapshot.categories.some((category) =>
      (pack.legacyCategoryIds ?? []).includes(category.id)
    )
  );
  const packEventIdsBeforeImport = new Set(
    selectedPackEvents.flatMap(getPackEventIds)
  );
  const hadExistingPackEvent =
    snapshot.events.some(
      (event) =>
        packEventIdsBeforeImport.has(event.id) ||
        (event.calendarPackGroupId === groupId &&
          Boolean(event.calendarPackEventKey) &&
          packEventIdsBeforeImport.has(event.calendarPackEventKey ?? ""))
    ) ||
    selectedPackEvents.some((event) =>
      Boolean(findStrictSemanticPackEvent(snapshot.events, event, pack))
    );
  const nextProfiles = [...snapshot.profiles];

  const categoryIdByKey = new Map<string, string>();
  let addedCategoryCount = 0;
  let updatedCategoryCount = 0;
  let nextCategories = [...snapshot.categories];
  let nextEvents = [...snapshot.events];
  const migratedLegacyCategoryIds = new Set<string>();

  for (const packCategory of selectedPackCategories) {
    const relatedCategories = relatedPacks.flatMap((relatedPack) =>
      relatedPack.categories.filter(
        (candidate) => candidate.key === packCategory.key
      )
    );
    const knownDefaultNames = new Set(
      relatedCategories.flatMap((category) => [
        normalizeLabel(category.name),
        ...(category.legacyNames ?? []).map(normalizeLabel),
      ])
    );
    const packCategoryEventIds = new Set(
      selectedPackEvents
        .filter((event) => event.suggestedCategoryKey === packCategory.key)
        .flatMap(getPackEventIds)
    );
    const matchingCategoryEvents = nextEvents.filter((event) => {
      if (packCategoryEventIds.has(event.id)) return true;
      return (
        selectedPackEvents
          .filter((candidate) => candidate.suggestedCategoryKey === packCategory.key)
          .some((candidate) => isStrictSemanticPackEvent(event, candidate, pack)) ||
        isRecognizedLegacyPackEvent(event, pack)
      );
    });
    const eventLinkedCategoryIds = new Set(
      matchingCategoryEvents.map((event) => event.categoryId)
    );
    const dedicatedEventLinkedCategoryIds = new Set(
      [...eventLinkedCategoryIds].filter((categoryId) => {
        const eventsInCategory = nextEvents.filter(
          (event) => event.categoryId === categoryId
        );
        return (
          eventsInCategory.length > 0 &&
          eventsInCategory.every((event) => matchingCategoryEvents.includes(event))
        );
      })
    );
    const legacyNames = (packCategory.legacyNames ?? []).map(normalizeLabel);
    const legacyCategoryIds = pack.legacyCategoryIds ?? [];
    const legacyCandidates = nextCategories.filter(
      (category) =>
        category.id !== packCategory.id &&
        ((category.calendarPackGroupId === groupId &&
          category.calendarPackCategoryKey === packCategory.key) ||
          legacyCategoryIds.includes(category.id) ||
          dedicatedEventLinkedCategoryIds.has(category.id))
    );
    const canonicalCategory = nextCategories.find(
      (category) => category.id === packCategory.id
    );
    const preferredLegacyCategory = [...legacyCandidates].sort((left, right) => {
      const getPriority = (category: CategoryItem) => {
        const namePriority = legacyNames.indexOf(normalizeLabel(category.name));
        if (namePriority >= 0) return namePriority;
        const idPriority = legacyCategoryIds.indexOf(category.id);
        if (idPriority >= 0) return legacyNames.length + idPriority;
        return legacyNames.length + legacyCategoryIds.length;
      };
      return getPriority(left) - getPriority(right);
    })[0];
    const existingCategory = canonicalCategory ?? preferredLegacyCategory;

    if (!existingCategory) {
      const categoryId = crypto.randomUUID();
      categoryIdByKey.set(packCategory.key, categoryId);
      addedCategoryCount += 1;
      nextCategories.push({
        id: categoryId,
        profileId,
        name: packCategory.name,
        color: packCategory.color,
        visible: true,
        calendarPackGroupId: groupId,
        calendarPackVariantId: pack.id,
        calendarPackCategoryKey: packCategory.key,
        calendarPackVersion: pack.version,
      });
      continue;
    }

    const nextCategoryName = knownDefaultNames.has(
      normalizeLabel(existingCategory.name)
    )
      ? packCategory.name
      : existingCategory.name;
    const nextCategoryColor = existingCategory.color;
    const nextCategoryProfileId = existingCategory.profileId;

    const destinationCategoryId = existingCategory.id;
    const sourceCategoryIds = new Set([
      existingCategory.id,
      ...legacyCandidates.map((category) => category.id),
    ]);
    categoryIdByKey.set(packCategory.key, destinationCategoryId);
    nextEvents = nextEvents.map((event) =>
      sourceCategoryIds.has(event.categoryId) &&
      event.categoryId !== destinationCategoryId
        ? {
            ...event,
            categoryId: destinationCategoryId,
            color: nextCategoryColor,
          }
        : event
    );
    sourceCategoryIds.forEach((categoryId) => {
      if (categoryId !== destinationCategoryId) {
        migratedLegacyCategoryIds.add(categoryId);
      }
    });
    nextCategories = nextCategories
      .filter(
        (category) =>
          category.id === destinationCategoryId ||
          !sourceCategoryIds.has(category.id)
      )
      .map((category) =>
        category.id === destinationCategoryId
          ? {
              ...category,
              profileId: nextCategoryProfileId,
              name: nextCategoryName,
              color: nextCategoryColor,
              calendarPackGroupId: groupId,
              calendarPackVariantId: pack.id,
              calendarPackCategoryKey: packCategory.key,
              calendarPackVersion: pack.version,
            }
          : category
      );

    if (
      existingCategory.name !== nextCategoryName ||
      existingCategory.color !== nextCategoryColor ||
      existingCategory.calendarPackGroupId !== groupId ||
      existingCategory.calendarPackVariantId !== pack.id ||
      existingCategory.calendarPackCategoryKey !== packCategory.key ||
      existingCategory.calendarPackVersion !== pack.version ||
      sourceCategoryIds.size > 1
    ) {
      updatedCategoryCount += 1;
    }
  }

  const categoriesById = new Map(nextCategories.map((category) => [category.id, category]));
  const orderByDate = buildDayOrderMap(nextEvents);
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
    const managedEventIndex = nextEvents.findIndex(
      (event) =>
        event.calendarPackGroupId === groupId &&
        event.calendarPackEventKey === packEvent.id
    );
    const currentEventIndex = nextEvents.findIndex((event) => event.id === packEvent.id);
    const legacyEventIndex = nextEvents.findIndex((event) => legacyIds.has(event.id));
    const semanticEventIndex = nextEvents.findIndex((event) =>
      isStrictSemanticPackEvent(event, packEvent, pack)
    );
    const existingEventIndex =
      managedEventIndex >= 0
        ? managedEventIndex
        : currentEventIndex >= 0
          ? currentEventIndex
          : legacyEventIndex >= 0
            ? legacyEventIndex
            : semanticEventIndex;
    for (const legacyId of legacyIds) {
      legacyEventIdsToRemove.add(legacyId);
    }
    if (existingEventIndex >= 0 && categoryId && category) {
      const currentEvent = nextEvents[existingEventIndex];
      const nextEvent = {
        ...currentEvent,
        id: currentEvent.id,
        title: expectedTitle,
        categoryId,
        color: category.color,
        startDate: packEvent.date,
        endDate: packEvent.date,
        notes: expectedNotes,
        recurrenceType: packEvent.recurrenceType,
        recurrenceUntil: packEvent.recurrenceUntil,
        calendarPackGroupId: groupId,
        calendarPackEventKey: packEvent.id,
      };
      const changed =
        currentEvent.title !== nextEvent.title ||
        currentEvent.categoryId !== nextEvent.categoryId ||
        currentEvent.color !== nextEvent.color ||
        currentEvent.startDate !== nextEvent.startDate ||
        currentEvent.endDate !== nextEvent.endDate ||
        currentEvent.notes !== nextEvent.notes ||
        currentEvent.calendarPackGroupId !== nextEvent.calendarPackGroupId ||
        currentEvent.calendarPackEventKey !== nextEvent.calendarPackEventKey ||
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
      id: crypto.randomUUID(),
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
      calendarPackGroupId: groupId,
      calendarPackEventKey: packEvent.id,
    });
    addedEventCount += 1;
  }

  const fallbackPackCategoryId = selectedPackCategories
    .map((category) => categoryIdByKey.get(category.key))
    .find(Boolean);
  if (fallbackPackCategoryId) {
    const fallbackPackCategory = categoriesById.get(fallbackPackCategoryId);
    nextEvents = nextEvents.map((event) => {
      if (
        event.calendarPackGroupId === groupId ||
        !isRecognizedLegacyPackEvent(event, pack)
      ) {
        return event;
      }

      updatedEventCount += 1;
      return {
        ...event,
        categoryId: fallbackPackCategoryId,
        color: fallbackPackCategory?.color ?? event.color,
        calendarPackGroupId: groupId,
        calendarPackEventKey: `legacy:${event.startDate}:${normalizeLabel(event.title)
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")}`,
      };
    });
  }

  const legacyCategoryIds = new Set([
    ...(pack.legacyCategoryIds ?? []),
    ...migratedLegacyCategoryIds,
  ]);
  const selectedEventKeys = new Set(selectedPackEvents.map((event) => event.id));
  const eventsAfterLegacyCleanup = nextEvents.filter(
    (event) =>
      !legacyEventIdsToRemove.has(event.id) &&
      !(
        event.calendarPackGroupId === groupId &&
        event.calendarPackEventKey &&
        !event.calendarPackEventKey.startsWith("legacy:") &&
        !selectedEventKeys.has(event.calendarPackEventKey)
      )
  );
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
  const groupIds = new Set(relatedPacks.map(getCalendarPackGroupId));
  const semanticPackEventIds = new Set(
    snapshot.events
      .filter((event) =>
        relatedPacks.some((relatedPack) =>
          relatedPack.events.some((packEvent) =>
            isStrictSemanticPackEvent(event, packEvent, relatedPack)
          )
        )
      )
      .map((event) => event.id)
  );
  const dedicatedSemanticCategoryIds = new Set(
    snapshot.categories
      .filter((category) => {
        const categoryEvents = snapshot.events.filter(
          (event) => event.categoryId === category.id
        );
        return (
          categoryEvents.length > 0 &&
          categoryEvents.every((event) => semanticPackEventIds.has(event.id))
        );
      })
      .map((category) => category.id)
  );
  const categoryIdsToRemove = new Set<string>(
    [
      ...snapshot.categories
        .filter((category) =>
          category.calendarPackGroupId
            ? groupIds.has(category.calendarPackGroupId)
            : false
        )
        .map((category) => category.id),
      ...relatedPacks
        .flatMap((relatedPack) => relatedPack.categories)
        .map((packCategory) =>
          findPackCategoryAnywhere(snapshot.categories, packCategory)
        )
        .filter((category): category is CategoryItem => Boolean(category))
        .map((category) => category.id),
      ...relatedPacks.flatMap((relatedPack) => relatedPack.legacyCategoryIds ?? []),
      ...dedicatedSemanticCategoryIds,
    ]
  );
  const packEventIds = new Set(
    relatedPacks.flatMap((relatedPack) => relatedPack.events.flatMap(getPackEventIds))
  );
  const eventsWithoutPack = snapshot.events.filter(
    (event) =>
      !packEventIds.has(event.id) &&
      !semanticPackEventIds.has(event.id) &&
      !(event.calendarPackGroupId && groupIds.has(event.calendarPackGroupId))
  );
  const nextCategoriesWithoutPack = snapshot.categories.filter(
    (category) => !categoryIdsToRemove.has(category.id)
  );
  const fallbackByProfile = new Map<string, CategoryItem>();
  const nextCategories = [...nextCategoriesWithoutPack];

  for (const removedCategory of snapshot.categories.filter((category) =>
    categoryIdsToRemove.has(category.id)
  )) {
    let fallback =
      fallbackByProfile.get(removedCategory.profileId) ??
      nextCategories.find(
        (category) =>
          category.profileId === removedCategory.profileId &&
          !category.calendarPackGroupId
      );
    if (!fallback) {
      fallback = {
        id: crypto.randomUUID(),
        profileId: removedCategory.profileId,
        name: "Eventos pessoais",
        color: removedCategory.color,
        visible: true,
      };
      nextCategories.push(fallback);
    }
    fallbackByProfile.set(removedCategory.profileId, fallback);
  }

  const nextEvents = eventsWithoutPack.map((event) => {
    if (!categoryIdsToRemove.has(event.categoryId)) return event;
    const removedCategory = snapshot.categories.find(
      (category) => category.id === event.categoryId
    );
    const fallback = removedCategory
      ? fallbackByProfile.get(removedCategory.profileId)
      : null;
    return fallback
      ? { ...event, categoryId: fallback.id, color: fallback.color }
      : event;
  });

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

export const removeCalendarPackByCategory = (
  snapshot: CalendarSnapshot,
  packs: readonly CalendarPack[],
  categoryId: string
): CalendarPackRemovalResult => {
  const match = findCalendarPackByCategoryId(snapshot, packs, categoryId);
  if (!match) return removeCalendarPackCategory(snapshot, categoryId);
  const groupId = getCalendarPackGroupId(match.pack);
  const relatedPacks = packs.filter(
    (candidate) => getCalendarPackGroupId(candidate) === groupId
  );
  return removeCalendarPack(snapshot, match.pack, relatedPacks);
};

export const reconcileInstalledCalendarPacks = (
  snapshot: CalendarSnapshot,
  packs: readonly CalendarPack[]
): CalendarPackReconciliationResult => {
  const grouped = new Map<string, CalendarPack[]>();
  for (const pack of packs) {
    const groupId = getCalendarPackGroupId(pack);
    grouped.set(groupId, [...(grouped.get(groupId) ?? []), pack]);
  }

  let nextSnapshot = snapshot;
  let updatedPackCount = 0;
  const getVisibleContentHash = (candidate: CalendarSnapshot) =>
    JSON.stringify({
      categories: candidate.categories.map((category) => ({
        id: category.id,
        userId: category.userId,
        profileId: category.profileId,
        name: category.name,
        color: category.color,
        visible: category.visible,
      })),
      events: candidate.events.map((event) => ({
        id: event.id,
        userId: event.userId,
        title: event.title,
        categoryId: event.categoryId,
        color: event.color,
        startDate: event.startDate,
        endDate: event.endDate,
        notes: event.notes,
        recurrenceType: event.recurrenceType,
        recurrenceUntil: event.recurrenceUntil,
        createdAt: event.createdAt,
        dayOrder: event.dayOrder,
      })),
    });

  for (const [groupId, variants] of grouped) {
    const managedCategory = nextSnapshot.categories.find(
      (category) => category.calendarPackGroupId === groupId
    );
    const isPresent =
      Boolean(managedCategory) ||
      variants.some((variant) => {
        const availability = getCalendarPackAvailability(nextSnapshot, variant);
        return availability.hasAnyCategory || availability.hasImportedEvents;
      });
    if (!isPresent) continue;

    const installedVariant =
      variants.find(
        (variant) => variant.id === managedCategory?.calendarPackVariantId
      ) ??
      variants.find((variant) =>
        isCalendarPackVariantInstalled(nextSnapshot, variant, variants)
      ) ??
      variants[0];
    const availability = getCalendarPackAvailability(
      nextSnapshot,
      installedVariant
    );
    const targetProfileId =
      managedCategory?.profileId ?? availability.profileId ?? null;
    if (!targetProfileId) continue;

    const previousContentHash = getVisibleContentHash(nextSnapshot);
    const result = importCalendarPackVariant(
      nextSnapshot,
      installedVariant,
      variants,
      "all",
      targetProfileId
    );
    nextSnapshot = result.snapshot;
    if (getVisibleContentHash(nextSnapshot) !== previousContentHash) {
      updatedPackCount += 1;
    }
  }

  return { snapshot: nextSnapshot, updatedPackCount };
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
