-- price_alerts: threshold alerts, evaluated by a scheduled edge function
-- which emails via Resend (roadmap add-on #1).

create type public.alert_condition as enum ('above', 'below');

create table public.price_alerts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  ticker       text not null,
  condition    public.alert_condition not null,

  -- numeric, not float. Money compared with = or >= under binary floating
  -- point fires alerts at the wrong threshold, and an alert that triggers a
  -- cent early is a bug users notice.
  threshold    numeric(20, 6) not null,

  triggered_at timestamptz,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),

  constraint price_alerts_ticker_upper    check (ticker = upper(ticker)),
  constraint price_alerts_ticker_len      check (char_length(ticker) between 1 and 20),
  constraint price_alerts_threshold_positive check (threshold > 0)
);

comment on table public.price_alerts is
  'Threshold price alerts. RLS restricts every operation to user_id = auth.uid().';

-- The scheduled evaluator scans only alerts still waiting to fire, which is a
-- small slice of the table once the app has run for a while. A partial index
-- keeps that scan proportional to the work rather than to the history.
create index price_alerts_active_idx
  on public.price_alerts (ticker)
  where active and triggered_at is null;

create index price_alerts_user_id_idx
  on public.price_alerts (user_id, created_at desc);

alter table public.price_alerts enable row level security;

create policy "price_alerts_select_own"
  on public.price_alerts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "price_alerts_insert_own"
  on public.price_alerts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "price_alerts_update_own"
  on public.price_alerts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "price_alerts_delete_own"
  on public.price_alerts for delete
  to authenticated
  using ((select auth.uid()) = user_id);
