begin;

create unique index if not exists categories_user_calendar_pack_identity_unique
  on public.categories (
    user_id,
    calendar_pack_group_id,
    calendar_pack_category_key
  )
  where calendar_pack_group_id is not null;

create unique index if not exists events_user_calendar_pack_identity_unique
  on public.events (
    user_id,
    calendar_pack_group_id,
    calendar_pack_event_key
  )
  where calendar_pack_group_id is not null;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.calendar_pack_repair_backups (
  run_id uuid not null,
  user_id uuid not null,
  captured_at timestamptz not null default now(),
  before_hash text not null,
  after_hash text,
  applied_at timestamptz,
  snapshot jsonb not null,
  result jsonb,
  primary key (run_id, user_id)
);

revoke all on table private.calendar_pack_repair_backups
  from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update on table private.calendar_pack_repair_backups
  to service_role;

create or replace function public.calendar_sync_contract_version()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select 1;
$$;

revoke all on function public.calendar_sync_contract_version()
  from public, anon;
grant execute on function public.calendar_sync_contract_version()
  to authenticated;

create or replace function public.replace_calendar_snapshot(
  p_profiles jsonb,
  p_categories jsonb,
  p_events jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if jsonb_typeof(p_profiles) <> 'array'
    or jsonb_typeof(p_categories) <> 'array'
    or jsonb_typeof(p_events) <> 'array' then
    raise exception 'snapshot payload must contain arrays'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_categories) as category(profile_id uuid)
    where not exists (
      select 1
      from jsonb_to_recordset(p_profiles) as profile(id uuid)
      where profile.id = category.profile_id
    )
  ) then
    raise exception 'category references a profile outside the snapshot'
      using errcode = '23503';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_events) as event(category_id uuid)
    where not exists (
      select 1
      from jsonb_to_recordset(p_categories) as category(id uuid)
      where category.id = event.category_id
    )
  ) then
    raise exception 'event references a category outside the snapshot'
      using errcode = '23503';
  end if;

  insert into public.calendar_profiles (
    id, user_id, name, color, icon, position
  )
  select
    profile.id,
    v_user_id,
    profile.name,
    profile.color,
    profile.icon,
    profile.position
  from jsonb_to_recordset(p_profiles) as profile(
    id uuid,
    name text,
    color text,
    icon text,
    position integer
  )
  on conflict (id) do update set
    name = excluded.name,
    color = excluded.color,
    icon = excluded.icon,
    position = excluded.position,
    updated_at = now();

  insert into public.categories (
    id,
    user_id,
    profile_id,
    name,
    color,
    visible,
    calendar_pack_group_id,
    calendar_pack_variant_id,
    calendar_pack_category_key,
    calendar_pack_version,
    position
  )
  select
    category.id,
    v_user_id,
    category.profile_id,
    category.name,
    category.color,
    category.visible,
    category.calendar_pack_group_id,
    category.calendar_pack_variant_id,
    category.calendar_pack_category_key,
    category.calendar_pack_version,
    category.position
  from jsonb_to_recordset(p_categories) as category(
    id uuid,
    profile_id uuid,
    name text,
    color text,
    visible boolean,
    calendar_pack_group_id text,
    calendar_pack_variant_id text,
    calendar_pack_category_key text,
    calendar_pack_version integer,
    position integer
  )
  on conflict (id) do update set
    profile_id = excluded.profile_id,
    name = excluded.name,
    color = excluded.color,
    visible = excluded.visible,
    calendar_pack_group_id = excluded.calendar_pack_group_id,
    calendar_pack_variant_id = excluded.calendar_pack_variant_id,
    calendar_pack_category_key = excluded.calendar_pack_category_key,
    calendar_pack_version = excluded.calendar_pack_version,
    position = excluded.position,
    updated_at = now();

  insert into public.events (
    id,
    user_id,
    title,
    category_id,
    start_date,
    end_date,
    notes,
    recurrence_type,
    recurrence_until,
    day_order,
    created_at,
    calendar_pack_group_id,
    calendar_pack_event_key
  )
  select
    event.id,
    v_user_id,
    event.title,
    event.category_id,
    event.start_date,
    event.end_date,
    event.notes,
    event.recurrence_type,
    event.recurrence_until,
    event.day_order,
    event.created_at,
    event.calendar_pack_group_id,
    event.calendar_pack_event_key
  from jsonb_to_recordset(p_events) as event(
    id uuid,
    title text,
    category_id uuid,
    start_date date,
    end_date date,
    notes text,
    recurrence_type text,
    recurrence_until date,
    day_order integer,
    created_at timestamptz,
    calendar_pack_group_id text,
    calendar_pack_event_key text
  )
  on conflict (id) do update set
    title = excluded.title,
    category_id = excluded.category_id,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    notes = excluded.notes,
    recurrence_type = excluded.recurrence_type,
    recurrence_until = excluded.recurrence_until,
    day_order = excluded.day_order,
    calendar_pack_group_id = excluded.calendar_pack_group_id,
    calendar_pack_event_key = excluded.calendar_pack_event_key,
    updated_at = now();

  delete from public.events as existing
  where existing.user_id = v_user_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_events) as incoming(id uuid)
      where incoming.id = existing.id
    );

  delete from public.categories as existing
  where existing.user_id = v_user_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_categories) as incoming(id uuid)
      where incoming.id = existing.id
    );

  delete from public.calendar_profiles as existing
  where existing.user_id = v_user_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_profiles) as incoming(id uuid)
      where incoming.id = existing.id
    );
end;
$$;

revoke all on function public.replace_calendar_snapshot(jsonb, jsonb, jsonb)
  from public, anon;
grant execute on function public.replace_calendar_snapshot(jsonb, jsonb, jsonb)
  to authenticated;

create or replace function public.repair_calendar_snapshot(
  p_run_id uuid,
  p_user_id uuid,
  p_profiles jsonb,
  p_categories jsonb,
  p_events jsonb,
  p_before_hash text,
  p_after_hash text,
  p_result jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_snapshot jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'profiles', coalesce((
      select jsonb_agg(to_jsonb(profile) order by profile.position, profile.id)
      from public.calendar_profiles profile
      where profile.user_id = p_user_id
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(to_jsonb(category) order by category.position, category.id)
      from public.categories category
      where category.user_id = p_user_id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(event) order by event.start_date, event.id)
      from public.events event
      where event.user_id = p_user_id
    ), '[]'::jsonb)
  ) into v_snapshot;

  insert into private.calendar_pack_repair_backups (
    run_id, user_id, before_hash, snapshot
  ) values (
    p_run_id, p_user_id, p_before_hash, v_snapshot
  )
  on conflict (run_id, user_id) do nothing;

  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform public.replace_calendar_snapshot(p_profiles, p_categories, p_events);

  update private.calendar_pack_repair_backups
  set
    after_hash = p_after_hash,
    applied_at = now(),
    result = p_result
  where run_id = p_run_id
    and user_id = p_user_id;
end;
$$;

revoke all on function public.repair_calendar_snapshot(
  uuid, uuid, jsonb, jsonb, jsonb, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.repair_calendar_snapshot(
  uuid, uuid, jsonb, jsonb, jsonb, text, text, jsonb
) to service_role;

commit;
