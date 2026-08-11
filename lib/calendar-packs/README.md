# Calendar Packs

Calendar Packs are structured, versioned seeds that import into the existing Doze 52
data model. Categories remain customizable, while imported events are managed and
read-only. Provenance fields on categories and events drive automatic reconciliation.

The compiled files in this directory are now the disaster-recovery fallback. The live
catalog is stored as immutable Supabase releases and served by `/api/calendar-packs`.
See `docs/calendar-catalog-operations.md` for sources, schedules, quarantine and rollout.

## Current packs

- `world-cup-2026-pack.json`: tournament events exposed as two exclusive coverage
  options: only Brazil or the full World Cup.
- `formula-1-2026-pack.json`: Formula 1 2026 events listed by the official F1 calendar
  on 2026-06-03, exposed as Corridas F1.
- `holidays-2026.ts`: recurring national holidays plus all Brazilian state and Federal
  District variants. Fixed dates recur yearly from 2025 and mobile dates are calculated
  through 2100. Optional government closure dates are intentionally excluded.
- `brasileirao-2026.ts`: 20 club variants in alphabetical order, aggregating officially
  confirmed 2026 matches from Brasileirão, Copa do Brasil, Libertadores and
  Sul-Americana according to each club's participation.

Keep pack `profile.id`, category `id`s, and event `id`s stable. Importing the same pack
must remain idempotent for users who already added it. Packs are tracked by stable IDs and
persisted provenance, not by category name, color, or profile. Those three fields belong
to the user and must survive imports, variant changes, and automatic updates.

The app UI must present this as a Doze 52 feature and must not use official tournament
marks, emblems, mascots, or wording that suggests official association, partnership, or
licensing.

## Update policy

- Keep pack category and event IDs stable. Update event fields in place so users can
  receive changes without duplicating events.
- Increment `version` only for material user-visible changes. Updating only
  `lastVerified` must not create a new version.
- Pack updates must preserve category name, color, profile, visibility, and ordering.
- When source data changes, update `source.lastVerified`, event `lastVerified`, and the
  relevant event fields. Installed packs reconcile automatically on the next app load.
- Imported events are read-only. Personal events cannot be created or moved into a pack
  category, but legacy personal events found there must be preserved.
- For knockout rounds, keep the placeholder event IDs and replace titles/notes as teams
  advance. Results can be added later through `result` or notes without changing IDs.
