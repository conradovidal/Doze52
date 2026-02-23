begin;

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

grant usage on schema public to authenticated;
revoke all on table public.categories from anon;
revoke all on table public.events from anon;
grant select, insert, update, delete on table public.categories to authenticated;
grant select, insert, update, delete on table public.events to authenticated;

commit;
