begin;

-- The build only needs the integer contract version. No calendar data is exposed.
grant execute on function public.calendar_sync_contract_version() to anon;

commit;
