begin;

alter table public.stripe_webhook_events
  add column if not exists processing_status text,
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_result text,
  add column if not exists last_error_code text,
  add column if not exists updated_at timestamptz not null default now();

update public.stripe_webhook_events
set
  processing_status = case
    when processed_at is not null then 'processed'
    else 'failed'
  end,
  attempt_count = greatest(attempt_count, 1),
  last_result = case
    when processed_at is not null then 'processed'
    else 'failed'
  end
where processing_status is null;

alter table public.stripe_webhook_events
  alter column processing_status set default 'processing',
  alter column processing_status set not null;

alter table public.stripe_webhook_events
  drop constraint if exists stripe_webhook_events_processing_status_check,
  add constraint stripe_webhook_events_processing_status_check
    check (processing_status in ('processing', 'processed', 'failed')),
  drop constraint if exists stripe_webhook_events_attempt_count_check,
  add constraint stripe_webhook_events_attempt_count_check
    check (attempt_count >= 0),
  drop constraint if exists stripe_webhook_events_last_result_check,
  add constraint stripe_webhook_events_last_result_check
    check (last_result is null or last_result in ('processing', 'processed', 'failed')),
  drop constraint if exists stripe_webhook_events_last_error_code_check,
  add constraint stripe_webhook_events_last_error_code_check
    check (
      last_error_code is null
      or (
        char_length(last_error_code) between 1 and 64
        and last_error_code ~ '^[a-z0-9_.-]+$'
      )
    );

create index if not exists idx_stripe_webhook_events_active_lease
  on public.stripe_webhook_events(processing_status, lease_expires_at)
  where processing_status = 'processing';

alter table public.billing_subscriptions
  add column if not exists last_stripe_event_created_at timestamptz,
  add column if not exists last_stripe_event_id text;

create or replace function private.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_lease_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.stripe_webhook_events%rowtype;
  v_lease_token uuid := gen_random_uuid();
begin
  if auth.role() <> 'service_role' and current_user <> 'postgres' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_event_id is null or btrim(p_event_id) = ''
    or p_event_type is null or btrim(p_event_type) = '' then
    raise exception 'event id and type are required' using errcode = '22023';
  end if;
  if p_lease_seconds < 10 or p_lease_seconds > 300 then
    raise exception 'invalid webhook lease duration' using errcode = '22023';
  end if;

  insert into public.stripe_webhook_events (
    stripe_event_id,
    type,
    processing_status,
    lease_token,
    lease_expires_at,
    attempt_count,
    last_result,
    updated_at
  ) values (
    p_event_id,
    p_event_type,
    'processing',
    v_lease_token,
    now() + make_interval(secs => p_lease_seconds),
    1,
    'processing',
    now()
  )
  on conflict (stripe_event_id) do nothing
  returning * into v_event;

  if found then
    return jsonb_build_object(
      'outcome', 'claimed',
      'leaseToken', v_lease_token,
      'attemptCount', 1
    );
  end if;

  select * into strict v_event
  from public.stripe_webhook_events
  where stripe_event_id = p_event_id
  for update;

  if v_event.processing_status = 'processed' then
    return jsonb_build_object(
      'outcome', 'duplicate',
      'leaseToken', null,
      'attemptCount', v_event.attempt_count
    );
  end if;

  if v_event.processing_status = 'processing'
    and v_event.lease_expires_at is not null
    and v_event.lease_expires_at > now() then
    return jsonb_build_object(
      'outcome', 'processing',
      'leaseToken', null,
      'attemptCount', v_event.attempt_count
    );
  end if;

  update public.stripe_webhook_events
  set
    type = p_event_type,
    processing_status = 'processing',
    lease_token = v_lease_token,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    attempt_count = attempt_count + 1,
    last_result = 'processing',
    last_error_code = null,
    updated_at = now()
  where stripe_event_id = p_event_id
  returning * into v_event;

  return jsonb_build_object(
    'outcome', 'claimed',
    'leaseToken', v_lease_token,
    'attemptCount', v_event.attempt_count
  );
end;
$$;

