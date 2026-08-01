# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

A financial watchlist dashboard, built as a job-application demo. Users sign up, search for companies/stocks, add them to a personal watchlist, and see a dashboard with live-ish price data, charts, and news per company. Requirement from the employer: "a beautiful website with user auth and a user database — the more you add, the better." Reviewers will likely read the code, not just click through it, so correctness and clarity matter as much as the UI.

See `ROADMAP.md` for phased build order and optional add-ons.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Charts**: `lightweight-charts` (TradingView's OSS library) — not Recharts
- **Auth & DB**: Supabase (Postgres + Auth). Email/password *and* Google OAuth both required.
- **Financial data**: two providers behind one interface, both on free tiers, because neither covers the full surface alone:
  - **Twelve Data** — real-time quotes, historical OHLC (chart data), symbol search. 800 credits/day, 8/min.
  - **Finnhub** — company news, fundamentals (market cap, P/E, 52w range). 60/min, US-only. Its historical-candle endpoint is premium-gated (403 on free keys), which is why Twelve Data still owns the chart.
- **Email**: Resend, triggered from Supabase edge functions / scheduled functions
- **Hosting**: Vercel (app), Cloudflare (DNS for the custom domain)

Do not substitute libraries in this list without asking first — the stack itself is part of what's being evaluated.

## Architecture Rules

1. **Never call a market-data provider from the client.** All external API calls go through Next.js server routes (`app/api/...` or route handlers) so the API keys never reach the browser and responses can be cached/rate-limited server-side.
2. **Providers sit behind one typed interface.** `lib/market-data/` exposes `getQuote`, `getTimeSeries`, `searchSymbols`, `getFundamentals`, `getNews` — callers never know or care which vendor answers. Vendor-specific code stays in `lib/market-data/providers/`, and the cache layer wraps the interface, not the individual vendors.
3. **Cache external data.** Quotes and news get written to `quote_cache` / `news_cache` tables (or in-memory with a short TTL for local dev) before being re-fetched. Both free tiers have strict rate limits — treat every request as expensive. Twelve Data's 8/min is the binding constraint: batch dashboard quotes into a single comma-separated `/quote` call rather than one request per card.
4. **RLS on everything user-owned.** Every table holding per-user data (`watchlist_items`, `price_alerts`) must have RLS enabled with a policy of `user_id = auth.uid()` on select/insert/update/delete. No table should rely on application-layer checks alone.
5. **`profiles` row is created via a Postgres trigger** on `auth.users` insert — never create it manually from the client.
6. **Every async UI surface needs three states**: loading (skeleton), empty (helpful copy + CTA), and error (retry affordance). Don't ship a screen with only the happy path.
7. **Auth-gate at the middleware level**, not just per-component checks — unauthenticated users should never reach a dashboard route.
8. **A provider failure must never break a page.** The market-data layer returns a discriminated result (`{ ok: true, data }` / `{ ok: false, reason }`) instead of throwing. `reason` is one of:
   - `rate_limited` — 429 or credit exhaustion. Copy: "We're fetching data faster than our market feed allows. Prices will refresh in a moment."
   - `unavailable` — 5xx, timeout, network failure. Copy: "Our market data provider isn't responding right now." + retry.
   - `not_entitled` — 403 / paywalled endpoint. Copy: "This data isn't included on the demo's free data plan."
   - `not_found` — unknown ticker. Copy: "We couldn't find a listing for that symbol."

   Rules that follow from this:
   - **Serve stale before erroring.** If `quote_cache` / `news_cache` holds an expired row and the refetch fails, render the stale value with a visible "as of {time}" badge. A slightly old price beats an error card.
   - **Transient → toast, persistent → inline.** A failed background refresh raises a dismissible toast and leaves existing data on screen. A failure with nothing to fall back on renders the inline error state with a retry button (rule 6).
   - **One toast per failure class per interval.** Twelve Data's 8/min ceiling means a burst of failures is one underlying cause; deduplicate by `reason` so a rate-limit event never stacks twelve toasts.
   - **Never leak vendor internals.** Raw provider messages, status bodies, URLs, and keys get logged server-side only. The browser sees the mapped copy above and nothing else.

## Design Direction

**Market-native dark.** The palette a trading tool actually uses: dark ground, restrained accent, monospace numerals so digits align in columns. Dark is the lead theme; light is the secondary. Avoid the generic-crypto failure mode — that comes from gradients, glows, and neon, not from dark itself.

**Hero: a self-drawing gold candlestick chart.** XAU/USD daily candles animate in on load, headline overlaid. Decisions that follow:

- **The hero data is a committed fixture, not an API call.** `lib/fixtures/xau-daily.json`, fetched once from Twelve Data (forex is on the free tier) and checked in. The landing page is the highest-traffic route and the least justifiable place to spend an 800-credit daily budget. It also means the hero renders identically whether or not the providers are up — the first thing a reviewer sees can never be an error state.
- **Animate by progressive `series.update()`**, not CSS. `lightweight-charts` has no built-in draw-in; feeding candles one frame at a time on a rAF loop is the idiomatic way and reads as the chart building itself.
- **`prefers-reduced-motion: reduce` renders the completed chart immediately.** Not a degraded version — the same final frame, no animation.
- **The headline is the LCP, not the chart.** Headline and CTA are server-rendered and legible before any chart JS executes; `lightweight-charts` is dynamically imported so it never blocks first paint. The chart is an enhancement that arrives, not a dependency the page waits on.
- **Legibility over the chart is a hard requirement**, not a nice-to-have. Text sits on a scrim; contrast is verified against the *lightest* frame of the animation, not a static screenshot.

**Colour rule — the one that matters:** gold/amber is the brand accent. Green and red are reserved *exclusively* for price direction and carry no branding duty. Never introduce an accent that competes with the semantic price colours. And because red/green alone fails for colourblind users, every delta pairs its colour with a shape and sign (`▲ +2.41%`), so the direction survives with colour stripped out.

Exact type scale, spacing rhythm, and colour tokens get defined when Phase 3 is built — not guessed at here.

## Data Model

```
profiles          (id -> auth.users.id, display_name, created_at)
watchlist_items   (id, user_id, ticker, company_name, added_at)
price_alerts      (id, user_id, ticker, condition, threshold, triggered_at, active)
quote_cache       (ticker, quote_json, fetched_at)
news_cache        (ticker, article_json, fetched_at)
```

## Conventions

- TypeScript strict mode on.
- Server components by default; client components (`"use client"`) only where interactivity requires it (charts, forms, search input).
- Environment variables: `TWELVE_DATA_API_KEY`, `FINNHUB_API_KEY`, `RESEND_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, never exposed to client).
- Commit RLS policies as SQL migrations, not as changes made only through the Supabase dashboard — the migration history is itself part of the demo's story.

## Definition of Done (MVP)

All Phase 1–6 items in `ROADMAP.md` checked off, README written, deployed live on the custom domain via Vercel + Cloudflare.
