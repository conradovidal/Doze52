begin;

alter function public.repair_calendar_snapshot(
  uuid, uuid, jsonb, jsonb, jsonb, text, text, jsonb
) rename to repair_calendar_snapshot_unchecked;

revoke all on function public.repair_calendar_snapshot_unchecked(
  uuid, uuid, jsonb, jsonb, jsonb, text, text, jsonb
) from public, anon, authenticated, service_role;

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
begin
  if auth.role() <> 'service_role' and current_user <> 'postgres' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_run_id::text || ':' || p_user_id::text, 0)
  );

  if exists (
    select 1
    from private.calendar_pack_repair_backups backup
    where backup.run_id = p_run_id
      and backup.user_id = p_user_id
      and backup.applied_at is not null
  ) then
    return;
  end if;

  perform public.repair_calendar_snapshot_unchecked(
    p_run_id,
    p_user_id,
    p_profiles,
    p_categories,
    p_events,
    p_before_hash,
    p_after_hash,
    p_result
  );
end;
$$;

revoke all on function public.repair_calendar_snapshot(
  uuid, uuid, jsonb, jsonb, jsonb, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.repair_calendar_snapshot(
  uuid, uuid, jsonb, jsonb, jsonb, text, text, jsonb
) to service_role;

commit;
