begin;

create table if not exists public.billing_checkout_guards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'failed'
    check (status in ('processing', 'succeeded', 'failed')),
  window_started_at timestamptz not null default clock_timestamp(),
  attempt_count integer not null default 0
    check (attempt_count between 0 and 5),
  attempt_key uuid,
  lease_token uuid,
  lease_expires_at timestamptz,
  checkout_session_id text,
  checkout_session_url text,
  checkout_session_expires_at timestamptz,
  reuse_until timestamptz,
  last_error_code text check (
    last_error_code is null or char_length(last_error_code) <= 64
  ),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

drop trigger if exists billing_checkout_guards_set_updated_at
  on public.billing_checkout_guards;
create trigger billing_checkout_guards_set_updated_at
before update on public.billing_checkout_guards
for each row execute function public.set_updated_at();

alter table public.billing_checkout_guards enable row level security;
alter table public.billing_checkout_guards force row level security;
revoke all on table public.billing_checkout_guards
  from public, anon, authenticated;
grant select, insert, update, delete on table public.billing_checkout_guards
  to service_role;

create or replace function public.claim_billing_checkout(p_user_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_guard public.billing_checkout_guards%rowtype;
  v_lease_token uuid;
  v_attempt_key uuid;
  v_retry_after integer;
begin
  if p_user_id is null then
    raise exception 'billing checkout user is required' using errcode = '22023';
  end if;

  insert into public.billing_checkout_guards (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into strict v_guard
  from public.billing_checkout_guards
  where user_id = p_user_id
  for update;

  if v_guard.status = 'succeeded'
    and v_guard.checkout_session_url is not null
    and v_guard.reuse_until > v_now then
    return jsonb_build_object(
      'outcome', 'reused',
      'url', v_guard.checkout_session_url
    );
  end if;

  if v_guard.status = 'processing'
    and v_guard.lease_expires_at > v_now then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (v_guard.lease_expires_at - v_now)))::integer
    );
    return jsonb_build_object(
      'outcome', 'processing',
      'retryAfterSeconds', v_retry_after
    );
  end if;

  if v_guard.status = 'processing'
    and v_guard.attempt_key is not null then
    v_lease_token := gen_random_uuid();
    update public.billing_checkout_guards
    set lease_token = v_lease_token,
        lease_expires_at = v_now + interval '60 seconds',
        last_error_code = null
    where user_id = p_user_id;
    return jsonb_build_object(
      'outcome', 'acquired',
      'attemptKey', v_guard.attempt_key,
      'leaseToken', v_lease_token,
      'resumed', true
    );
  end if;

  if v_guard.window_started_at <= v_now - interval '10 minutes' then
    v_guard.window_started_at := v_now;
    v_guard.attempt_count := 0;
  end if;

  if v_guard.attempt_count >= 5 then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (
        v_guard.window_started_at + interval '10 minutes' - v_now
      )))::integer
    );
    return jsonb_build_object(
      'outcome', 'rate_limited',
      'retryAfterSeconds', v_retry_after
    );
  end if;

  v_attempt_key := gen_random_uuid();
  v_lease_token := gen_random_uuid();
  update public.billing_checkout_guards
  set status = 'processing',
      window_started_at = v_guard.window_started_at,
      attempt_count = v_guard.attempt_count + 1,
      attempt_key = v_attempt_key,
      lease_token = v_lease_token,
      lease_expires_at = v_now + interval '60 seconds',
      checkout_session_id = null,
      checkout_session_url = null,
      checkout_session_expires_at = null,
      reuse_until = null,
      last_error_code = null
  where user_id = p_user_id;

  return jsonb_build_object(
    'outcome', 'acquired',
    'attemptKey', v_attempt_key,
    'leaseToken', v_lease_token,
    'resumed', false
  );
end;
$$;

create or replace function public.complete_billing_checkout(
  p_user_id uuid,
  p_lease_token uuid,
  p_session_id text,
  p_session_url text,
  p_session_expires_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_session_id is null or btrim(p_session_id) = ''
    or p_session_url is null or btrim(p_session_url) = ''
    or p_session_expires_at is null then
    raise exception 'billing checkout completion is invalid' using errcode = '22023';
  end if;

  update public.billing_checkout_guards
  set status = 'succeeded',
      lease_token = null,
      lease_expires_at = null,
      checkout_session_id = p_session_id,
      checkout_session_url = p_session_url,
      checkout_session_expires_at = p_session_expires_at,
      reuse_until = least(
        p_session_expires_at,
        clock_timestamp() + interval '2 minutes'
      ),
      last_error_code = null
  where user_id = p_user_id
    and status = 'processing'
    and lease_token = p_lease_token;

  if not found then
    raise exception 'billing checkout lease lost' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.release_billing_checkout(
  p_user_id uuid,
  p_lease_token uuid,
  p_error_code text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.billing_checkout_guards
  set lease_token = null,
      lease_expires_at = clock_timestamp(),
      last_error_code = left(coalesce(nullif(p_error_code, ''), 'unknown'), 64)
  where user_id = p_user_id
    and status = 'processing'
    and lease_token = p_lease_token;

  if not found then
    raise exception 'billing checkout lease lost' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.claim_billing_checkout(uuid)
  from public, anon, authenticated;
revoke all on function public.complete_billing_checkout(
  uuid, uuid, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.release_billing_checkout(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.claim_billing_checkout(uuid)
  to service_role;
grant execute on function public.complete_billing_checkout(
  uuid, uuid, text, text, timestamptz
) to service_role;
grant execute on function public.release_billing_checkout(uuid, uuid, text)
  to service_role;

commit;
