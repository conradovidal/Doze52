begin;

create schema if not exists private;

create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'incomplete',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_subscriptions_status_check check (
    status in (
      'incomplete',
      'incomplete_expired',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'paused'
    )
  )
);

create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key,
  type text not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_billing_customers_stripe_customer_id
  on public.billing_customers(stripe_customer_id);

create index if not exists idx_billing_subscriptions_stripe_customer_id
  on public.billing_subscriptions(stripe_customer_id);

create index if not exists idx_billing_subscriptions_status
  on public.billing_subscriptions(status);

create index if not exists idx_stripe_webhook_events_processed_at
  on public.stripe_webhook_events(processed_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists billing_customers_set_updated_at on public.billing_customers;
create trigger billing_customers_set_updated_at
before update on public.billing_customers
for each row execute function public.set_updated_at();

drop trigger if exists billing_subscriptions_set_updated_at on public.billing_subscriptions;
create trigger billing_subscriptions_set_updated_at
before update on public.billing_subscriptions
for each row execute function public.set_updated_at();

create or replace function private.is_pro(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.billing_subscriptions subscription
    where subscription.user_id = p_user_id
      and subscription.status in ('active', 'trialing')
      and subscription.current_period_end > now()
      and auth.uid() = p_user_id
  );
$$;

create or replace function public.is_pro(p_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$
  select private.is_pro(p_user_id);
$$;

alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.billing_customers force row level security;
alter table public.billing_subscriptions force row level security;
alter table public.stripe_webhook_events force row level security;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

revoke all on table public.billing_customers from public, anon, authenticated;
revoke all on table public.billing_subscriptions from public, anon, authenticated;
revoke all on table public.stripe_webhook_events from public, anon, authenticated;

revoke all on function private.is_pro(uuid) from public, anon, authenticated;
grant execute on function private.is_pro(uuid) to authenticated;

revoke all on function public.is_pro(uuid) from public, anon, authenticated;
grant execute on function public.is_pro(uuid) to authenticated;

commit;
