# Financial Watchlist Dashboard

Track companies, watch prices and charts, read the news that moves them.

**Live:** [financial-demo.nyxiontech.com](https://financial-demo.nyxiontech.com)

> **Status: Phase 1 complete.** Building in phases — see [ROADMAP.md](ROADMAP.md), or the
> live `/roadmap` page once Phase 3 ships. Full architecture write-up lands with Phase 6.

## Stack

| | |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript strict, Tailwind v4 |
| Charts | [lightweight-charts](https://github.com/tradingview/lightweight-charts) |
| Auth & DB | Supabase (Postgres + Auth), email/password + Google OAuth |
| Market data | Twelve Data (quotes, OHLC, search) + Finnhub (news, fundamentals) |
| Email | Resend, via Supabase edge functions |
| Hosting | Vercel, Cloudflare DNS (DNS-only — see below) |

Two market-data providers because neither free tier covers the whole surface alone —
Finnhub gates historical candles, Twelve Data gates news and fundamentals. Both sit behind
one typed interface in `lib/market-data/`, so callers never know which vendor answered.

## Local setup

```bash
cp .env.example .env.local            # fill in your own keys
npm install
git config core.hooksPath .githooks   # enable the pre-commit secret scan
npm run dev
```

Nothing reads the env vars yet, so the app builds and runs with `.env.local` empty.

| Script | Does |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | eslint |
| `npm run security` | env-exposure guard (same check CI runs) |
| `npm run test:rls` | cross-user RLS isolation suite (needs `supabase start`) |
| `npm run test:e2e` | Playwright journey against the production bundle |
| `npm run test:routes` | auth-gate coverage (no server needed) |
| `npm run test:market` | market-data error classification |
| `npm run test` | both suites |

The local Supabase stack runs on ports `544xx` rather than the default `543xx`, so it can
coexist with other Supabase projects on the same machine.

## Watchlist

Add and remove are server actions. What is **absent** from them is the point:
there is no `where user_id = ...` clause anywhere. RLS enforces ownership at the
database, so the actions run as the signed-in user and the policies decide what
they may touch. An application-layer filter would be a second, weaker copy of a
rule that already exists — and the copy is the one that drifts.

`user_id` is still set explicitly on insert, because the INSERT policy's
`WITH CHECK` compares against it: the row has to claim an owner for the database
to verify the claim.

The dashboard streams. Heading, the add control and every ticker render straight
from Postgres; only prices sit inside a Suspense boundary, so a rate-limited feed
delays the numbers rather than the page — and the skeletons can already name
which companies are loading.

## Company pages

`/company/[ticker]` composes four independent sources into four Suspense
boundaries. Fundamentals come from a different vendor than the chart, so one
being rate-limited must not blank the other — that is the whole reason the page
is composed this way rather than awaiting everything up front.

The chart here **is** an instrument, so unlike the landing hero it ships the
hover layer: crosshair plus an OHLC readout rendered beside the plot rather than
floating over it, so it never covers the data it describes. The readout shows
the latest bar until the pointer picks one, so the row never appears and
disappears under the cursor.

## Market data

`src/lib/market-data/` exposes `getQuotes`, `getCandles`, `searchSymbols`,
`getFundamentals`, `getNews`. Callers import from there and never learn which
vendor answered — which already changed once during this build.

**Nothing in this layer throws.** A provider being rate-limited or down is an
expected operating condition on a free tier, not an exception, and an exception
thrown through a server component takes out the whole route. Failures are values
(`{ ok: false, reason }`), so every caller is forced by the type system to decide
what to render when data is absent.

Twelve Data answers **HTTP 200 with an error object** rather than using status
codes for its own failures, so a naive `res.ok` check reads a rate limit as
success and produces `undefined` prices downstream. `twelveDataError()` handles
that, and it is unit-tested precisely because it is the kind of mapping that rots
silently.

Reads are cache-first against `quote_cache` / `news_cache`. When a refresh fails
but a stale row exists, the stale row is served and marked — on an 8-request-per-
minute budget that happens routinely, and a four-minute-old price beats an error
card. `asOf` always reports the **oldest** contributing timestamp, because
"as of 14:32" has to be true of every number on screen.

## Charts and colour

Price direction uses `--up: #2dd4bf` / `--down: #f87171`. These were **validated,
not chosen by eye**. The obvious pair (`#3fb27f` / `#e2565f`) scored ΔE 5.1 for
deuteranopia — below even the conditional floor, and unlike a `▲` a candlestick
cannot signal direction by shape. The shipped pair separates on the blue–yellow
axis, which deuteranopia preserves, scoring ΔE 10.7.

Candles additionally encode direction as **filled (up) versus hollow (down)**, so
the signal survives colour being removed entirely.

The landing page hero renders from a committed fixture
(`src/lib/fixtures/xau-daily.json`, 160 real XAU/USD daily bars) rather than a
live call. The highest-traffic route is the least defensible place to spend an
800-call daily budget — and it means the first thing anyone sees can never be an
error state, whatever the providers are doing.

## Database

Schema lives in [`supabase/migrations/`](supabase/migrations/) and is applied with
`supabase db reset` locally. Every user-owned table has RLS enabled with four policies —
one per operation rather than a single `FOR ALL` — because `FOR ALL` makes it easy to get
`USING` right and forget `WITH CHECK`, which would let a user write rows into someone
else's account while only being able to read their own.

`quote_cache` and `news_cache` have RLS enabled and **zero** policies. That is deliberate:
RLS denies by default, so they are unreachable by anything holding the publishable key.
Only server route handlers, using the secret key, can touch them. A browser able to read
the cache could enumerate every ticker the entire user base follows.

## Auth

Three Supabase clients, one per execution context: browser, server, middleware.
All three carry only the publishable key — the server client holds the *user's*
session, not admin rights, so RLS applies identically everywhere.

Every access decision uses `getUser()`, never `getSession()`. `getSession()`
reads the JWT straight from the cookie without asking Supabase whether it is
still valid, so on the server it will report a user for a forged or revoked
token.

Sign-in, sign-up and sign-out run as **server actions**, so the session cookie is
written server-side in the request that establishes it and the redirect decision
cannot be skipped by a client that fails to navigate. Google OAuth lands on
`/auth/callback`, which exchanges the one-time code for a session.

Post-auth destinations pass through `safeRedirectPath()`. An open redirect there
is a real phishing primitive — it bounces a user off-site at the moment they have
just typed a password. `//evil.com` is the case that catches people: it is
protocol-relative, so a bare `startsWith("/")` treats it as local.

**Google OAuth needs two things set in the Supabase dashboard** (Authentication →
URL Configuration), and neither lives in this repo: **Site URL** must be the
deployed origin, and the callback must be in **Redirect URLs**. Supabase forwards
any `redirect_to` to the provider without checking it, then validates on the way
back — and a miss falls back silently to Site URL. If Site URL is still the
default, users land on `localhost` after signing in.

### Auth latency

`getUser()` costs ~105ms with a live session (it revalidates against the auth
server) and 0ms without one — `supabase-js` short-circuits locally when there is
no parseable token, so anonymous traffic pays nothing.

A single button click used to spend that three times: middleware validated, the
server action validated again, then the revalidated page validated a third time.
Middleware now forwards the identity it already validated as `x-user-id` /
`x-user-email`, and components read that instead of re-asking.

That is a cache of middleware's decision, never an independent source of truth —
the gate in `middleware.ts` still grants or denies access. It is safe to trust
because middleware sets both headers **unconditionally** on every matched
request, including to empty when signed out, so a forged inbound value is always
overwritten. Verified: requests carrying hand-crafted `x-user-id` headers still
receive a 307 to `/login`.

Routes are gated in `middleware.ts` rather than per component. Per-component
checks fail open — a new page that forgets the check is simply unprotected, and
nothing tells you. The route policy lives in `src/lib/auth/routes.ts`, free of
Next imports so it can be unit-tested without booting the framework.

### RLS is tested, not assumed

`npm run test:rls` holds two real sessions and tries to cross between them — 12 tests
covering reads, inserts against `WITH CHECK`, updates, deletes, row reassignment, cache
visibility, and anonymous access. Every test asserts the *denied* case.

The suite was validated by deliberately rewriting two policies to `using (true)` and
confirming it failed. A test suite that cannot fail proves nothing, and RLS policies are
unusually good at looking correct while being wrong.

It runs against the deployed project as well as the local stack. Local-only testing proves
the migrations are correct; running against production proves the policies that *shipped*
are the policies that were tested. Point it anywhere by setting `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`. It creates two throwaway users and
deletes them in teardown.

## Notable decisions

**Dependency overrides.** `create-next-app` ships `next@15.5.22` with `postcss@8.4.31` and
`sharp@0.34.5` nested inside it, both carrying high-severity advisories. `npm audit fix --force`
proposed resolving this by installing `next@9.3.3` — a six-year downgrade. `package.json`
pins patched versions through `overrides` instead; `npm audit` reports 0 vulnerabilities.

**Cloudflare is DNS-only, deliberately.** Proxying Cloudflare in front of Vercel
double-CDNs the traffic and interferes with Vercel's certificate management. The orange
cloud stays off.

**No CSP yet.** A useful Content-Security-Policy for Next.js needs per-request nonces
threaded through the App Router. A guessed policy either breaks hydration or is permissive
enough to certify nothing, so it gets built in Phase 3 against pages that exist.

**Supabase keys use the current naming, not the legacy one.** `sb_publishable_…` replaces
the old anon key and `sb_secret_…` replaces service_role, so the environment variables are
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` rather than the older
`…_ANON_KEY` / `…_SERVICE_ROLE_KEY`. A variable should say what its value actually is.

## Security

The repo is public, so secrets are guarded in depth rather than at one checkpoint:

| Layer | When it runs | What it stops |
|---|---|---|
| [`.githooks/pre-commit`](.githooks/pre-commit) | before a commit exists | credential-shaped strings and `.env` files entering history |
| [`scripts/check-env-exposure.sh`](scripts/check-env-exposure.sh) | pre-commit + CI | server-only vars carrying `NEXT_PUBLIC_`, or referenced from client components |
| [`.github/workflows/security.yml`](.github/workflows/security.yml) | every push/PR | gitleaks over full history, semgrep OWASP Top 10, `npm audit` |
| same workflow, weekly cron | Mondays 06:00 UTC | advisories that appeared after the code was written |
| GitHub push protection | server-side, on push | secrets even if the local hook is bypassed |

Prevention is weighted over detection on purpose: a key pushed to a public repo is
compromised the instant it lands, because scrapers watch the public events firehose and the
object stays reachable after the commit is deleted. Rotation is the only real remedy, so
the layers that matter most are the ones that run *before* the push.

`main` is protected — all four checks must pass, changes land via PR, linear history, and
the rules apply to admins too.

Response headers set in [`next.config.ts`](next.config.ts): `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. Vercel supplies HSTS.
`Referrer-Policy` is the load-bearing one here — a full-URL referrer would leak routes like
`/company/AAPL` to linked-out news publishers, disclosing a user's private watchlist.

## Architecture, and why

**Two market-data providers, one interface.** Neither free tier covers the whole
surface: Finnhub gates historical candles behind a paid plan, Twelve Data gates
news and fundamentals. Rather than paywalling two features or paying for one
vendor, both sit behind `lib/market-data/` and callers never learn which
answered. Verified against live keys — nothing the product needs is paywalled.

**Failures are values, not exceptions.** On a free tier, being rate-limited is
an operating condition rather than an error, and an exception thrown through a
server component takes out the route. Four classes — `rate_limited`,
`unavailable`, `not_entitled`, `not_found` — each with fixed copy and a
`retryable` flag, so the UI never offers a retry that cannot succeed.

**Serve stale before erroring.** With 8 requests a minute available, refresh
failures are routine. A cached price with an honest `as of 14:32` badge beats an
error card, and being explicit about age is exactly what licenses showing it.

**Transient → toast, persistent → inline.** A failed background refresh leaves
data on screen and raises a dismissible toast; a failure with nothing to fall
back on renders where the content would have been. Toasts deduplicate by cause,
because twelve cards failing on one rate limit is one event.

**RLS is the authorization boundary.** No server action contains a
`where user_id = ...` clause. The database decides, and 12 tests hold two real
sessions and try to cross between them to prove it.

**Colour is validated, not chosen.** The obvious green/red price pair failed
colourblind separation at ΔE 5.1; the shipped pair scores 10.7, and candles also
encode direction as filled versus hollow so the signal survives colour entirely.

### Things found by running the code rather than reading it

Each of these passed review, type-checking and lint while being wrong:

- Tailwind opacity modifiers silently do nothing on arbitrary CSS variables, so
  the hero scrim rendered fully transparent
- `lightweight-charts` positions canvases absolutely and painted over that scrim
  regardless of DOM order
- Quote caching wrote and read correctly but never propagated `asOf`, so the
  "as of" badge could never have appeared
- Twelve Data answers HTTP 200 with an error body, so a `res.ok` check reads a
  rate limit as success
- Three fail-open defects in the secret-scanning scripts, found by planting a
  fake key rather than by reading them

### Sign-out

Verified against ASVS 7.4.1 rather than assumed: after `signOut()` the refresh
token is **revoked server-side** (400 on exchange) and the previous access token
is rejected (403). It is not merely a deleted cookie the client controls, which
is the common way this requirement is only apparently met.

## End-to-end tests

`npm run test:e2e` builds and serves the **production** bundle rather than
running `next dev`. Dev mode behaves differently enough around streaming,
caching and middleware that a passing dev-mode test says less than it appears
to — and a stale-`.next` incident during this build is exactly the kind of thing
a production run catches and dev does not.

Each test gets a disposable confirmed user created through the admin API, and
tears it down afterwards. Signup is not driven through the form for every test
because email confirmation would block the run; the form has its own coverage.

The suite asserts things only a real browser can: that middleware redirects
before any React runs, that `?next=` survives the round trip, that a wrong
password does not reveal whether the account exists, and that signing out
cannot be undone by back-navigation.

## Navigation

One `<Nav>` across dashboard, company and roadmap, replacing four routes that
each improvised their own header. `/roadmap` is public and previously had no way
into the app at all.

The active route is marked by a gold rule flush with the bar's own hairline — the
nav reads as one continuous edge with a segment lit, rather than a website
underline — and carries `aria-current="page"`, so the state is not colour-only.

No hamburger. Two links do not earn a disclosure control.

The nav is session-aware, which forced `/roadmap` off `force-static`: a page
prerendered at build time has no request to read identity or pathname from, so a
signed-in visitor was being shown "Sign in". Identity comes from the header
middleware already validated, so putting the nav on every page costs no extra
round-trip.

## Themes

Dark leads; light is the alternative. The light palette is **not an inversion** —
a flipped dark palette fails the moment contrast is measured. The dark price
pair scores 1.81 and 2.69 against a light surface, well under the 3:1 floor, so
light gets its own validated pair (`#0d9488` / `#dc2626`, deutan ΔE 13.1 — better
separation than the dark pair achieves).

The stored theme is applied by a blocking script in `<head>`, before first
paint. Applying it in an effect would show one frame of the wrong theme on every
load, and a white flash on a dark-led product is worse than having no toggle.

## Responsive

Verified at 375 / 768 / 1440 with Playwright, which sets a **real layout
viewport** — headless Chrome's `--window-size` cropped the output instead, so
earlier attempts were measuring a wide render through a narrow window and
proving nothing. Seven tests assert zero horizontal overflow across all eight
routes; they found the nav at 516px inside a 375px viewport.

## Watchlist cards

A card exists to answer "should I look closer?", and a price plus a percentage
cannot answer that. Each card carries a **52-week range track** with a marker
showing where the price currently sits — 309 means nothing; 309 near the top of
a 202–345 year means something.

Every field this needs was **already in the quote response and being discarded**:
day high/low, 52-week high/low, volume and market-open state all ship in the
same payload we were reading `close` out of. The added information costs no
extra request.

A track with a marker rather than a bar filling from the left, because the value
is a *position*, not a quantity — a filled bar would imply 75% *of* something.
The marker is invisible to assistive tech, so the same fact is stated in words.

The border is gone: the grid gap already separated the cards, so the box was
chrome doing work the spacing had done.

## Search

Fully keyboard-driveable — `↑`/`↓` move through options, `Enter` selects,
`Escape` closes — with `combobox`/`listbox`/`option` roles and
`aria-activedescendant`. A search that needs a pointer is unfinished.

## Optimistic watchlist

Add and remove apply immediately. Two things this forced:

**The dispatch has to sit inside the action**, not in `onSubmit`. React only
accepts optimistic updates within an action's transition — dispatching outside
one silently dropped the update *and* stopped the server action running, so the
UI looked right while the database never changed.

**Optimistic UI makes the screen stop being evidence of persistence.** Three E2E
tests were asserting a card had appeared or vanished and then querying the
database; with optimism those assertions passed instantly, before the round trip
finished. They now poll the real rows.

`useOptimistic` rather than hand-rolled state: React discards the optimistic
value automatically when the transition settles. Manual state has to be cleared
by hand, and the moment that is missed the list shows something the database
does not contain — worse than no optimism at all in a product about money.

A card added a moment ago has no quote yet and says "fetching price…" rather
than inventing a number.

## Sections

| Route | |
|---|---|
| `/dashboard` | the watchlist and its prices |
| `/company/[ticker]` | chart, statistics, headlines, alerts for one company |
| `/news` | headlines across everything followed, newest first |
| `/alerts` | every alert in one place |
| `/roadmap` | public build progress, generated from `ROADMAP.md` |

`/news` issues one Finnhub call per watched ticker **in parallel** — sequentially
a twelve-company watchlist would take twelve round trips before anything
rendered — and most are served from `news_cache`'s 30-minute TTL. A per-ticker
failure is swallowed rather than propagated: one company's news being
unavailable is not a reason to show nothing, so the feed omits it and reports
how many sources answered.

`/alerts` exists because alerts are *created* on a company page, which is the
right place to set one, but that left the only way to see what you had armed as
visiting each company in turn and remembering. Waiting and sent are separated
because they answer different questions.

## Price alerts

Thresholds are evaluated by a Supabase edge function on a schedule, not while a
user happens to have the page open — that is the point of the feature.

Three decisions worth noting:

**One quote request for every distinct ticker across all users.** Twelve Data
allows 8 requests a minute; one call per alert would exceed that with a dozen
users.

**`triggered_at` is claimed BEFORE the email is sent.** Sending twice is worse
than sending late: a duplicate price alert reads as a second crossing that never
happened. A send that fails after the claim is logged and simply does not
re-fire — the safer direction to fail in.

**The function is gated by a shared secret.** It is deployed with
`--no-verify-jwt` so the scheduler can call it without minting a token, which
leaves the URL reachable by anyone who finds it. Without the check, a stranger
could hammer it and spend the daily Twelve Data budget. Verified: 403 without
the header, 403 with a wrong one.

Scheduling is set up in the Supabase dashboard rather than committed, because a
cron job that calls this function has to carry the secret.

## Licence

MIT
