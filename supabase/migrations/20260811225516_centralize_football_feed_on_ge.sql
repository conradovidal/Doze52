alter table public.calendar_pack_sources
  add column if not exists feed_provider text,
  add column if not exists feed_url text;

alter table public.calendar_pack_sources
  drop constraint if exists calendar_pack_sources_feed_pair_check;

alter table public.calendar_pack_sources
  add constraint calendar_pack_sources_feed_pair_check
  check ((feed_provider is null) = (feed_url is null));

alter table public.calendar_pack_external_ids
  drop constraint if exists calendar_pack_external_ids_canonical_id_key;

create index if not exists calendar_pack_external_ids_canonical_idx
  on public.calendar_pack_external_ids (canonical_id);

update public.calendar_pack_sources
set
  feed_provider = 'GE',
  feed_url = case id
    when 'cbf-brasileirao-2026' then 'https://ge.globo.com/futebol/brasileirao-serie-a/'
    when 'cbf-copa-do-brasil-2026' then 'https://ge.globo.com/futebol/copa-do-brasil/'
    when 'conmebol-libertadores-2026' then 'https://ge.globo.com/futebol/libertadores/'
    when 'conmebol-sudamericana-2026' then 'https://ge.globo.com/futebol/copa-sul-americana/'
    else feed_url
  end,
  rollout_status = 'shadow'
where id in (
  'cbf-brasileirao-2026',
  'cbf-copa-do-brasil-2026',
  'conmebol-libertadores-2026',
  'conmebol-sudamericana-2026'
);

comment on column public.calendar_pack_sources.feed_provider is
  'Agregador técnico usado para ingestão; não substitui a autoridade oficial.';

comment on column public.calendar_pack_sources.feed_url is
  'Página pública do agregador técnico usada para descobrir a tabela estruturada.';