create or replace function private.complete_stripe_webhook_event(
  p_event_id text,
  p_lease_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if auth.role() <> 'service_role' and current_user <> 'postgres' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  update public.stripe_webhook_events
  set
    processing_status = 'processed',
    processed_at = now(),
    lease_token = null,
    lease_expires_at = null,
    last_result = 'processed',
    last_error_code = null,
    updated_at = now()
  where stripe_event_id = p_event_id
    and processing_status = 'processing'
    and lease_token = p_lease_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function private.fail_stripe_webhook_event(
  p_event_id text,
  p_lease_token uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
  v_error_code text := lower(coalesce(nullif(btrim(p_error_code), ''), 'processing_error'));
begin
  if auth.role() <> 'service_role' and current_user <> 'postgres' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if char_length(v_error_code) > 64
    or v_error_code !~ '^[a-z0-9_.-]+$' then
    v_error_code := 'processing_error';
  end if;

  update public.stripe_webhook_events
  set
    processing_status = 'failed',
    lease_token = null,
    lease_expires_at = null,
    last_result = 'failed',
    last_error_code = v_error_code,
    updated_at = now()
  where stripe_event_id = p_event_id
    and processing_status = 'processing'
    and lease_token = p_lease_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function private.apply_stripe_subscription_state(
  p_user_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_stripe_price_id text,
  p_status text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_event_created_at timestamptz,
  p_event_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_applied boolean;
begin
  if auth.role() <> 'service_role' and current_user <> 'postgres' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null
    or p_stripe_customer_id is null or btrim(p_stripe_customer_id) = ''
    or p_stripe_subscription_id is null or btrim(p_stripe_subscription_id) = ''
    or p_status is null or btrim(p_status) = ''
    or p_event_created_at is null
    or p_event_id is null or btrim(p_event_id) = '' then
    raise exception 'incomplete Stripe subscription state' using errcode = '22023';
  end if;

  insert into public.billing_subscriptions (
    user_id,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    status,
    current_period_end,
    cancel_at_period_end,
    last_stripe_event_created_at,
    last_stripe_event_id
  ) values (
    p_user_id,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_stripe_price_id,
    p_status,
    p_current_period_end,
    p_cancel_at_period_end,
    p_event_created_at,
    p_event_id
  )
  on conflict (user_id) do update set
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_price_id = excluded.stripe_price_id,
    status = excluded.status,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    last_stripe_event_created_at = excluded.last_stripe_event_created_at,
    last_stripe_event_id = excluded.last_stripe_event_id,
    updated_at = now()
  where billing_subscriptions.last_stripe_event_created_at is null
    or excluded.last_stripe_event_created_at
      > billing_subscriptions.last_stripe_event_created_at
    or (
      excluded.last_stripe_event_created_at
        = billing_subscriptions.last_stripe_event_created_at
      and excluded.last_stripe_event_id
        <> billing_subscriptions.last_stripe_event_id
    )
  returning true into v_applied;

  return coalesce(v_applied, false);
end;
$$;

revoke all on function private.claim_stripe_webhook_event(text, text, integer)
  from public, anon, authenticated;
revoke all on function private.complete_stripe_webhook_event(text, uuid)
  from public, anon, authenticated;
revoke all on function private.fail_stripe_webhook_event(text, uuid, text)
  from public, anon, authenticated;
revoke all on function private.apply_stripe_subscription_state(
  uuid, text, text, text, text, timestamptz, boolean, timestamptz, text
) from public, anon, authenticated;

grant usage on schema private to service_role;
grant execute on function private.claim_stripe_webhook_event(text, text, integer)
  to service_role;
grant execute on function private.complete_stripe_webhook_event(text, uuid)
  to service_role;
grant execute on function private.fail_stripe_webhook_event(text, uuid, text)
  to service_role;
grant execute on function private.apply_stripe_subscription_state(
  uuid, text, text, text, text, timestamptz, boolean, timestamptz, text
) to service_role;

create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_lease_seconds integer default 60
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.claim_stripe_webhook_event(
    p_event_id,
    p_event_type,
    p_lease_seconds
  );
$$;

create or replace function public.complete_stripe_webhook_event(
  p_event_id text,
  p_lease_token uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.complete_stripe_webhook_event(p_event_id, p_lease_token);
$$;

create or replace function public.fail_stripe_webhook_event(
  p_event_id text,
  p_lease_token uuid,
  p_error_code text
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.fail_stripe_webhook_event(
    p_event_id,
    p_lease_token,
    p_error_code
  );
$$;

create or replace function public.apply_stripe_subscription_state(
  p_user_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_stripe_price_id text,
  p_status text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_event_created_at timestamptz,
  p_event_id text
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.apply_stripe_subscription_state(
    p_user_id,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_stripe_price_id,
    p_status,
    p_current_period_end,
    p_cancel_at_period_end,
    p_event_created_at,
    p_event_id
  );
$$;

revoke all on function public.claim_stripe_webhook_event(text, text, integer)
  from public, anon, authenticated;
revoke all on function public.complete_stripe_webhook_event(text, uuid)
  from public, anon, authenticated;
revoke all on function public.fail_stripe_webhook_event(text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.apply_stripe_subscription_state(
  uuid, text, text, text, text, timestamptz, boolean, timestamptz, text
) from public, anon, authenticated;

grant execute on function public.claim_stripe_webhook_event(text, text, integer)
  to service_role;
grant execute on function public.complete_stripe_webhook_event(text, uuid)
  to service_role;
grant execute on function public.fail_stripe_webhook_event(text, uuid, text)
  to service_role;
grant execute on function public.apply_stripe_subscription_state(
  uuid, text, text, text, text, timestamptz, boolean, timestamptz, text
) to service_role;

grant select, insert, update, delete on table public.stripe_webhook_events
  to service_role;
grant select, insert, update, delete on table public.billing_subscriptions
  to service_role;

commit;
