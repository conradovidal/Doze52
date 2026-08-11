begin;

-- The repository carried a never-deployed public roadmap prototype. Remove its
-- objects on fresh/local databases so this private inbox is the only feedback
-- surface that survives the migration chain.
drop view if exists public.product_feedback_public_stats cascade;
drop function if exists public.match_product_feedback_items(text, int) cascade;
drop function if exists public.normalize_product_feedback_text(text) cascade;
drop table if exists public.product_feedback_votes cascade;
drop table if exists public.product_feedback_user_states cascade;
drop table if exists public.product_feedback_items cascade;
drop table if exists public.product_admins cascade;
drop table if exists public.product_feedback_submissions cascade;

create table public.product_feedback_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.product_feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('idea', 'problem', 'other')),
  message text not null check (
    message = btrim(message)
    and char_length(message) between 10 and 2000
  ),
  technical_context jsonb not null default '{}'::jsonb check (
    jsonb_typeof(technical_context) = 'object'
  ),
  contact_consent boolean not null default false,
  contact_email text,
  status text not null default 'new' check (
    status in ('new', 'reviewing', 'closed')
  ),
  internal_note text check (
    internal_note is null or char_length(internal_note) <= 4000
  ),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_feedback_contact_requires_consent check (
    contact_email is null or contact_consent
  ),
  constraint product_feedback_consent_requires_email check (
    not contact_consent or contact_email is not null
  )
);

create index product_feedback_submissions_created_at_idx
  on public.product_feedback_submissions(created_at desc);
create index product_feedback_submissions_user_created_at_idx
  on public.product_feedback_submissions(user_id, created_at desc);
create index product_feedback_submissions_status_created_at_idx
  on public.product_feedback_submissions(status, created_at desc);
create index product_feedback_submissions_kind_created_at_idx
  on public.product_feedback_submissions(kind, created_at desc);

create trigger product_feedback_submissions_set_updated_at
before update on public.product_feedback_submissions
for each row execute function public.set_updated_at();

alter table public.product_feedback_admins enable row level security;
alter table public.product_feedback_submissions enable row level security;
alter table public.product_feedback_admins force row level security;
alter table public.product_feedback_submissions force row level security;

revoke all on table public.product_feedback_admins
  from public, anon, authenticated;
revoke all on table public.product_feedback_submissions
  from public, anon, authenticated;
grant select, insert, update, delete on table public.product_feedback_admins
  to service_role;
grant select, insert, update, delete on table public.product_feedback_submissions
  to service_role;

create or replace function public.submit_product_feedback(
  p_user_id uuid,
  p_kind text,
  p_message text,
  p_technical_context jsonb,
  p_contact_consent boolean,
  p_contact_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  if (
    select count(*)
    from public.product_feedback_submissions
    where user_id = p_user_id
      and created_at >= now() - interval '24 hours'
  ) >= 5 then
    raise exception using
      errcode = 'P0001',
      message = 'feedback_rate_limit';
  end if;

  insert into public.product_feedback_submissions (
    user_id,
    kind,
    message,
    technical_context,
    contact_consent,
    contact_email
  ) values (
    p_user_id,
    p_kind,
    btrim(p_message),
    coalesce(p_technical_context, '{}'::jsonb),
    p_contact_consent,
    case when p_contact_consent then p_contact_email else null end
  )
  returning id into submission_id;

  return submission_id;
end;
$$;

revoke all on function public.submit_product_feedback(
  uuid, text, text, jsonb, boolean, text
) from public, anon, authenticated;
grant execute on function public.submit_product_feedback(
  uuid, text, text, jsonb, boolean, text
) to service_role;

commit;
