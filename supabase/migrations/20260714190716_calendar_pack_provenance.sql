begin;

alter table public.categories
  add column if not exists calendar_pack_group_id text,
  add column if not exists calendar_pack_variant_id text,
  add column if not exists calendar_pack_category_key text,
  add column if not exists calendar_pack_version integer;

alter table public.events
  add column if not exists calendar_pack_group_id text,
  add column if not exists calendar_pack_event_key text;

alter table public.categories
  drop constraint if exists categories_calendar_pack_provenance_check;

alter table public.categories
  add constraint categories_calendar_pack_provenance_check check (
    (
      calendar_pack_group_id is null
      and calendar_pack_variant_id is null
      and calendar_pack_category_key is null
      and calendar_pack_version is null
    )
    or (
      calendar_pack_group_id is not null
      and calendar_pack_variant_id is not null
      and calendar_pack_category_key is not null
      and calendar_pack_version is not null
      and calendar_pack_version > 0
    )
  );

alter table public.events
  drop constraint if exists events_calendar_pack_provenance_check;

alter table public.events
  add constraint events_calendar_pack_provenance_check check (
    (calendar_pack_group_id is null and calendar_pack_event_key is null)
    or (calendar_pack_group_id is not null and calendar_pack_event_key is not null)
  );

create index if not exists idx_categories_user_calendar_pack_group
  on public.categories(user_id, calendar_pack_group_id)
  where calendar_pack_group_id is not null;

create index if not exists idx_events_user_calendar_pack_group
  on public.events(user_id, calendar_pack_group_id)
  where calendar_pack_group_id is not null;

alter table public.categories enable row level security;
alter table public.categories force row level security;
alter table public.events enable row level security;
alter table public.events force row level security;

grant select, insert, update, delete on table public.categories to authenticated;
grant select, insert, update, delete on table public.events to authenticated;

commit;
