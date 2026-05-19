begin;

alter table public.events
  add column if not exists recurrence_type text,
  add column if not exists recurrence_until date;

alter table public.events
  drop constraint if exists events_recurrence_type_check;

alter table public.events
  add constraint events_recurrence_type_check
  check (
    recurrence_type is null or recurrence_type in ('weekly', 'biweekly', 'monthly', 'yearly')
  );

alter table public.events
  drop constraint if exists events_recurrence_until_after_start_check;

alter table public.events
  add constraint events_recurrence_until_after_start_check
  check (recurrence_until is null or recurrence_until >= start_date);

commit;
