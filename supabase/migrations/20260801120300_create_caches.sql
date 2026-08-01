-- quote_cache / news_cache: server-side cache in front of Twelve Data and
-- Finnhub. Twelve Data's free tier allows 8 requests/minute, so every avoided
-- round trip is the difference between a dashboard that renders and one that
-- rate-limits.

create table public.quote_cache (
  ticker     text primary key,
  quote_json jsonb not null,
  fetched_at timestamptz not null default now(),
  constraint quote_cache_ticker_upper check (ticker = upper(ticker))
);

create table public.news_cache (
  ticker       text primary key,
  article_json jsonb not null,
  fetched_at   timestamptz not null default now(),
  constraint news_cache_ticker_upper check (ticker = upper(ticker))
);

-- Staleness is the only thing ever queried besides the primary key: the read
-- path asks "is this row older than the TTL", and the eventual sweep asks the
-- same question across the table.
create index quote_cache_fetched_at_idx on public.quote_cache (fetched_at);
create index news_cache_fetched_at_idx  on public.news_cache (fetched_at);

comment on table public.quote_cache is
  'Server-only cache of Twelve Data quotes. RLS enabled with no policies — unreachable from the browser by design.';
comment on table public.news_cache is
  'Server-only cache of Finnhub articles. RLS enabled with no policies — unreachable from the browser by design.';

-- RLS ON, and deliberately ZERO policies.
--
-- This is not an oversight. RLS denies by default, so a table with no policies
-- is readable by nobody holding the publishable key — neither anonymous nor
-- authenticated users. Only the secret key, which bypasses RLS, can touch
-- these tables, and that key only ever exists in server route handlers.
--
-- That is exactly the intent: these tables are an implementation detail of the
-- server-side fetch layer. Letting the browser read them would leak our
-- provider response shapes and let a client enumerate every ticker the whole
-- user base follows, which is a cross-user information leak dressed up as a
-- cache. Clients get data through /api routes or not at all.
--
-- If a future migration adds a policy here, that is a security decision and
-- needs justifying, not a convenience fix for "the query returns nothing".
alter table public.quote_cache enable row level security;
alter table public.news_cache  enable row level security;
