create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null,
  visible boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category_id uuid not null references public.categories(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  day_order jsonb not null default '{}'::jsonb
);

alter table public.categories enable row level security;
alter table public.events enable row level security;

create policy if not exists categories_select_own on public.categories
for select using (auth.uid() = user_id);

create policy if not exists categories_insert_own on public.categories
for insert with check (auth.uid() = user_id);

create policy if not exists categories_update_own on public.categories
for update using (auth.uid() = user_id);

create policy if not exists categories_delete_own on public.categories
for delete using (auth.uid() = user_id);

create policy if not exists events_select_own on public.events
for select using (auth.uid() = user_id);

create policy if not exists events_insert_own on public.events
for insert with check (auth.uid() = user_id);

create policy if not exists events_update_own on public.events
for update using (auth.uid() = user_id);

create policy if not exists events_delete_own on public.events
for delete using (auth.uid() = user_id);
