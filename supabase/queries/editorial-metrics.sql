-- Snapshot agregado para revisão editorial.
-- Uso com psql:
--   psql "$SUPABASE_DB_URL" \
--     -v period_start=2026-08-01 \
--     -v period_end=2026-09-01 \
--     -v active_cutoff=2026-08-31 \
--     -f supabase/queries/editorial-metrics.sql
--
-- period_end é exclusivo. active_cutoff é inclusivo e usa os sete dias
-- terminados nessa data. A consulta retorna apenas agregados, sem IDs.

with bounds as (
  select
    :'period_start'::date as period_start,
    :'period_end'::date as period_end,
    :'active_cutoff'::date as active_cutoff
),
accounts as (
  select count(*)::bigint as accounts_created
  from auth.users, bounds
  where created_at >= period_start::timestamptz
    and created_at < period_end::timestamptz
    and deleted_at is null
    and coalesce(is_anonymous, false) = false
),
activations as (
  select count(*)::bigint as activated
  from public.product_funnel_state, bounds
  where profile_configured_at is not null
    and first_point_event_at is not null
    and first_period_at is not null
    and greatest(
      profile_configured_at,
      first_point_event_at,
      first_period_at
    ) >= period_start::timestamptz
    and greatest(
      profile_configured_at,
      first_point_event_at,
      first_period_at
    ) < period_end::timestamptz
),
weekly_activity as (
  select count(distinct user_id)::bigint as weekly_active_planners
  from public.product_activity_days, bounds
  where activity_date between active_cutoff - 6 and active_cutoff
)
select
  bounds.period_start,
  bounds.period_end,
  bounds.active_cutoff,
  accounts.accounts_created,
  activations.activated,
  weekly_activity.weekly_active_planners
from bounds
cross join accounts
cross join activations
cross join weekly_activity;

-- Feedback permanece indisponível até que a superfície de feedback seja
-- implementada e as tabelas product_feedback_submissions e
-- product_feedback_votes estejam presentes. Não substituir a lacuna por zero.
