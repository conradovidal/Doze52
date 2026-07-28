begin;

create table if not exists public.onboarding_region_totals (
  onboarding_version smallint not null,
  uf text not null,
  selections bigint not null default 0,
  first_selected_at timestamptz not null default now(),
  last_selected_at timestamptz not null default now(),
  primary key (onboarding_version, uf),
  constraint onboarding_region_totals_version_check
    check (onboarding_version > 0),
  constraint onboarding_region_totals_uf_check
    check (uf in (
      'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
      'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
      'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
    )),
  constraint onboarding_region_totals_selections_check
    check (selections >= 0)
);

alter table public.onboarding_region_totals enable row level security;
alter table public.onboarding_region_totals force row level security;

revoke all on table public.onboarding_region_totals
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.onboarding_region_totals to service_role;

create or replace function public.increment_onboarding_region_total(
  p_onboarding_version smallint,
  p_uf text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.onboarding_region_totals (
    onboarding_version,
    uf,
    selections
  )
  values (
    p_onboarding_version,
    upper(p_uf),
    1
  )
  on conflict (onboarding_version, uf)
  do update set
    selections = public.onboarding_region_totals.selections + 1,
    last_selected_at = now();
$$;

revoke all on function public.increment_onboarding_region_total(smallint, text)
  from public, anon, authenticated;
grant execute on function public.increment_onboarding_region_total(smallint, text)
  to service_role;

commit;
