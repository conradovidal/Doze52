import {
  isOnboardingPersonalDemoGroup,
  getOnboardingDefaultCategories,
  getOnboardingDefaultProfiles,
  ONBOARDING_DEFAULT_CATEGORY_ID,
  ONBOARDING_DEFAULT_PROFILE_ID,
  ONBOARDING_PROFILE_IDS,
} from "@/lib/store";
import type { CalendarSnapshot } from "@/lib/sync";

export const ensureSnapshotCoverage = (
  snapshot: CalendarSnapshot
): CalendarSnapshot => {
  const profiles =
    snapshot.profiles.length > 0
      ? snapshot.profiles
      : getOnboardingDefaultProfiles();

  const profileIds = new Set(profiles.map((profile) => profile.id));
  const fallbackProfileId = profileIds.has(ONBOARDING_DEFAULT_PROFILE_ID)
    ? ONBOARDING_DEFAULT_PROFILE_ID
    : profiles[0]?.id ?? ONBOARDING_DEFAULT_PROFILE_ID;

  const categories =
    snapshot.categories.length > 0
      ? snapshot.categories
      : getOnboardingDefaultCategories();

  const normalizedCategories = categories.map((category) => ({
    ...category,
    profileId: profileIds.has(category.profileId)
      ? category.profileId
      : fallbackProfileId,
  }));

  const categoryIds = new Set(
    normalizedCategories.map((category) => category.id)
  );
  const fallbackCategoryId = categoryIds.has(ONBOARDING_DEFAULT_CATEGORY_ID)
    ? ONBOARDING_DEFAULT_CATEGORY_ID
    : normalizedCategories[0]?.id ?? ONBOARDING_DEFAULT_CATEGORY_ID;
  const colorByCategoryId = new Map(
    normalizedCategories.map((category) => [category.id, category.color])
  );

  const events = snapshot.events.map((event) => {
    const categoryId = categoryIds.has(event.categoryId)
      ? event.categoryId
      : fallbackCategoryId;
    const color = colorByCategoryId.get(categoryId) ?? event.color;
    return categoryId === event.categoryId && color === event.color
      ? event
      : { ...event, categoryId, color };
  });

  return { profiles, categories: normalizedCategories, events };
};

export const materializeUserOwnedSnapshot = (
  snapshot: CalendarSnapshot,
  createId: () => string = () => crypto.randomUUID()
): CalendarSnapshot => {
  const covered = ensureSnapshotCoverage(snapshot);
  const profileIdMap = new Map(
    covered.profiles.map((profile) => [profile.id, createId()])
  );
  const categoryIdMap = new Map(
    covered.categories.map((category) => [category.id, createId()])
  );

  return {
    profiles: covered.profiles.map((profile) => ({
      ...profile,
      id: profileIdMap.get(profile.id) ?? createId(),
      userId: undefined,
    })),
    categories: covered.categories.map((category) => ({
      ...category,
      id: categoryIdMap.get(category.id) ?? createId(),
      profileId:
        profileIdMap.get(category.profileId) ??
        profileIdMap.values().next().value ??
        createId(),
      userId: undefined,
    })),
    events: covered.events.map((event) => ({
      ...event,
      id: createId(),
      categoryId:
        categoryIdMap.get(event.categoryId) ??
        categoryIdMap.values().next().value ??
        createId(),
      userId: undefined,
    })),
  };
};

// Example categories are presentation data, never part of the account snapshot.
export const withoutOnboardingExamples = (snapshot: CalendarSnapshot): CalendarSnapshot => {
  const categories = snapshot.categories.filter((c) => !isOnboardingPersonalDemoGroup(c.calendarPackGroupId));
  const ids = new Set(categories.map((c) => c.id));
  return { ...snapshot, categories, events: snapshot.events.filter((e) => ids.has(e.categoryId) && !isOnboardingPersonalDemoGroup(e.calendarPackGroupId)) };
};

/**
 * Os contextos do exemplo (Pessoal, Profissional, Triatlo) que a pessoa não
 * chegou a usar não são conteúdo dela. No plano Free a conta aceita 1 contexto,
 * e levar os vazios fazia o servidor recusar o rascunho inteiro
 * (free_snapshot_profile_limit): o app o descartava e a conta ficava sem as
 * categorias escolhidas. No mobile sobra o Pessoal; no desktop, quem definiu o
 * Profissional (com categorias nele) o mantém.
 *
 * Só saem contextos do exemplo: um contexto que a pessoa criou fica, mesmo vazio.
 * Sempre sobra ao menos um (o Pessoal, ou o primeiro).
 */
const EXAMPLE_PROFILE_IDS: ReadonlySet<string> = new Set(
  Object.values(ONBOARDING_PROFILE_IDS)
);

export const withoutUnusedProfiles = (snapshot: CalendarSnapshot): CalendarSnapshot => {
  const used = new Set(snapshot.categories.map((category) => category.profileId));
  const kept = snapshot.profiles.filter(
    (profile) => used.has(profile.id) || !EXAMPLE_PROFILE_IDS.has(profile.id)
  );
  const result =
    kept.length > 0
      ? kept
      : snapshot.profiles.filter(
          (profile) => profile.id === ONBOARDING_DEFAULT_PROFILE_ID
        ).concat(snapshot.profiles).slice(0, 1);
  if (result.length === snapshot.profiles.length) return snapshot;
  return { ...snapshot, profiles: result };
};
