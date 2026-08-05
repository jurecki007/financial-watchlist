# Roadmap — Financial Watchlist Dashboard

Demo project built to showcase full-stack skill (auth, database, RLS, external API integration, email) for a job application. Requirement was "a beautiful website with user auth and a user database — the more you add, the better."

## 🎯 MVP

### Phase 1 — Foundation
- [x] Next.js 15 (App Router) + TypeScript + Tailwind scaffold — PR #1
- [x] Cloudflare domain → Vercel deploy pipeline verified with a blank page — PR #2, live at [financial-demo.nyxiontech.com](https://financial-demo.nyxiontech.com)
- [x] Supabase project created, env vars wired — project `fsboxdlbncegnhcjniaf`, local `.env.local` wired and verified against the live API

**Phase 1 complete.** Two follow-ups that are not Phase 1 blockers:
- Vercel environment variables still need adding (nothing reads them until Phase 2)
- Google OAuth is not yet enabled on the Supabase project — needs a Google Cloud Console client, done in Phase 2

**Delivered alongside, not originally planned**
- [x] Public repo hardened: pre-commit secret scan, CI (gitleaks + semgrep OWASP + `npm audit`), weekly sweep, GitHub push protection
- [x] `main` protected — PR required, 4 status checks, linear history, admins included
- [x] Baseline security headers in `next.config.ts` (CSP deferred to Phase 3, see README)
- [x] Dependency `overrides` for the postcss/sharp advisories `create-next-app` ships with

Env vars are intentionally absent for now; `.env.example` documents every key the app
will need. Nothing in the scaffold reads them yet, so the build is green without them.

### Phase 2 — Auth & Data Layer
- [x] `profiles` table with auto-create trigger on signup
- [x] `watchlist_items` table with RLS (`user_id = auth.uid()` on all ops)
- [x] `price_alerts`, `quote_cache`, `news_cache` — full data model migrated ahead of schedule
- [x] **Add-on #2 delivered early**: 12 cross-user RLS isolation tests (`npm run test:rls`)
- [x] Migrations applied to the remote project — pushed via `supabase db push`, history in sync, isolation suite re-run against production (12/12)
- [x] Supabase SSR clients (browser / server / middleware split) — `getUser()` everywhere, never `getSession()`
- [x] Supabase Auth: email/password + Google OAuth — server actions, `/auth/callback` code exchange, open-redirect guard unit-tested
- [x] Auth-gated routes (middleware redirect if not logged in) — route policy extracted and unit-tested, redirect verified against a running server

Schema is verified against real Postgres — locally and against the deployed project. The
isolation suite was itself validated by deliberately breaking two policies and confirming
the tests failed; a suite that cannot fail proves nothing. Running it against production
proves the policies that shipped are the policies that were tested, which is the part
local-only testing cannot establish.

### Phase 3 — Landing + Shell

**Landing page**

First thing anyone sees — treated as a deliverable, not a placeholder. Direction:
market-native dark, self-drawing gold candlestick hero. See "Design Direction" in `CLAUDE.md`.
- [x] Design tokens: colour system promoted to global scope (gold accent; green/red reserved for price only); type scale settles with the landing page
- [x] Capture `lib/fixtures/xau-daily.json` — 160 real XAU/USD daily bars, integrity-checked
- [x] Hero chart: progressive draw-in, dynamically imported, reduced-motion → final frame
- [x] Hero copy: headline, subhead, primary + secondary CTA, server-rendered as LCP
- [x] Contrast verified against the rendered chart, not the bare ground
- [x] Feature section: watchlist, live charts, price alerts
- [x] Footer: tech-stack credits, GitHub link, `/roadmap` link
- [x] Responsive at 375 / 768 / 1440 — verified with Playwright, which sets a real layout viewport; zero horizontal overflow across all 8 routes
- [x] Accessibility pass — global `:focus-visible` ring, reduced-motion honoured throughout, colourblind-safe deltas (validated ΔE 10.7 plus filled/hollow candles), `aria-live` on toasts and search status, semantic landmarks. *Contrast verified by calculation, not yet by an automated audit run.*

**Shell**
- [x] App shell: shared nav across dashboard, company and roadmap, with active-route state and a signed-out variant
- [x] Dark-mode toggle with a purpose-built light theme (not an inversion)
- [x] Loading / empty / error states as reusable components
- [x] Toast system (dismissible, deduplicated by error class, accessible via `aria-live`)

**Loading experience** — the perceived-speed work. Decisions locked; see `CLAUDE.md`.
- [x] Stream the shell — prices sit in their own Suspense boundary so a rate-limited feed delays numbers, not the page
- [x] Cache-first render with an `as of HH:MM` badge; stale values marked in gold rather than hidden
- [x] Anti-flash timing — skeletons hold at opacity 0 for 200ms then fade over 400ms, so content that streams in faster replaces them before they were ever visible
- [x] Skeletons composed from the same layout primitives as the real components
- [x] Placeholders shaped like their data (digit-width `ch` units in the mono face)
- [x] Opacity pulse, not shimmer sweep; no animation at all under `prefers-reduced-motion`
- [x] Hero chart draw-in *is* its loading state — no spinner; the chart is absolutely positioned in a min-height section so nothing shifts when it mounts
- [x] Search keeps previous results on screen while fetching; spinner sits inside the input

