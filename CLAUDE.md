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
3b. **Paginated provider data is cached by the page's own identity.** Historical
   candle pages end at a fixed past date and are therefore immutable — they are
   keyed by `ticker:before:size` and held in memory, not written to a table,
   because there is no staleness to reason about and nothing to persist. The
   *leading* page is never cached that way: it contains today's still-moving bar.
   Anything the browser can trigger repeatedly — scroll-driven paging especially —
   goes through an authenticated route with a bounded page size, since an open
   proxy to a metered API is somebody else's free tier.

4. **RLS on everything user-owned.** Every table holding per-user data (`watchlist_items`, `price_alerts`) must have RLS enabled with a policy of `user_id = auth.uid()` on select/insert/update/delete. No table should rely on application-layer checks alone.
5. **`profiles` row is created via a Postgres trigger** on `auth.users` insert — never create it manually from the client.
6. **Every async UI surface needs three states**: loading (skeleton), empty (helpful copy + CTA), and error (retry affordance). Don't ship a screen with only the happy path.
7. **Auth-gate at the middleware level**, not just per-component checks — unauthenticated users should never reach a dashboard route.
8. **A provider failure must never break a page.** The market-data layer returns a discriminated result (`{ ok: true, data }` / `{ ok: false, reason }`) instead of throwing. `reason` is one of:
   - `rate_limited` — 429 or credit exhaustion. Copy: "We're fetching data faster than our market feed allows. Prices will refresh in a moment."
   - `unavailable` — 5xx, timeout, network failure. Copy: "Our market data provider isn't responding right now." + retry.
   - `not_entitled` — **403 only** / paywalled endpoint. Copy: "This data isn't included on the demo's free data plan."
   - `misconfigured` — 401, or the API key is absent from the environment. Copy: "This deployment is missing its market-data credentials, so prices and charts can't load."
   - `not_found` — unknown ticker. Copy: "We couldn't find a listing for that symbol."

   **401 and 403 must never be collapsed.** They were once, and the result was a
   deployment with no `TWELVE_DATA_API_KEY` telling every visitor the chart sat
   behind a paid plan — a configuration fault presented as a product decision,
   which is the most expensive kind of wrong for a demo whose job is to be
   believed. 403 is the plan's limit and nobody can fix it; 401 is ours and
   someone can. Providers that answer with an error code inside a 200 body
   (Twelve Data does) get the same split applied to the body code.

   Missing keys are caught **before** the request goes out (`missingKey()` in
   `lib/market-data/http.ts`), so an unset variable costs no round-trip and puts
   its own name in the server log. The variable name never reaches the browser.

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

## Loading Behaviour

Perceived speed is a design surface, not a side effect. Rules, in priority order:

