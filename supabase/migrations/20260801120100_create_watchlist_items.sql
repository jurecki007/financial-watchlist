-- watchlist_items: the tickers a user follows.

create table public.watchlist_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  ticker       text not null,
  company_name text,
  added_at     timestamptz not null default now(),

  -- Tickers are stored upper-case so the unique constraint below actually
  -- holds. Without this, 'aapl' and 'AAPL' are distinct rows and a user can
  -- add the same company twice — the constraint would silently not do its job.
  constraint watchlist_items_ticker_upper check (ticker = upper(ticker)),
  constraint watchlist_items_ticker_len   check (char_length(ticker) between 1 and 20),

  -- One row per company per user. Enforced in the database rather than by an
  -- app-level "check before insert", which races under concurrent requests.
  constraint watchlist_items_user_ticker_unique unique (user_id, ticker)
);

comment on table public.watchlist_items is
  'Tickers a user follows. RLS restricts every operation to user_id = auth.uid().';

-- Every dashboard query filters by user_id.
create index watchlist_items_user_id_added_at_idx
  on public.watchlist_items (user_id, added_at desc);

alter table public.watchlist_items enable row level security;

-- Four policies, one per operation, rather than one FOR ALL policy: FOR ALL
-- makes it easy to get USING right and forget WITH CHECK, which would let a
-- user write rows owned by someone else while only being able to read their
-- own. Splitting them makes each direction explicit.
--
-- USING filters which existing rows are visible; WITH CHECK validates rows
-- being written. INSERT needs only WITH CHECK; UPDATE needs both, or a user
-- could take one of their rows and reassign its user_id to another account.

create policy "watchlist_items_select_own"
  on public.watchlist_items for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "watchlist_items_insert_own"
  on public.watchlist_items for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "watchlist_items_update_own"
  on public.watchlist_items for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "watchlist_items_delete_own"
  on public.watchlist_items for delete
  to authenticated
  using ((select auth.uid()) = user_id);
