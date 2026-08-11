create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create table if not exists public.calendar_pack_sources (
  id text primary key,
  authority text not null,
  competition text not null,
  season integer not null,
  official_url text not null,
  fetch_url text,
  parser_key text not null,
  rollout_status text not null default 'shadow'
    check (rollout_status in ('pending', 'shadow', 'active', 'paused')),
  freshness_hours integer not null default 28 check (freshness_hours between 1 and 168),
  last_checked_at timestamptz,
  last_successful_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_pack_update_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_kind text not null
    check (trigger_kind in ('scheduled_midnight', 'scheduled_closing', 'manual')),
  requested_by uuid references auth.users(id) on delete set null,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'partial', 'failed', 'quarantined')),
  publish_enabled boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  error text
);

create table if not exists public.calendar_pack_releases (
  id uuid primary key default gen_random_uuid(),
  version bigint generated always as identity unique,
  material_hash text not null,
  catalog jsonb not null,
  source_run_id uuid references public.calendar_pack_update_runs(id) on delete set null,
  release_kind text not null default 'automatic'
    check (release_kind in ('bootstrap', 'automatic', 'rollback')),
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_pack_catalog_state (
  singleton boolean primary key default true check (singleton),
  current_release_id uuid references public.calendar_pack_releases(id),
  updated_at timestamptz not null default now()
);

insert into public.calendar_pack_catalog_state (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.calendar_pack_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.calendar_pack_update_runs(id) on delete cascade,
  source_id text not null references public.calendar_pack_sources(id),
  base_release_id uuid references public.calendar_pack_releases(id),
  material_hash text not null,
  payload jsonb not null,
  diff jsonb not null default '{}'::jsonb,
  validation_issues jsonb not null default '[]'::jsonb,
  status text not null
    check (status in ('unchanged', 'shadow', 'publishable', 'published', 'quarantined', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_pack_external_ids (
  authority text not null,
  competition text not null,
  season integer not null,
  external_id text not null,
  canonical_id uuid not null,
  participant_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (authority, competition, season, external_id),
  unique (canonical_id)
);

create table if not exists public.calendar_pack_rollbacks (
  id uuid primary key default gen_random_uuid(),
  from_release_id uuid not null references public.calendar_pack_releases(id),
  to_release_id uuid not null references public.calendar_pack_releases(id),
  rollback_release_id uuid not null references public.calendar_pack_releases(id),
  requested_by uuid references auth.users(id) on delete set null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists calendar_pack_runs_started_at_idx
  on public.calendar_pack_update_runs (started_at desc);
create index if not exists calendar_pack_candidates_run_idx
  on public.calendar_pack_candidates (run_id, created_at);
create index if not exists calendar_pack_releases_published_at_idx
  on public.calendar_pack_releases (published_at desc);
create index if not exists calendar_pack_releases_material_hash_idx
  on public.calendar_pack_releases (material_hash);

create or replace function public.prevent_calendar_pack_release_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'calendar pack releases are immutable';
end;
$$;

drop trigger if exists calendar_pack_releases_immutable on public.calendar_pack_releases;
create trigger calendar_pack_releases_immutable
before update or delete on public.calendar_pack_releases
for each row execute function public.prevent_calendar_pack_release_mutation();

create or replace function public.set_calendar_pack_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists calendar_pack_sources_updated_at on public.calendar_pack_sources;
create trigger calendar_pack_sources_updated_at
before update on public.calendar_pack_sources
for each row execute function public.set_calendar_pack_updated_at();

drop trigger if exists calendar_pack_external_ids_updated_at on public.calendar_pack_external_ids;
create trigger calendar_pack_external_ids_updated_at
before update on public.calendar_pack_external_ids
for each row execute function public.set_calendar_pack_updated_at();

create or replace function public.publish_calendar_pack_release(
  p_material_hash text,
  p_catalog jsonb,
  p_source_run_id uuid,
  p_release_kind text,
  p_published_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_release_id uuid;
begin
  insert into public.calendar_pack_releases
    (material_hash, catalog, source_run_id, release_kind, published_by)
  values
    (p_material_hash, p_catalog, p_source_run_id, p_release_kind, p_published_by)
  returning id into v_release_id;

  update public.calendar_pack_catalog_state
  set current_release_id = v_release_id, updated_at = now()
  where singleton = true;

  return v_release_id;
end;
$$;

create or replace function public.rollback_calendar_pack_release(
  p_to_release_id uuid,
  p_requested_by uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from_release_id uuid;
begin
  if length(trim(p_reason)) < 3 then
    raise exception 'rollback reason is required';
  end if;
  if not exists (select 1 from public.calendar_pack_releases where id = p_to_release_id) then
    raise exception 'target release does not exist';
  end if;

  select current_release_id into v_from_release_id
  from public.calendar_pack_catalog_state
  where singleton = true
  for update;

  update public.calendar_pack_catalog_state
  set current_release_id = p_to_release_id, updated_at = now()
  where singleton = true;

  insert into public.calendar_pack_rollbacks
    (from_release_id, to_release_id, rollback_release_id, requested_by, reason)
  values
    (v_from_release_id, p_to_release_id, p_to_release_id, p_requested_by, trim(p_reason));

  return p_to_release_id;
end;
$$;

revoke all on function public.publish_calendar_pack_release(text, jsonb, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.rollback_calendar_pack_release(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.publish_calendar_pack_release(text, jsonb, uuid, text, uuid) to service_role;
grant execute on function public.rollback_calendar_pack_release(uuid, uuid, text) to service_role;

insert into public.calendar_pack_sources
  (id, authority, competition, season, official_url, fetch_url, parser_key, rollout_status)
values
  ('cbf-brasileirao-2026', 'CBF', 'Campeonato Brasileiro Serie A', 2026,
   'https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-a/2026?documento=Tabela%20Detalhada', 'https://www.cbf.com.br/api/cbf/jogos/tabela-detalhada/campeonato/1260611', 'cbf', 'shadow'),
  ('cbf-copa-do-brasil-2026', 'CBF', 'Copa do Brasil', 2026,
   'https://www.cbf.com.br/futebol-brasileiro/tabelas/copa-do-brasil/masculino/2026?documento=Tabela%20Detalhada', 'https://www.cbf.com.br/api/cbf/jogos/tabela-detalhada/campeonato/1260615', 'cbf', 'pending'),
  ('conmebol-libertadores-2026', 'CONMEBOL', 'CONMEBOL Libertadores', 2026,
   'https://gol.conmebol.com/libertadores/es/tournament/103', null, 'conmebol', 'pending'),
  ('conmebol-sudamericana-2026', 'CONMEBOL', 'CONMEBOL Sudamericana', 2026,
   'https://gol.conmebol.com/sudamericana/es/tournament/104', null, 'conmebol', 'pending'),
  ('formula1-2026', 'Formula 1', 'Formula 1', 2026,
   'https://www.formula1.com/en/racing/2026', null, 'formula1', 'pending'),
  ('fifa-world-cup-2026', 'FIFA', 'FIFA World Cup', 2026,
   'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums', null, 'fifa', 'pending'),
  ('brazil-holidays-2026', 'Governo do Brasil', 'Feriados nacionais', 2026,
   'https://www.gov.br/gestao/pt-br/assuntos/noticias/2025/dezembro/governo-federal-divulga-calendario-de-feriados-e-pontos-facultativos-de-2026', null, 'government_holidays', 'pending')
on conflict (id) do update set
  official_url = excluded.official_url,
  fetch_url = excluded.fetch_url,
  parser_key = excluded.parser_key;

alter table public.calendar_pack_sources enable row level security;
alter table public.calendar_pack_update_runs enable row level security;
alter table public.calendar_pack_releases enable row level security;
alter table public.calendar_pack_catalog_state enable row level security;
alter table public.calendar_pack_candidates enable row level security;
alter table public.calendar_pack_external_ids enable row level security;
alter table public.calendar_pack_rollbacks enable row level security;

alter table public.calendar_pack_sources force row level security;
alter table public.calendar_pack_update_runs force row level security;
alter table public.calendar_pack_releases force row level security;
alter table public.calendar_pack_catalog_state force row level security;
alter table public.calendar_pack_candidates force row level security;
alter table public.calendar_pack_external_ids force row level security;
alter table public.calendar_pack_rollbacks force row level security;

revoke all on table public.calendar_pack_sources from anon, authenticated;
revoke all on table public.calendar_pack_update_runs from anon, authenticated;
revoke all on table public.calendar_pack_releases from anon, authenticated;
revoke all on table public.calendar_pack_catalog_state from anon, authenticated;
revoke all on table public.calendar_pack_candidates from anon, authenticated;
revoke all on table public.calendar_pack_external_ids from anon, authenticated;
revoke all on table public.calendar_pack_rollbacks from anon, authenticated;

grant all on table public.calendar_pack_sources to service_role;
grant all on table public.calendar_pack_update_runs to service_role;
grant all on table public.calendar_pack_releases to service_role;
grant all on table public.calendar_pack_catalog_state to service_role;
grant all on table public.calendar_pack_candidates to service_role;
grant all on table public.calendar_pack_external_ids to service_role;
grant all on table public.calendar_pack_rollbacks to service_role;
grant usage, select on all sequences in schema public to service_role;

comment on table public.calendar_pack_releases is
  'Immutable, versioned calendar catalogs. lastVerified is excluded from material_hash by application code.';
comment on column public.calendar_pack_sources.rollout_status is
  'pending: disabled; shadow: validate without publishing; active: publish valid changes; paused: operator stop.';

-- The jobs run hourly but only dispatch at the requested local hour. This keeps the
-- schedule correct if America/Sao_Paulo changes its UTC offset in the future.
-- Provision Vault secrets `calendar_pack_refresh_url` (full route URL) and
-- `calendar_pack_refresh_secret` before enabling the jobs in production.
select cron.unschedule(jobid)
from cron.job
where jobname in ('doze52-calendar-packs-midnight', 'doze52-calendar-packs-closing');

select cron.schedule(
  'doze52-calendar-packs-midnight',
  '0 * * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_pack_refresh_url' limit 1),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_pack_refresh_secret' limit 1),
        'x-calendar-refresh-slot', 'midnight'
      ),
      body := '{}'::jsonb
    )
    where extract(hour from timezone('America/Sao_Paulo', now())) = 0
  $cron$
);

select cron.schedule(
  'doze52-calendar-packs-closing',
  '0 * * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_pack_refresh_url' limit 1),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_pack_refresh_secret' limit 1),
        'x-calendar-refresh-slot', 'closing'
      ),
      body := '{}'::jsonb
    )
    where extract(hour from timezone('America/Sao_Paulo', now())) = 4
  $cron$
);
