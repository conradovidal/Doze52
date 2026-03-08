begin;

create table if not exists public.calendar_profiles (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null,
  position int4 not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_profiles
  drop constraint if exists calendar_profiles_user_id_id_unique;

alter table public.calendar_profiles
  add constraint calendar_profiles_user_id_id_unique unique (user_id, id);

alter table public.categories
  add column if not exists profile_id uuid;

insert into public.calendar_profiles (id, user_id, name, color, position)
select gen_random_uuid(), source.user_id, 'Pessoal', '#64748B', 0
from (
  select distinct user_id
  from public.categories
) as source
where not exists (
  select 1
  from public.calendar_profiles profile
  where profile.user_id = source.user_id
);

update public.categories as category
set profile_id = chosen_profile.id
from lateral (
  select profile.id
  from public.calendar_profiles profile
  where profile.user_id = category.user_id
  order by profile.position asc, profile.created_at asc, profile.id asc
  limit 1
) as chosen_profile
where category.profile_id is null;

alter table public.categories
  alter column profile_id set not null;

alter table public.categories
  drop constraint if exists categories_user_id_profile_id_fkey;

alter table public.categories
  add constraint categories_user_id_profile_id_fkey
  foreign key (user_id, profile_id)
  references public.calendar_profiles(user_id, id)
  on delete restrict;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists calendar_profiles_set_updated_at on public.calendar_profiles;
create trigger calendar_profiles_set_updated_at
before update on public.calendar_profiles
for each row execute function public.set_updated_at();

alter table public.calendar_profiles enable row level security;
alter table public.calendar_profiles force row level security;

drop policy if exists calendar_profiles_select_own on public.calendar_profiles;
create policy calendar_profiles_select_own on public.calendar_profiles
for select using (auth.uid() = user_id);

drop policy if exists calendar_profiles_insert_own on public.calendar_profiles;
create policy calendar_profiles_insert_own on public.calendar_profiles
for insert with check (auth.uid() = user_id);

drop policy if exists calendar_profiles_update_own on public.calendar_profiles;
create policy calendar_profiles_update_own on public.calendar_profiles
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists calendar_profiles_delete_own on public.calendar_profiles;
create policy calendar_profiles_delete_own on public.calendar_profiles
for delete using (auth.uid() = user_id);

create index if not exists idx_calendar_profiles_user_position
  on public.calendar_profiles(user_id, position);

create index if not exists idx_categories_user_profile_position
  on public.categories(user_id, profile_id, position);

revoke all on table public.calendar_profiles from anon;
grant select, insert, update, delete on table public.calendar_profiles to authenticated;

commit;