**`/roadmap` page**
- [x] Public route rendering this file's phases and checkbox state, parsed from `ROADMAP.md` at build time — single source of truth, no hand-maintained duplicate
- [x] Per-phase completion and an overall figure
- [x] Curated public view — only checkbox lines and add-on names are ever read, so build-strategy notes cannot reach the live page

### Phase 4 — Financial Data Integration
- [x] `lib/market-data/` provider interface + Twelve Data provider (quotes, time series, symbol search)
- [x] Finnhub provider (company news, fundamentals) behind the same interface — keys stay server-side
- [x] Verify both free tiers against real keys before building UI on top of them — Twelve Data time_series + quote, Finnhub company-news + metrics all confirmed working
- [x] Response caching (`quote_cache` / `news_cache` table) with stale-serve fallback
- [x] Batched quote fetching — one request per render, and only for tickers whose cache is stale
- [x] Ticker search + autocomplete against Twelve Data's symbol search endpoint — debounced, request-aborted, results persist while refetching
- [x] Error taxonomy (`rate_limited` / `unavailable` / `not_entitled` / `not_found`) + stale-cache fallback

### Phase 5 — Watchlist Core
- [x] Add/remove company to watchlist (CRUD wired to Supabase) — no ownership clause in app code; RLS is the enforcement
- [x] Dashboard: card per watched company — price, daily change, links through to the detail page
- [x] Company detail page: candlestick chart with crosshair + OHLC readout, key stats (market cap, P/E, 52w range), recent headlines — four independent Suspense boundaries

### Phase 6 — Polish Pass
- [x] Responsive check (mobile/tablet/desktop) — automated, 7 tests
- [x] Skeleton loaders on all async data (dashboard cards, price, stats, news)
- [x] Fault-injection pass — `not_entitled` and `not_found` forced live with real invalid credentials; `rate_limited` and `unavailable` covered by unit tests rather than by burning the daily budget
- [x] README with architecture + decisions
- [x] Canonical URLs + `metadataBase` — previews canonicalise to production, `?next=` variants collapse to one URL
- [x] `robots.txt` + `sitemap.xml` — all crawlers allowed including AI; sitemap lists only the two indexable URLs
- [x] `noindex` on `/login` and `/signup` — thin auth pages; `follow` kept so the crawl passes through
- [x] Structured data — `WebSite` + `Person` JSON-LD, server-rendered; 7 tests, escape validated by breaking it
- [x] HSTS with `includeSubDomains` + `preload` — set in `next.config.ts`; preload still needs submitting at hstspreload.org

**At the end of Phase 6 the product is fully demoable.** Everything below is upside, not requirement.

---

## ✨ Add-ons (optional, ordered by effort:impact)

| # | Add-on | Effort | Impact |
|---|---|---|---|
| 1 | ~~Price alerts (threshold-based) + Resend email via scheduled edge function~~ **shipped** | Medium | High — async/event-driven thinking |
| 2 | ~~RLS tests proving cross-user isolation — 12 shipped in Phase 2~~ | Low | High — rarely done, strong signal |
| 3 | ~~Search debounce + polished autocomplete UX~~ **shipped in Phase 5** | Low | Medium |
| 4 | ~~Optimistic UI on watchlist add/remove~~ **shipped** | Low | Medium |
| 5 | Weekly digest email (cron + Resend, summarizing watchlist movers) — *deferred* | Medium | Medium |
| 6 | ~~Sentiment tag on news headlines~~ **shipped** | Medium | Medium |
| 7 | ~~E2E test (Playwright) for signup → add ticker → view dashboard~~ **shipped — 6 tests** | Medium | High |

**Cutoff reached:** #2 shipped in Phase 2, #1 is the current work. Paper-trading was dropped as scope-risky; the weekly digest is deferred — the per-alert email covers the same scheduled-send story without a second cron.

---

## Note on the public `/roadmap` page

This file is the source of truth, but it is **not** published verbatim. It contains build-strategy language written for us, not for an audience — "job application demo", "strong signal", "rarely done", the effort:impact table, and the cutoff advice above. A reviewer landing on `/roadmap` should not be reading our notes about how to impress them.

The page therefore renders a **curated projection** of this file:

- **Published:** Phase 1–6 names, their items, and checkbox state; overall progress.
- **Published, reworded:** add-ons as a "What's next" list — names only, no effort/impact columns.
- **Never published:** the impact commentary, the suggested cutoff, and any framing of the project as a job application.

Mechanically: items are opted *in* to the public view, not out — a section is private unless explicitly marked publishable, so a future edit to this file can't accidentally leak strategy notes onto the live site.

## Data Model

```
profiles          (id -> auth.users.id, display_name, created_at)
watchlist_items   (id, user_id, ticker, company_name, added_at)
price_alerts      (id, user_id, ticker, condition, threshold, triggered_at, active)
quote_cache       (ticker, quote_json, fetched_at)
news_cache        (ticker, article_json, fetched_at)
```

RLS pattern: `user_id = auth.uid()` on select/insert/update/delete for all user-owned tables.
