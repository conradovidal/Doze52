begin;

create table public.calendar_pack_refresh_lease (
  singleton boolean primary key default true check (singleton),
  run_id uuid references public.calendar_pack_update_runs(id) on delete set null,
  lease_token uuid,
  lease_expires_at timestamptz,
  updated_at timestamptz not null default clock_timestamp()
);

insert into public.calendar_pack_refresh_lease (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.calendar_pack_refresh_lease enable row level security;
alter table public.calendar_pack_refresh_lease force row level security;
revoke all on table public.calendar_pack_refresh_lease
  from public, anon, authenticated;
grant select, insert, update, delete on table public.calendar_pack_refresh_lease
  to service_role;

create or replace function public.claim_calendar_pack_refresh(
  p_trigger_kind text,
  p_requested_by uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_lease public.calendar_pack_refresh_lease%rowtype;
  v_run_id uuid;
  v_token uuid;
  v_retry_after integer;
begin
  if p_trigger_kind not in (
    'scheduled_midnight',
    'scheduled_closing',
    'manual'
  ) then
    raise exception 'invalid calendar refresh trigger' using errcode = '22023';
  end if;

  select * into strict v_lease
  from public.calendar_pack_refresh_lease
  where singleton = true
  for update;

  if v_lease.lease_token is not null
    and v_lease.lease_expires_at > v_now then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (v_lease.lease_expires_at - v_now)))::integer
    );
    return jsonb_build_object(
      'outcome', 'in_progress',
      'activeRunId', v_lease.run_id,
      'retryAfterSeconds', v_retry_after
    );
  end if;

  if v_lease.run_id is not null then
    update public.calendar_pack_update_runs
    set status = 'failed',
        finished_at = coalesce(finished_at, v_now),
        error = coalesce(error, 'refresh_lease_expired')
    where id = v_lease.run_id
      and status = 'running';
  end if;

  insert into public.calendar_pack_update_runs (
    trigger_kind,
    requested_by,
    publish_enabled
  ) values (
    p_trigger_kind,
    p_requested_by,
    true
  ) returning id into v_run_id;

  v_token := gen_random_uuid();
  update public.calendar_pack_refresh_lease
  set run_id = v_run_id,
      lease_token = v_token,
      lease_expires_at = v_now + interval '330 seconds',
      updated_at = v_now
  where singleton = true;

  return jsonb_build_object(
    'outcome', 'acquired',
    'runId', v_run_id,
    'leaseToken', v_token
  );
end;
$$;

create or replace function public.renew_calendar_pack_refresh(
  p_run_id uuid,
  p_lease_token uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated boolean;
begin
  update public.calendar_pack_refresh_lease
  set lease_expires_at = clock_timestamp() + interval '330 seconds',
      updated_at = clock_timestamp()
  where singleton = true
    and run_id = p_run_id
    and lease_token = p_lease_token;
  v_updated := found;
  return v_updated;
end;
$$;

create or replace function public.release_calendar_pack_refresh(
  p_run_id uuid,
  p_lease_token uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated boolean;
begin
  update public.calendar_pack_refresh_lease
  set run_id = null,
      lease_token = null,
      lease_expires_at = null,
      updated_at = clock_timestamp()
  where singleton = true
    and run_id = p_run_id
    and lease_token = p_lease_token;
  v_updated := found;
  return v_updated;
end;
$$;

revoke all on function public.claim_calendar_pack_refresh(text, uuid)
  from public, anon, authenticated;
revoke all on function public.renew_calendar_pack_refresh(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.release_calendar_pack_refresh(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.claim_calendar_pack_refresh(text, uuid)
  to service_role;
grant execute on function public.renew_calendar_pack_refresh(uuid, uuid)
  to service_role;
grant execute on function public.release_calendar_pack_refresh(uuid, uuid)
  to service_role;

commit;
