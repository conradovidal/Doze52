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
  parser_key: string;
  feed_provider: string | null;
  feed_url: string | null;
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
  penaltyResult?: string;
  resultProvider?: string;
  placeholder?: boolean;
};

export type FeedCalendarEvent = OfficialCalendarEvent & {
  provider: string;
  providerExternalId: string;
  status: "scheduled" | "in_progress" | "finished";
};

export type FootballCandidatePayload = {
  provider: string;
  feedEvents: FeedCalendarEvent[];
  officialEvents: OfficialCalendarEvent[];
  reconciledEvents: OfficialCalendarEvent[];
  unmatchedFeedEvents: FeedCalendarEvent[];
};

export type CandidateValidationIssue = {
  code:
    | "empty_source"
    | "invalid_shape"
    | "excessive_removal"
    | "external_id_reused"
    | "participants_changed"
    | "result_conflict";
  message: string;
  eventId?: string;
};

export type CatalogDiff = {
  added: string[];
  changed: string[];
  removed: string[];
};
