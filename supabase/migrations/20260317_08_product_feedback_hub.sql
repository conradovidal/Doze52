begin;

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.normalize_product_feedback_text(input text)
returns text
language sql
stable
as $$
  select trim(
    regexp_replace(
      lower(unaccent(coalesce(input, ''))),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

create table if not exists public.product_feedback_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null,
  public_note text,
  area text not null check (area in ('Calendario', 'Perfis', 'Interface', 'Sincronizacao', 'Geral')),
  status text not null check (status in ('backlog', 'in_progress', 'launched', 'archived')),
  backlog_rank int4,
  started_at date,
  launched_at date,
  timeline_label text,
  highlights text[] not null default '{}'::text[],
  merged_into_item_id uuid references public.product_feedback_items(id) on delete set null,
  search_document text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  raw_text text not null,
  normalized_raw_text text not null default '',
  proposed_area text check (proposed_area is null or proposed_area in ('Calendario', 'Perfis', 'Interface', 'Sincronizacao', 'Geral')),
  matched_item_id uuid references public.product_feedback_items(id) on delete set null,
  status text not null default 'pending_review' check (status in ('pending_review', 'merged_existing', 'promoted_new', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  moderation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_feedback_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid not null references public.product_feedback_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text,
  constraint product_feedback_votes_end_after_start check (
    ended_at is null or ended_at >= created_at
  )
);

create table if not exists public.product_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.product_feedback_user_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_muted boolean not null default false,
  moderation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.product_feedback_items_set_search_document()
returns trigger
language plpgsql
as $$
begin
  new.search_document :=
    public.normalize_product_feedback_text(
      coalesce(new.title, '') || ' ' ||
      coalesce(new.summary, '') || ' ' ||
      coalesce(new.public_note, '')
    );
  return new;
end;
$$;

create or replace function public.product_feedback_submissions_set_normalized_text()
returns trigger
language plpgsql
as $$
begin
  new.normalized_raw_text := public.normalize_product_feedback_text(new.raw_text);
  return new;
end;
$$;

create or replace function public.product_feedback_items_end_votes_on_status_change()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('launched', 'archived')
     and old.status is distinct from new.status then
    update public.product_feedback_votes
    set ended_at = now(),
        end_reason = 'item_status_closed'
    where item_id = new.id
      and ended_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists product_feedback_items_set_updated_at on public.product_feedback_items;
create trigger product_feedback_items_set_updated_at
before update on public.product_feedback_items
for each row execute function public.set_updated_at();

drop trigger if exists product_feedback_items_set_search_document on public.product_feedback_items;
create trigger product_feedback_items_set_search_document
before insert or update of title, summary, public_note
on public.product_feedback_items
for each row execute function public.product_feedback_items_set_search_document();

drop trigger if exists product_feedback_items_end_votes_on_status_change on public.product_feedback_items;
create trigger product_feedback_items_end_votes_on_status_change
after update of status on public.product_feedback_items
for each row execute function public.product_feedback_items_end_votes_on_status_change();

drop trigger if exists product_feedback_submissions_set_updated_at on public.product_feedback_submissions;
create trigger product_feedback_submissions_set_updated_at
before update on public.product_feedback_submissions
for each row execute function public.set_updated_at();

drop trigger if exists product_feedback_submissions_set_normalized_text on public.product_feedback_submissions;
create trigger product_feedback_submissions_set_normalized_text
before insert or update of raw_text
on public.product_feedback_submissions
for each row execute function public.product_feedback_submissions_set_normalized_text();

drop trigger if exists product_feedback_user_states_set_updated_at on public.product_feedback_user_states;
create trigger product_feedback_user_states_set_updated_at
before update on public.product_feedback_user_states
for each row execute function public.set_updated_at();

create index if not exists idx_product_feedback_items_status_rank
  on public.product_feedback_items(status, backlog_rank, created_at);

create index if not exists idx_product_feedback_items_launched_at
  on public.product_feedback_items(launched_at desc);

create index if not exists idx_product_feedback_items_started_at
  on public.product_feedback_items(started_at desc);

create index if not exists idx_product_feedback_items_search_document
  on public.product_feedback_items
  using gin (search_document gin_trgm_ops);

create index if not exists idx_product_feedback_submissions_user_created_at
  on public.product_feedback_submissions(user_id, created_at desc);

create index if not exists idx_product_feedback_submissions_matched_status
  on public.product_feedback_submissions(matched_item_id, status);

create index if not exists idx_product_feedback_submissions_normalized_text
  on public.product_feedback_submissions
  using gin (normalized_raw_text gin_trgm_ops);

create index if not exists idx_product_feedback_votes_item_id_active
  on public.product_feedback_votes(item_id)
  where ended_at is null;

create index if not exists idx_product_feedback_votes_user_id_active
  on public.product_feedback_votes(user_id, created_at asc)
  where ended_at is null;

create unique index if not exists idx_product_feedback_votes_user_item_active_unique
  on public.product_feedback_votes(user_id, item_id)
  where ended_at is null;

create or replace view public.product_feedback_public_stats as
with active_votes as (
  select
    item_id,
    count(*)::int4 as vote_count
  from public.product_feedback_votes
  where ended_at is null
  group by item_id
),
reinforcements as (
  select
    matched_item_id as item_id,
    count(*)::int4 as reinforcement_count
  from public.product_feedback_submissions
  where status = 'merged_existing'
    and matched_item_id is not null
  group by matched_item_id
)
select
  item.id as item_id,
  coalesce(active_votes.vote_count, 0)::int4 as vote_count,
  coalesce(reinforcements.reinforcement_count, 0)::int4 as reinforcement_count
from public.product_feedback_items item
left join active_votes on active_votes.item_id = item.id
left join reinforcements on reinforcements.item_id = item.id
where item.merged_into_item_id is null
  and item.status in ('backlog', 'in_progress', 'launched');

create or replace function public.match_product_feedback_items(
  query_text text,
  max_results int default 5
)
returns table (
  id uuid,
  slug text,
  title text,
  summary text,
  area text,
  status text,
  vote_count int4,
  reinforcement_count int4,
  similarity real
)
language sql
security definer
set search_path = public
as $$
  with normalized as (
    select
      public.normalize_product_feedback_text(query_text) as query,
      greatest(1, least(coalesce(max_results, 5), 8)) as limit_count
  )
  select
    item.id,
    item.slug,
    item.title,
    item.summary,
    item.area,
    item.status,
    coalesce(stats.vote_count, 0)::int4 as vote_count,
    coalesce(stats.reinforcement_count, 0)::int4 as reinforcement_count,
    greatest(
      similarity(item.search_document, normalized.query),
      similarity(item.slug, replace(normalized.query, ' ', '-'))
    )::real as similarity
  from public.product_feedback_items item
  join normalized on true
  left join public.product_feedback_public_stats stats on stats.item_id = item.id
  where normalized.query <> ''
    and item.merged_into_item_id is null
    and item.status in ('backlog', 'in_progress', 'launched')
    and (
      item.search_document % normalized.query
      or item.search_document like '%' || normalized.query || '%'
    )
  order by similarity desc, coalesce(stats.vote_count, 0) desc, item.created_at asc
  limit (select limit_count from normalized);
$$;

insert into public.product_feedback_items (
  slug,
  title,
  summary,
  public_note,
  area,
  status,
  launched_at,
  timeline_label,
  highlights,
  created_at,
  updated_at
)
values
  (
    'primeira-versao-publica-do-doze52',
    'Primeira versao publica do doze52',
    'A base do calendario anual entrou no ar com foco total na visualizacao do ano.',
    'O produto ganhou a estrutura inicial para planejamento visual de longo prazo.',
    'Calendario',
    'launched',
    '2026-02-11',
    '11 de fevereiro de 2026',
    array[
      'A base do calendario anual entrou no ar com foco total na visualizacao do ano.',
      'O produto ganhou a estrutura inicial para planejamento visual de longo prazo.'
    ],
    '2026-02-11T09:00:00.000Z',
    '2026-02-11T09:00:00.000Z'
  ),
  (
    'login-com-google-ficou-mais-simples-e-confiavel',
    'Login com Google ficou mais simples e confiavel',
    'A autenticacao por popup foi estabilizada para reduzir interrupcoes no acesso.',
    'O retorno ao produto depois do login ficou mais previsivel e seguro.',
    'Sincronizacao',
    'launched',
    '2026-02-13',
    '12 a 13 de fevereiro de 2026',
    array[
      'A autenticacao por popup foi estabilizada para reduzir interrupcoes no acesso.',
      'O retorno ao produto depois do login ficou mais previsivel e seguro.'
    ],
    '2026-02-13T09:00:00.000Z',
    '2026-02-13T09:00:00.000Z'
  ),
  (
    'sincronizacao-e-drag-and-drop-ganharam-consistencia',
    'Sincronizacao e drag-and-drop ganharam consistencia',
    'A base de sincronizacao com Supabase foi consolidada.',
    'Mover eventos no calendario ficou muito mais estavel e natural. O feedback visual das celulas e do arraste foi refinado.',
    'Sincronizacao',
    'launched',
    '2026-02-20',
    '18 a 20 de fevereiro de 2026',
    array[
      'A base de sincronizacao com Supabase foi consolidada.',
      'Mover eventos no calendario ficou muito mais estavel e natural.',
      'O feedback visual das celulas e do arraste foi refinado.'
    ],
    '2026-02-20T09:00:00.000Z',
    '2026-02-20T09:00:00.000Z'
  ),
  (
    'calendario-mais-legivel-e-header-mais-claro',
    'Calendario mais legivel e header mais claro',
    'Eventos passaram a respeitar melhor ordenacao e empilhamento visual.',
    'O indicador de hoje ficou automatico, sem precisar recarregar a pagina. Header, logo, tema e mobile receberam uma rodada forte de polimento.',
    'Calendario',
    'launched',
    '2026-02-28',
    '23 a 28 de fevereiro de 2026',
    array[
      'Eventos passaram a respeitar melhor ordenacao e empilhamento visual.',
      'O indicador de hoje ficou automatico, sem precisar recarregar a pagina.',
      'Header, logo, tema e mobile receberam uma rodada forte de polimento.'
    ],
    '2026-02-28T09:00:00.000Z',
    '2026-02-28T09:00:00.000Z'
  ),
  (
    'perfis-de-calendario-foram-lancados',
    'Perfis de calendario foram lancados',
    'Categorias passaram a ser isoladas por perfil, como profissional, pessoal e familia.',
    'Perfis ganharam icones e um fluxo mais direto para foco por contexto.',
    'Perfis',
    'launched',
    '2026-03-08',
    '7 a 8 de marco de 2026',
    array[
      'Categorias passaram a ser isoladas por perfil, como profissional, pessoal e familia.',
      'Perfis ganharam icones e um fluxo mais direto para foco por contexto.'
    ],
    '2026-03-08T09:00:00.000Z',
    '2026-03-08T09:00:00.000Z'
  ),
  (
    'edicao-e-navegacao-ficaram-mais-fluidas',
    'Edicao e navegacao ficaram mais fluidas',
    'Header evoluiu para uma composicao mais premium, simetrica e clara.',
    'Perfis e categorias ganharam modo de edicao mais consistente. Reordenacao, footer e pop-ups foram compactados e refinados.',
    'Interface',
    'launched',
    '2026-03-10',
    '9 a 10 de marco de 2026',
    array[
      'Header evoluiu para uma composicao mais premium, simetrica e clara.',
      'Perfis e categorias ganharam modo de edicao mais consistente.',
      'Reordenacao, footer e pop-ups foram compactados e refinados.'
    ],
    '2026-03-10T09:00:00.000Z',
    '2026-03-10T09:00:00.000Z'
  ),
  (
    'modal-de-evento-e-fluxos-de-configuracao-ficaram-mais-amigaveis',
    'Modal de evento e fluxos de configuracao ficaram mais amigaveis',
    'O modal de evento ficou mais compacto e facil de preencher.',
    'Pop-ups passaram a respeitar melhor a area do calendario. Criacao e edicao de perfis e categorias receberam refinamentos visuais importantes.',
    'Interface',
    'launched',
    '2026-03-12',
    '11 a 12 de marco de 2026',
    array[
      'O modal de evento ficou mais compacto e facil de preencher.',
      'Pop-ups passaram a respeitar melhor a area do calendario.',
      'Criacao e edicao de perfis e categorias receberam refinamentos visuais importantes.'
    ],
    '2026-03-12T09:00:00.000Z',
    '2026-03-12T09:00:00.000Z'
  )
on conflict (slug) do update
set
  title = excluded.title,
  summary = excluded.summary,
  public_note = excluded.public_note,
  area = excluded.area,
  status = excluded.status,
  launched_at = excluded.launched_at,
  timeline_label = excluded.timeline_label,
  highlights = excluded.highlights,
  updated_at = excluded.updated_at;

alter table public.product_feedback_items enable row level security;
alter table public.product_feedback_submissions enable row level security;
alter table public.product_feedback_votes enable row level security;
alter table public.product_admins enable row level security;
alter table public.product_feedback_user_states enable row level security;

alter table public.product_feedback_items force row level security;
alter table public.product_feedback_submissions force row level security;
alter table public.product_feedback_votes force row level security;
alter table public.product_admins force row level security;
alter table public.product_feedback_user_states force row level security;

drop policy if exists product_feedback_items_public_read on public.product_feedback_items;
create policy product_feedback_items_public_read on public.product_feedback_items
for select using (
  merged_into_item_id is null
  and status in ('backlog', 'in_progress', 'launched')
);

drop policy if exists product_feedback_items_admin_manage on public.product_feedback_items;
create policy product_feedback_items_admin_manage on public.product_feedback_items
for all using (
  exists (
    select 1
    from public.product_admins admin
    where admin.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.product_admins admin
    where admin.user_id = auth.uid()
  )
);

drop policy if exists product_feedback_submissions_select_own on public.product_feedback_submissions;
create policy product_feedback_submissions_select_own on public.product_feedback_submissions
for select using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.product_admins admin
    where admin.user_id = auth.uid()
  )
);

drop policy if exists product_feedback_submissions_insert_own on public.product_feedback_submissions;
create policy product_feedback_submissions_insert_own on public.product_feedback_submissions
for insert with check (
  auth.uid() = user_id
  and reviewed_by is null
  and status in ('pending_review', 'merged_existing')
);

drop policy if exists product_feedback_submissions_admin_update on public.product_feedback_submissions;
create policy product_feedback_submissions_admin_update on public.product_feedback_submissions
for update using (
  exists (
    select 1
    from public.product_admins admin
    where admin.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.product_admins admin
    where admin.user_id = auth.uid()
  )
);

drop policy if exists product_feedback_votes_select_own on public.product_feedback_votes;
create policy product_feedback_votes_select_own on public.product_feedback_votes
for select using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.product_admins admin
    where admin.user_id = auth.uid()
  )
);

