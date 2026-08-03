begin;

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

commit;
