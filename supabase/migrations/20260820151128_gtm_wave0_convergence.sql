begin;

-- Reassert the repository's owner-bound entitlement API. DEV had drifted to a
-- public SECURITY DEFINER function executable by anon.
create or replace function public.is_pro(p_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$
  select private.is_pro(p_user_id);
$$;

revoke all on function public.is_pro(uuid) from public, anon, authenticated;
grant execute on function public.is_pro(uuid) to authenticated, service_role;

-- Forward-only convergence for the private feedback inbox. These statements
-- preserve existing submissions while bringing older DEV installations up to
-- the canonical schema.
alter table public.product_feedback_submissions
  add column if not exists internal_note text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

create index if not exists product_feedback_submissions_reviewed_by_idx
  on public.product_feedback_submissions(reviewed_by)
  where reviewed_by is not null;

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

revoke all on function public.submit_product_feedback(
  uuid, text, text, jsonb, boolean, text
) from public, anon, authenticated;
grant execute on function public.submit_product_feedback(
  uuid, text, text, jsonb, boolean, text
) to service_role;

-- The application has no GraphQL callers and production no longer carries the
-- extension. Avoid CASCADE so an unexpected external dependency fails safely.
drop extension if exists pg_graphql;

commit;
