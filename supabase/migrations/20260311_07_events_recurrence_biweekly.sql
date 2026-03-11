begin;

alter table public.events
  drop constraint if exists events_recurrence_type_check;

alter table public.events
  add constraint events_recurrence_type_check
  check (
    recurrence_type is null or recurrence_type in ('weekly', 'biweekly', 'monthly', 'yearly')
  );

commit;
