begin;

-- Incremental records: UI snapshots must never replace another device's work.
create table public.continuity_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('habit','checkin','onboarding')),
  entity_id text not null check (length(entity_id) between 1 and 100),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, entity_id)
);
create table public.continuity_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  request jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id, operation_id)
);
alter table public.continuity_records enable row level security;
alter table public.continuity_records force row level security;
alter table public.continuity_operations enable row level security;
alter table public.continuity_operations force row level security;
create policy continuity_read_own on public.continuity_records for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.continuity_records, public.continuity_operations from public, anon, authenticated;
grant select on public.continuity_records to authenticated;

create function public.continuity_contract_version() returns integer
language sql immutable security invoker set search_path = '' as $$ select 1 $$;
revoke all on function public.continuity_contract_version() from public, anon;
grant execute on function public.continuity_contract_version() to authenticated;

-- The wrapper exposes only the validated operation, never arbitrary table writes.
create function private.apply_continuity_operation(op jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  op_id uuid := (op->>'operationId')::uuid;
  record_kind text := op->>'kind';
  record_id text := op->>'entityId';
  body jsonb := op->'payload';
  expected bigint := (op->>'baseRevision')::bigint;
  old public.continuity_records%rowtype;
  saved public.continuity_operations%rowtype;
  result jsonb;
  is_delete boolean := coalesce((op->>'delete')::boolean,false);
  is_restore boolean := coalesce((op->>'restore')::boolean,false);
  active_count integer;
  habit_limit integer;
  parent_id text;
begin
  if owner_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  if op_id is null or record_kind not in ('habit','checkin','onboarding') or record_kind is null
    or record_id is null or length(record_id)>100 or expected is null or expected < 0
    or body is null or jsonb_typeof(body)<>'object' or octet_length(op::text)>16384 then
    raise exception 'invalid operation' using errcode='22023';
  end if;
  -- Serialize per account: concurrent creates cannot exceed the plan limit.
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 19));
  select * into saved from public.continuity_operations where user_id=owner_id and operation_id=op_id;
  if found then
    if saved.request <> op then raise exception 'operation id reused' using errcode='22023'; end if;
    return saved.result;
  end if;
  select * into old from public.continuity_records
    where user_id=owner_id and kind=record_kind and entity_id=record_id for update;
  if coalesce(old.revision,0) <> expected or (old.deleted_at is not null and not is_restore) then
    result := jsonb_build_object('status','conflict','record',case when old.revision is null then null else to_jsonb(old) end);
  else
    if record_kind='habit' then
      perform record_id::uuid;
      if body->>'id' is distinct from record_id or length(btrim(coalesce(body->>'name',''))) not between 1 and 120
        or coalesce(body->>'color','') !~ '^#[0-9A-Fa-f]{6}$'
        or coalesce(body->>'icon','') <> 'circle-check'
        or coalesce((body->>'position')::integer,-1) < 0 then
        raise exception 'invalid habit' using errcode='22023';
      end if;
      if not is_delete and nullif(body->>'archivedAt','') is null
        and (old.revision is null or old.deleted_at is not null or nullif(old.payload->>'archivedAt','') is not null) then
        habit_limit := case when private.is_pro(owner_id) then 4 else 1 end;
        select count(*) into active_count from public.continuity_records
          where user_id=owner_id and kind='habit' and entity_id<>record_id and deleted_at is null
            and nullif(payload->>'archivedAt','') is null;
        if active_count >= habit_limit then
          return jsonb_build_object('status','limit','limit',habit_limit);
        end if;
      end if;
    elsif record_kind='checkin' then
      parent_id := body->>'habitId';
      perform parent_id::uuid;
      if body->>'date' is null or (body->>'date') !~ '^\d{4}-\d{2}-\d{2}$'
        or record_id is distinct from parent_id || ':' || (body->>'date')
        or jsonb_typeof(body->'completed') is distinct from 'boolean' then
        raise exception 'invalid checkin' using errcode='22023';
      end if;
      perform (body->>'date')::date;
      if not exists(select 1 from public.continuity_records where user_id=owner_id and kind='habit'
        and entity_id=parent_id and deleted_at is null) then
        raise exception 'habit unavailable' using errcode='23503';
      end if;
    else
      if record_id <> 'annual' or is_delete or is_restore
        or coalesce(body->>'status','') not in ('pending','in_progress','completed','dismissed')
        or coalesce(body->>'origin','') not in ('mobile','desktop')
        or coalesce((body->>'version')::integer,0) < 1 then
        raise exception 'invalid onboarding' using errcode='22023';
      end if;
      -- Completion is monotonic, even a client with the latest revision cannot undo it.
      if old.payload->>'status'='completed' then body := old.payload; end if;
    end if;
    insert into public.continuity_records(user_id,kind,entity_id,payload,revision,deleted_at)
      values(owner_id,record_kind,record_id,body,coalesce(old.revision,0)+1,case when is_delete then now() else null end)
      on conflict(user_id,kind,entity_id) do update set payload=excluded.payload,
        revision=excluded.revision,deleted_at=excluded.deleted_at,updated_at=now()
      returning jsonb_build_object('status','applied','record',to_jsonb(continuity_records)) into result;
  end if;
  insert into public.continuity_operations(user_id,operation_id,request,result) values(owner_id,op_id,op,result);
  return result;
end $$;
revoke all on function private.apply_continuity_operation(jsonb) from public, anon;
grant execute on function private.apply_continuity_operation(jsonb) to authenticated;
create function public.apply_continuity_operation(op jsonb) returns jsonb
language sql security invoker set search_path = '' as $$ select private.apply_continuity_operation(op) $$;
revoke all on function public.apply_continuity_operation(jsonb) from public, anon;
grant execute on function public.apply_continuity_operation(jsonb) to authenticated;
create function public.continuity_habit_limit() returns integer
language sql stable security invoker set search_path = '' as $$
 select case when private.is_pro(auth.uid()) then 4 else 1 end
$$;
revoke all on function public.continuity_habit_limit() from public, anon;
grant execute on function public.continuity_habit_limit() to authenticated;
commit;
