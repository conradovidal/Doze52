create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null,
  visible boolean not null default true,
  position int4 not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  category_id uuid not null,
  start_date date not null,
  end_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  day_order int4 not null default 0,
  constraint events_end_after_start check (end_date >= start_date)
);

alter table public.categories
  drop constraint if exists categories_user_id_id_unique;

alter table public.categories
  add constraint categories_user_id_id_unique unique (user_id, id);

alter table public.events
  drop constraint if exists events_category_id_fkey;

alter table public.events
  drop constraint if exists events_user_id_category_id_fkey;

alter table public.events
  add constraint events_user_id_category_id_fkey
  foreign key (user_id, category_id)
  references public.categories(user_id, id)
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

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create index if not exists idx_categories_user_position
  on public.categories(user_id, position);

create index if not exists idx_events_user_start_date
  on public.events(user_id, start_date);

create index if not exists idx_events_user_end_date
  on public.events(user_id, end_date);

create index if not exists idx_events_user_created_at
  on public.events(user_id, created_at);

alter table public.categories enable row level security;
alter table public.events enable row level security;
alter table public.categories force row level security;
alter table public.events force row level security;

drop policy if exists categories_select_own on public.categories;
create policy categories_select_own on public.categories
for select using (auth.uid() = user_id);

drop policy if exists categories_insert_own on public.categories;
create policy categories_insert_own on public.categories
for insert with check (auth.uid() = user_id);

drop policy if exists categories_update_own on public.categories;
create policy categories_update_own on public.categories
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists categories_delete_own on public.categories;
create policy categories_delete_own on public.categories
for delete using (auth.uid() = user_id);

drop policy if exists events_select_own on public.events;
create policy events_select_own on public.events
for select using (auth.uid() = user_id);

drop policy if exists events_insert_own on public.events;
create policy events_insert_own on public.events
for insert with check (auth.uid() = user_id);

drop policy if exists events_update_own on public.events;
create policy events_update_own on public.events
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists events_delete_own on public.events;
create policy events_delete_own on public.events
for delete using (auth.uid() = user_id);

revoke all on table public.categories from anon;
revoke all on table public.events from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.categories to authenticated;
grant select, insert, update, delete on table public.events to authenticated;
