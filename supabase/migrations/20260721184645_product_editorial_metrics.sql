begin;

create table if not exists public.product_funnel_state (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  planning_context text check (
    planning_context is null or planning_context in ('personal', 'work', 'custom')
  ),
  onboarding_started_at timestamptz,
  profile_configured_at timestamptz,
  first_point_event_at timestamptz,
  first_period_at timestamptz,
  onboarding_completed_at timestamptz,
  first_touch_source text check (
    first_touch_source is null or char_length(first_touch_source) <= 120
  ),
  first_touch_medium text check (
    first_touch_medium is null or char_length(first_touch_medium) <= 120
  ),
  first_touch_campaign text check (
    first_touch_campaign is null or char_length(first_touch_campaign) <= 120
  ),
  first_touch_content text check (
    first_touch_content is null or char_length(first_touch_content) <= 120
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_funnel_timestamps_ordered check (
    (profile_configured_at is null or onboarding_started_at is null or profile_configured_at >= onboarding_started_at)
    and (first_point_event_at is null or onboarding_started_at is null or first_point_event_at >= onboarding_started_at)
    and (first_period_at is null or onboarding_started_at is null or first_period_at >= onboarding_started_at)
    and (onboarding_completed_at is null or onboarding_started_at is null or onboarding_completed_at >= onboarding_started_at)
  )
);

create table if not exists public.product_activity_days (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  activity_date date not null default current_date,
  first_activity_at timestamptz not null default now(),
  primary key (user_id, activity_date),
  constraint product_activity_not_future check (activity_date <= current_date)
);

drop trigger if exists product_funnel_state_set_updated_at on public.product_funnel_state;
create trigger product_funnel_state_set_updated_at
before update on public.product_funnel_state
for each row execute function public.set_updated_at();

create index if not exists idx_product_funnel_completed_at
  on public.product_funnel_state(onboarding_completed_at)
  where onboarding_completed_at is not null;

create index if not exists idx_product_activity_days_date
  on public.product_activity_days(activity_date desc);

alter table public.product_funnel_state enable row level security;
alter table public.product_activity_days enable row level security;
alter table public.product_funnel_state force row level security;
alter table public.product_activity_days force row level security;

drop policy if exists product_funnel_select_own on public.product_funnel_state;
create policy product_funnel_select_own on public.product_funnel_state
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists product_funnel_insert_own on public.product_funnel_state;
create policy product_funnel_insert_own on public.product_funnel_state
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists product_funnel_update_own on public.product_funnel_state;
create policy product_funnel_update_own on public.product_funnel_state
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists product_activity_select_own on public.product_activity_days;
create policy product_activity_select_own on public.product_activity_days
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists product_activity_insert_own on public.product_activity_days;
create policy product_activity_insert_own on public.product_activity_days
for insert to authenticated
with check ((select auth.uid()) = user_id);

revoke all on table public.product_funnel_state from public, anon, authenticated;
revoke all on table public.product_activity_days from public, anon, authenticated;

grant select, insert, update on table public.product_funnel_state to authenticated;
grant select, insert on table public.product_activity_days to authenticated;

commit;