1. **Stream the shell; suspend per unit of data.** Nav and layout render immediately. Each watchlist card gets its own Suspense boundary so one slow ticker can't hold up eleven others, and each route segment gets a `loading.tsx`.
2. **A skeleton means "we have nothing," and we usually have something.** Cache-first means a returning user's prices are already in `quote_cache` — paint them instantly with a quiet refreshing state. Skeletons are for genuine cold loads only. This is the same mechanism as the stale-serve rule in architecture rule 8: `as of 14:32` → refresh → the number ticks over.
3. **Never let a skeleton flash.** Wait ~200ms before showing one (a cache hit beats it and the user sees no placeholder at all), then hold it ~400ms minimum. A placeholder that appears for 80ms reads as a glitch, not as speed.
4. **Skeletons are built from the real component's layout primitives**, never hand-sized. If the placeholder and the loaded card disagree on dimensions the page lurches, and hand-sized skeletons always drift as the component evolves.
5. **Placeholders take the shape of their data** — a price skeleton is digit-width in the monospace numeral face, not a full-width bar.
6. **Opacity pulse, never a shimmer sweep.** Shimmer is a consumer-app tic and fights the market-native restraint. Under `prefers-reduced-motion`, placeholders are entirely static.
7. **The hero chart's draw-in is its loading state.** No spinner precedes it, and its container is aspect-ratio-reserved so nothing shifts when the chart JS lands.
8. **Search never blanks its results.** Previous matches stay on screen while the next query resolves; the pending indicator lives inside the input.

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
- Environment variables: `TWELVE_DATA_API_KEY`, `FINNHUB_API_KEY`, `RESEND_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server-only, never exposed to client).
- **Supabase key naming follows the current API-key system, not the legacy JWT one.** `sb_publishable_…` replaces the old anon key; `sb_secret_…` replaces service_role. The earlier `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` names in this file predated knowing which format the project would issue — they were renamed once the real project turned out to use the new keys, so the variable name states what the value actually is. `check-env-exposure.sh` still guards the legacy names in case they reappear.
- Commit RLS policies as SQL migrations, not as changes made only through the Supabase dashboard — the migration history is itself part of the demo's story.
- **`auth.users` is seeded through the Admin API, never through a migration.** That table belongs to GoTrue; hand-writing a row means pinning its password-hash format and column set, and the next platform upgrade turns a passing migration into an unusable account without failing. `scripts/seed-demo-account.mjs` is the pattern — idempotent, so it doubles as the reset procedure. Our own tables are still migrations, and `profiles` is still the trigger's to create (rule 5): the seed *updates* that row, never inserts it.
- **A security header relaxed for one path is relaxed for that path only.** `/about/project` frames the rendered emails, which the blanket `X-Frame-Options: DENY` blocked — silently, with blank frames that typecheck, lint and build all passed. `SAMEORIGIN` plus `frame-ancestors 'self'` is scoped to `/mockups/`, and every other route keeps `DENY`, because the reason for `DENY` is that framing an authenticated watchlist is a clickjacking target and none of it applies to static documents with no session, forms or state. Set the modern and legacy controls together so they cannot disagree.
- **A schedule is a migration, not dashboard state.** The price-alert cron lived only in the README's description of it, and the result was alerts sitting pending for days while the feature looked shipped — the one that ever fired was fired by hand. Anything the product depends on happening on a timer is committed as `pg_cron` + `pg_net`, with its secrets read from Vault so the file stays publishable, and it fails loudly on a missing secret rather than posting to a null URL. A silent no-op is indistinguishable from "nothing happened", which is the failure that hid this for days.
- **Anything that can be evaluated by more than one caller claims its work with a compare-and-set.** The alert evaluator now runs hourly *and* on creation, so two runs can meet on one row; the `triggered_at is null` test belongs inside the UPDATE's WHERE clause, with `return=representation` deciding who won. A blind write plus a prior read is a duplicate email waiting for the two to overlap.
- **A best-effort side effect must not be able to fail the thing it follows.** The create-time alert check runs after the row is committed, is bounded by an explicit timeout so a slow provider cannot hold a server action open, and logs rather than throws — the hourly sweep is the guarantee, so the immediate check is free to fail.
- **Values interpolated into a PostgREST filter are validated against a charset, not escaped.** `ticker=eq.X&active=is.false` is not a quoting bug an encoder would catch; it is a different query. Match the shape you expect and discard anything else.
- **Email is built to email's constraints, not the web's.** Tables for layout, every meaningful style inline, a VML + anchor bulletproof button for each CTA, `color-scheme`/`supported-color-schemes` declared so clients stop inverting an already-dark design, and a hidden preheader so the client does not scrape the wordmark as preview text. Outlook renders with Word and Gmail drops `<style>`; neither is a corner case worth losing.
- **Every outbound email carries a `text/plain` part.** html-only is a spam signal and renders blank to plain-text readers. Anything colour conveys must survive there — the alert prints `^`/`v` beside the figure for exactly this reason.
- **Muted email text is `#7d8086`, not `--faint`.** `--faint` measures 3.90:1 on the ground and 3.67:1 on the raised panel. The app can spend it because faint strings are repeated louder nearby and the reader can change theme; an email has neither, so the tone is lifted to the nearest value clearing AA on both (5.03:1 / 4.74:1). A paste-this-link fallback uses full `--gold`, never `--gold-dim` — it is the path that must work once a filter strips the button.
- **Values interpolated into email HTML are escaped at the point of use.** A ticker's only guards are upper-case and a 20-character cap, and `<B>` passes both. Same reasoning as `serialiseJsonLd`: escape now, so the edit that introduces a hostile value is not also the edit that ships it.
- **Auth email templates deploy by paste, not by `supabase config push`.** `config.toml` binds them for the local stack so they can be tested in Inbucket; production keeps them in Authentication → Emails. A push would also carry `site_url = 127.0.0.1` and the missing `[auth.external.google]` block, which is the documented way to break Google sign-in. Theme only the templates a real flow can trigger — a branded email for an unreachable flow is a claim the product does not honour.
- **A demo account with published credentials uses a reserved domain, never a real one.** `example.com`, `example.org` and `.test` exist for this (RFC 2606) and resolve for nobody. The credentials are public by design, and `check-price-alerts` mails whatever address the account carries — so a real domain turns a published password into a way for any visitor to send a third party automated mail they never asked for, bouncing against our sending reputation on the way. The address is part of the blast radius, not a label.
- **Seeded price alerts must not be able to fire.** `check-price-alerts` emails the account's own address, which is unroutable by design, so a triggered seed would attempt a send that can only fail and register as a bounce. The reserved domain removes the recipient; this removes the attempt. Seed the pending state with an unreachable threshold and the fired state with `triggered_at` already set and `active = false` — the evaluator scans `where active and triggered_at is null`, so that row is outside its query by construction rather than by luck.
- **Every new page declares its own `alternates.canonical`, relative.** The root layout sets `metadataBase` from `SITE_URL` and nothing else does; a page without a canonical inherits none, because a canonical on the layout would make every route claim to be the homepage. Keep the canonical param-free — `?next=` variants of `/login` are one page, not many.
- **`SITE_URL` (`lib/site.ts`) is a hardcoded constant, not an env var.** Preview deploys must canonicalise to production, so resolving against `VERCEL_URL` would declare each throwaway preview the authoritative copy of every page. An unset variable would fail silently to localhost, which is worse than a value that is wrong loudly.
- **A page is in `sitemap.ts` only if it is indexable.** Listing a `noindex` URL asks Google to index what we simultaneously told it not to. Auth-gated routes redirect to `/login`, which carries the `noindex`, so they stay out of both the sitemap and `robots.txt` — blocking them in robots.txt would hide that directive rather than reinforce it.
- **Anything interpolated into a `<script type="application/ld+json">` goes through `serialiseJsonLd`**, which escapes `<` so a value can never close the block early. Values are static constants today; the guard is for the edit that isn't.
- **`color-scheme` must track the theme.** It governs the parts of a native control CSS cannot reach — `<select>` popups, autofill, spinners, scrollbars. Without it a dark form opens a white menu no matter what background the closed control carries.
- **A control's border uses `--field-border`, not `--rule-strong`.** The border is frequently the only thing marking where an input *is*, which puts it under the 3:1 non-text contrast floor rather than the decorative-rule budget; `--rule-strong` measures 1.69:1 on the dark ground. `--rule-strong` stays correct for dividers.
- **Anything in a layout that derives from the current path must read it reactively.** An App Router layout does not re-render when navigating between the routes that share it, so `x-pathname` read in a layout freezes at whatever it was when the section mounted. That is fine for the primary nav, which is rendered per page; it silently broke the About tab bar, including putting `aria-current` on the wrong tab. Use `usePathname` in a client component instead.
- **Static assets live in `public/`, and the favicon lives in exactly one place.** `public/favicon.ico`, never also `app/favicon.ico`. Next accepts both without error, but `public/` wins the URL while the app-router file still emits the `<link rel="icon">` tag — the markup then advertises one file's type and sizes while the server sends another's bytes, silently and through a clean build. Because the icon sits in `public/`, its `<link>` is declared explicitly in `layout.tsx`; Next auto-announces the app-router convention only.

