import type { CalendarPack } from "@/lib/calendar-packs/types";

export type CalendarCatalog = {
  schemaVersion: 1;
  releaseId: string | null;
  version: number;
  publishedAt: string | null;
  materialHash: string;
  packs: CalendarPack[];
};

export type SourceRolloutStatus = "pending" | "shadow" | "active" | "paused";

export type CalendarCatalogSource = {
  id: string;
  authority: string;
  competition: string;
  season: number;
  official_url: string;
  fetch_url: string | null;
  parser_key: string;
  rollout_status: SourceRolloutStatus;
  freshness_hours: number;
  last_checked_at: string | null;
  last_successful_at: string | null;
  last_error: string | null;
};

export type OfficialCalendarEvent = {
  externalId: string;
  competition: string;
  season: number;
  date: string;
  time: string;
  timezone: string;
  city: string;
  venue: string;
  phase: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: string;
  awayTeamId?: string;
  result?: string;
  placeholder?: boolean;
};

export type CandidateValidationIssue = {
  code:
    | "empty_source"
    | "invalid_shape"
    | "excessive_removal"
    | "external_id_reused"
    | "participants_changed";
  message: string;
  eventId?: string;
};

export type CatalogDiff = {
  added: string[];
  changed: string[];
  removed: string[];
};
