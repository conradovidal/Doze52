begin;

create table if not exists private.calendar_snapshot_limits (
  config_key text primary key check (config_key = 'default'),
  max_payload_bytes bigint not null check (max_payload_bytes > 0),
  max_profiles integer not null check (max_profiles > 0),
  max_categories integer not null check (max_categories > 0),
  max_events integer not null check (max_events > 0),
  max_calendar_pack_groups integer not null check (max_calendar_pack_groups > 0),
  free_profiles integer not null check (free_profiles > 0),
  free_categories integer not null check (free_categories > 0),
  free_calendar_pack_groups integer not null check (free_calendar_pack_groups > 0),
  updated_at timestamptz not null default now()
);

insert into private.calendar_snapshot_limits (
  config_key,
  max_payload_bytes,
  max_profiles,
  max_categories,
  max_events,
  max_calendar_pack_groups,
  free_profiles,
  free_categories,
  free_calendar_pack_groups
) values (
  'default',
  8388608,
  50,
  250,
  10000,
  50,
  1,
  3,
  1
)
on conflict (config_key) do nothing;

revoke all on table private.calendar_snapshot_limits
  from public, anon, authenticated;
grant select, insert, update, delete on table private.calendar_snapshot_limits
  to service_role;

create or replace function private.replace_calendar_snapshot(
  p_profiles jsonb,
  p_categories jsonb,
  p_events jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limits private.calendar_snapshot_limits%rowtype;
  v_payload_bytes bigint;
  v_profile_count integer;
  v_category_count integer;
  v_event_count integer;
  v_pack_group_count integer;
  v_current_profile_count integer;
  v_current_category_count integer;
  v_current_pack_group_count integer;
  v_affected integer;
  v_is_pro boolean;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_profiles is null
    or p_categories is null
    or p_events is null
    or jsonb_typeof(p_profiles) <> 'array'
    or jsonb_typeof(p_categories) <> 'array'
    or jsonb_typeof(p_events) <> 'array' then
    raise exception 'snapshot payload must contain arrays'
      using errcode = '22023';
  end if;

  select * into strict v_limits
  from private.calendar_snapshot_limits
  where config_key = 'default';

  v_payload_bytes :=
    octet_length(p_profiles::text)
    + octet_length(p_categories::text)
    + octet_length(p_events::text);
  v_profile_count := jsonb_array_length(p_profiles);
  v_category_count := jsonb_array_length(p_categories);
  v_event_count := jsonb_array_length(p_events);

  if v_payload_bytes > v_limits.max_payload_bytes then
    raise exception 'snapshot_payload_too_large' using errcode = 'P0001';
  end if;
  if v_profile_count > v_limits.max_profiles then
    raise exception 'snapshot_profile_limit' using errcode = 'P0001';
  end if;
  if v_category_count > v_limits.max_categories then
    raise exception 'snapshot_category_limit' using errcode = 'P0001';
  end if;
  if v_event_count > v_limits.max_events then
    raise exception 'snapshot_event_limit' using errcode = 'P0001';
  end if;

  if (
    select count(distinct profile.id)
    from jsonb_to_recordset(p_profiles) as profile(id uuid)
  ) <> v_profile_count then
    raise exception 'snapshot profile IDs must be present and unique'
      using errcode = '22023';
  end if;
  if (
    select count(distinct category.id)
    from jsonb_to_recordset(p_categories) as category(id uuid)
  ) <> v_category_count then
    raise exception 'snapshot category IDs must be present and unique'
      using errcode = '22023';
  end if;
  if (
    select count(distinct event.id)
    from jsonb_to_recordset(p_events) as event(id uuid)
  ) <> v_event_count then
    raise exception 'snapshot event IDs must be present and unique'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_categories) as category(profile_id uuid)
    where category.profile_id is null
      or not exists (
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
    where event.category_id is null
      or not exists (
        select 1
        from jsonb_to_recordset(p_categories) as category(id uuid)
        where category.id = event.category_id
      )
  ) then
    raise exception 'event references a category outside the snapshot'
      using errcode = '23503';
  end if;

  select count(*) into v_pack_group_count
  from (
    select category.calendar_pack_group_id
    from jsonb_to_recordset(p_categories)
      as category(calendar_pack_group_id text)
    where category.calendar_pack_group_id is not null
    union
    select event.calendar_pack_group_id
    from jsonb_to_recordset(p_events)
      as event(calendar_pack_group_id text)
    where event.calendar_pack_group_id is not null
  ) as incoming_groups;

  if v_pack_group_count > v_limits.max_calendar_pack_groups then
    raise exception 'snapshot_calendar_pack_limit' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select count(*) into v_current_profile_count
  from public.calendar_profiles
  where user_id = v_user_id;

  select count(*) into v_current_category_count
  from public.categories
  where user_id = v_user_id;

  select count(*) into v_current_pack_group_count
  from (
    select category.calendar_pack_group_id
    from public.categories as category
    where category.user_id = v_user_id
      and category.calendar_pack_group_id is not null
    union
    select event.calendar_pack_group_id
    from public.events as event
    where event.user_id = v_user_id
      and event.calendar_pack_group_id is not null
  ) as current_groups;

  v_is_pro := private.is_pro(v_user_id);
  if not v_is_pro then
    if v_profile_count > greatest(
      v_limits.free_profiles,
      v_current_profile_count
    ) then
      raise exception 'free_snapshot_profile_limit' using errcode = 'P0001';
    end if;
    if v_category_count > greatest(
      v_limits.free_categories,
      v_current_category_count
    ) then
      raise exception 'free_snapshot_category_limit' using errcode = 'P0001';
    end if;
    if v_pack_group_count > greatest(
      v_limits.free_calendar_pack_groups,
      v_current_pack_group_count
    ) then
      raise exception 'free_snapshot_calendar_pack_limit' using errcode = 'P0001';
    end if;
  end if;

  if exists (
    select 1
    from public.calendar_profiles as existing
    join jsonb_to_recordset(p_profiles) as incoming(id uuid)
      on incoming.id = existing.id
    where existing.user_id <> v_user_id
  ) or exists (
    select 1
    from public.categories as existing
    join jsonb_to_recordset(p_categories) as incoming(id uuid)
      on incoming.id = existing.id
    where existing.user_id <> v_user_id
  ) or exists (
    select 1
    from public.events as existing
    join jsonb_to_recordset(p_events) as incoming(id uuid)
      on incoming.id = existing.id
    where existing.user_id <> v_user_id
  ) then
    raise exception 'snapshot contains IDs owned by another user'
      using errcode = '42501';
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
    updated_at = now()
  where calendar_profiles.user_id = v_user_id;

  get diagnostics v_affected = row_count;
  if v_affected <> v_profile_count then
    raise exception 'snapshot profile ownership changed concurrently'
      using errcode = '42501';
  end if;

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
    updated_at = now()
  where categories.user_id = v_user_id;

  get diagnostics v_affected = row_count;
  if v_affected <> v_category_count then
    raise exception 'snapshot category ownership changed concurrently'
      using errcode = '42501';
  end if;

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
    updated_at = now()
  where events.user_id = v_user_id;

  get diagnostics v_affected = row_count;
  if v_affected <> v_event_count then
    raise exception 'snapshot event ownership changed concurrently'
      using errcode = '42501';
  end if;

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

revoke all on function private.replace_calendar_snapshot(jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
grant execute on function private.replace_calendar_snapshot(jsonb, jsonb, jsonb)
  to authenticated, service_role;

create or replace function public.replace_calendar_snapshot(
  p_profiles jsonb,
  p_categories jsonb,
  p_events jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.replace_calendar_snapshot(
    p_profiles,
    p_categories,
    p_events
  );
end;
$$;

revoke all on function public.replace_calendar_snapshot(jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_calendar_snapshot(jsonb, jsonb, jsonb)
  to authenticated, service_role;

revoke insert, update, delete, truncate, references, trigger
  on table public.calendar_profiles, public.categories, public.events
  from authenticated;
grant select
  on table public.calendar_profiles, public.categories, public.events
  to authenticated;

commit;
