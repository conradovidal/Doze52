import type { ProfileIconId } from "@/lib/profile-icons";
import type { RecurrenceType } from "@/lib/types";

export type CalendarPackSelection = "brazil" | "all";

export type CalendarPackIconId =
  | "calendar"
  | "racing-helmet"
  | "soccer-ball"
  | "tree"
  | "trophy";

export type CalendarPackCategory = {
  id: string;
  key: string;
  name: string;
  color: string;
  legacyNames?: string[];
};

export type CalendarPackEvent = {
  id: string;
  legacyIds?: string[];
  title: string;
  date: string;
  time: string;
  timezone: string;
  city: string;
  venue: string;
  phase: string;
  competition?: string;
  group?: string;
  homeTeam: string;
  awayTeam: string;
  suggestedCategoryKey: string;
  source: string;
  sourceUrl: string;
  lastVerified: string;
  weekend?: string;
  result?: string;
  notes?: string[];
  isBrazilMatch: boolean;
  recurrenceType?: RecurrenceType;
  recurrenceUntil?: string;
};

export type CalendarPack = {
  id: string;
  version: number;
  name: string;
  description: string;
  eyebrow?: string;
  icon: CalendarPackIconId;
  variantGroup?: {
    id: string;
    label: string;
    optionLabel: string;
    selectionMode: "replace";
  };
  year: number;
  datasetStatus: "seed" | "complete";
  updateNote: string;
  source: {
    label: string;
    url: string;
    lastVerified: string;
  };
  profile: {
    id: string;
    name: string;
    icon: ProfileIconId;
  };
  categories: CalendarPackCategory[];
  legacyCategoryIds?: string[];
  events: CalendarPackEvent[];
};
