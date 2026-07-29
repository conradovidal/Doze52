import {
  getOnboardingDefaultCategories,
  getOnboardingDefaultProfiles,
  ONBOARDING_DEFAULT_CATEGORY_ID,
  ONBOARDING_DEFAULT_PROFILE_ID,
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