## Working Practices

**`main` is protected. Never commit to it directly.** Branch → push → PR → four Security
checks green → rebase merge. Enforced for admins, so a direct push is rejected outright.
Linear history is required, so rebase rather than merge-commit.

**Keep the docs current in the same commit as the change.** `ROADMAP.md`, `README.md` and
this file are part of the deliverable, not notes about it — a reviewer reads them as the
project's own account of itself, and the `/roadmap` page renders `ROADMAP.md` directly.
Before opening any PR, ask:

- Did this complete, block, or add a roadmap item? → tick the box, or annotate why it's stuck.
- Did this change setup, scripts, stack, or deploy behaviour? → `README.md`.
- Did this establish a rule or a decision future work must follow? → this file.

Docs drifting behind the code is the most common way a demo repo loses credibility: an
unticked box next to working code reads as abandoned, and a ticked box next to nothing
reads as dishonest. Neither is recoverable by a later cleanup commit, because the history
is visible.

**Verify security controls empirically.** Reading a guard proves nothing. Give it something
it should catch and confirm it catches it — that method found three fail-open defects in
these very scripts that eye review had missed.

## Definition of Done (MVP)

All Phase 1–6 items in `ROADMAP.md` checked off, README written, deployed live on the custom domain via Vercel + Cloudflare.
