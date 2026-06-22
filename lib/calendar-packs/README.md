# Calendar Packs

Calendar Packs are structured seeds that import into the existing Doze 52 data model:
profiles, categories, and events. They should not create a parallel calendar model unless
the product needs pack-specific lifecycle metadata later.

## Current packs

- `world-cup-2026-pack.json`: 104 mapped tournament events. The UI exposes this as
  two subscription options: Jogos do Brasil and Copa de 2026.
- `formula-1-2026-pack.json`: Formula 1 2026 events listed by the official F1 calendar
  on 2026-06-03, exposed as Corridas F1.

Keep pack `profile.id`, category `id`s, and event `id`s stable. Importing the same pack
must remain idempotent for users who already added it. Packs are tracked by category and
event IDs, not by the profile where the category currently lives; users can move imported
categories between profiles without losing add/remove detection.

The app UI must present this as a Doze 52 feature and must not use official tournament
marks, emblems, mascots, or wording that suggests official association, partnership, or
licensing.

## Update policy

- Keep pack category and event IDs stable. Update event fields in place so users can
  refresh a pack without duplicating events.
- Pack updates must preserve the user's current profile organization. Categories are
  matched by pack category IDs even after a user moves them to another profile.
- When source data changes, update `source.lastVerified`, event `lastVerified`, and the
  relevant event fields. The launcher will surface an update indicator for already-added
  packs whose local events no longer match the current seed.
- For knockout rounds, keep the placeholder event IDs and replace titles/notes as teams
  advance. Results can be added later through `result` or notes without changing IDs.