drop policy if exists product_feedback_votes_insert_own on public.product_feedback_votes;
create policy product_feedback_votes_insert_own on public.product_feedback_votes
for insert with check (auth.uid() = user_id);

drop policy if exists product_feedback_votes_update_own on public.product_feedback_votes;
create policy product_feedback_votes_update_own on public.product_feedback_votes
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists product_admins_select_own on public.product_admins;
create policy product_admins_select_own on public.product_admins
for select using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.product_admins admin
    where admin.user_id = auth.uid()
  )
);

drop policy if exists product_admins_admin_manage on public.product_admins;
create policy product_admins_admin_manage on public.product_admins
for all using (
  exists (
    select 1
    from public.product_admins admin
    where admin.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.product_admins admin
    where admin.user_id = auth.uid()
  )
);

drop policy if exists product_feedback_user_states_admin_manage on public.product_feedback_user_states;
create policy product_feedback_user_states_admin_manage on public.product_feedback_user_states
for all using (
  exists (
    select 1
    from public.product_admins admin
    where admin.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.product_admins admin
    where admin.user_id = auth.uid()
  )
);

grant usage on schema public to anon, authenticated;

revoke all on table public.product_feedback_items from anon;
revoke all on table public.product_feedback_items from authenticated;
revoke all on table public.product_feedback_submissions from anon;
revoke all on table public.product_feedback_votes from anon;
revoke all on table public.product_admins from anon;
revoke all on table public.product_feedback_user_states from anon;

grant select on table public.product_feedback_items to anon, authenticated;
grant select on table public.product_feedback_public_stats to anon, authenticated;
grant execute on function public.match_product_feedback_items(text, int) to authenticated;
grant select, insert on table public.product_feedback_submissions to authenticated;
grant update on table public.product_feedback_submissions to authenticated;
grant select, insert, update on table public.product_feedback_votes to authenticated;
grant select on table public.product_admins to authenticated;
grant select, insert, update, delete on table public.product_feedback_items to authenticated;
grant select, insert, update, delete on table public.product_feedback_user_states to authenticated;
grant select, insert, update, delete on table public.product_admins to authenticated;

commit;
