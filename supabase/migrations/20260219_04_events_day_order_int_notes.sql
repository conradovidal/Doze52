begin;

alter table public.categories
  add column if not exists visible boolean not null default true,
  add column if not exists position int4 not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.events
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  current_type text;
begin
  select data_type
  into current_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'events'
    and column_name = 'day_order';

  if current_type is null then
    alter table public.events
      add column day_order int4 not null default 0;
    return;
  end if;

  if current_type = 'integer' then
    execute 'update public.events set day_order = 0 where day_order is null';
    alter table public.events
      alter column day_order set default 0,
      alter column day_order set not null;
    return;
  end if;

  alter table public.events
    add column if not exists day_order_v2 int4;

  if current_type = 'jsonb' then
    update public.events
    set day_order_v2 = coalesce(
      case
        when jsonb_typeof(day_order) = 'number' then greatest(0, floor((day_order::text)::numeric)::int)
        else 0
      end,
      0
    );
  else
    update public.events
    set day_order_v2 = 0;
  end if;

  alter table public.events drop column day_order;
  alter table public.events rename column day_order_v2 to day_order;
  alter table public.events
    alter column day_order set default 0,
    alter column day_order set not null;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create index if not exists idx_categories_user_position
  on public.categories(user_id, position);
create index if not exists idx_events_user_start_date
  on public.events(user_id, start_date);
create index if not exists idx_events_user_category_id
  on public.events(user_id, category_id);

commit;
