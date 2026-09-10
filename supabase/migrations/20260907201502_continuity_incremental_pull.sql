begin;
alter table public.continuity_records add column change_seq bigint generated always as identity;
create index continuity_changes_by_owner on public.continuity_records(user_id, change_seq);
create function private.advance_continuity_cursor() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 new.change_seq := nextval(pg_get_serial_sequence('public.continuity_records','change_seq'));
 return new;
end $$;
revoke all on function private.advance_continuity_cursor() from public,anon,authenticated;
create trigger continuity_changed before update on public.continuity_records
for each row execute function private.advance_continuity_cursor();
create function public.pull_continuity_changes(after_sequence bigint default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_id uuid := auth.uid(); result jsonb;
begin
 if owner_id is null then raise exception 'authentication required' using errcode='42501'; end if;
 if after_sequence is null or after_sequence < 0 then raise exception 'invalid cursor' using errcode='22023'; end if;
 -- The same owner lock as writes prevents a late transaction from falling behind the cursor.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 19));
 select coalesce(jsonb_agg(to_jsonb(changes) order by change_seq),'[]'::jsonb) into result from (
   select kind,entity_id,payload,revision,deleted_at,change_seq from public.continuity_records
   where user_id=owner_id and change_seq>after_sequence order by change_seq limit 500
 ) changes;
 return result;
end $$;
revoke all on function public.pull_continuity_changes(bigint) from public,anon;
grant execute on function public.pull_continuity_changes(bigint) to authenticated;
create or replace function public.continuity_contract_version() returns integer
language sql immutable security invoker set search_path='' as $$ select 2 $$;
commit;
