# Financial Watchlist Dashboard

Track companies, watch prices and charts, read the news that moves them.

**Live:** [financial-demo.nyxiontech.com](https://financial-demo.nyxiontech.com)

**Sign in as a reviewer** — no signup, no confirmation email:

| | |
|---|---|
| Email | `reviewer@fakturownia.pl` |
| Password | `ReviewMe2026!` |

The account arrives with six companies on its watchlist and two price alerts, one
pending and one already fired, so every screen has real data on it. Nothing it can
reach is sensitive: RLS confines it to its own rows, exactly as it confines any other
account, so the published password grants a tour and nothing more. Signing up normally
works too — it just costs you a round trip through a confirmation email.

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

The app **builds** with `.env.local` empty, but it no longer **runs** meaningfully that
way: `TWELVE_DATA_API_KEY` drives quotes and every chart, `FINNHUB_API_KEY` drives
fundamentals and news. Without them each of those surfaces renders "Market data isn't
configured" and the server log names the missing variable.

The same applies to every deployment target. **A missing key in Vercel looks exactly like
a working deploy** — auth, the watchlist and the landing page all function, because they
touch no provider; only the data surfaces are blank. If charts and prices are empty in a
deployed environment, check the project's environment variables before anything else, and
check the runtime log for `[market-data] … is not set`.

| Script | Does |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | eslint |
| `npm run security` | env-exposure guard (same check CI runs) |
| `npm run seed:demo` | create or restore the reviewer demo account (needs `SUPABASE_SECRET_KEY`) |
| `npm run mockups` | render every email into `mockups/emails/` (no network, sends nothing) |
| `npm run test:rls` | cross-user RLS isolation suite (needs `supabase start`) |
| `npm run test:e2e` | Playwright journey against the production bundle |
| `npm run test:routes` | auth-gate coverage (no server needed) |
| `npm run test:market` | market-data error classification |
| `npm run test:toast` | toast deduplication by failure class |
| `npm run test:schema` | JSON-LD graph + `</script>` escape guard |
| `npm run test:history` | candle-history cache keying and eviction |
| `npm run test` | every suite above, RLS last |

The local Supabase stack runs on ports `544xx` rather than the default `543xx`, so it can
coexist with other Supabase projects on the same machine.

## Static assets

Everything served verbatim lives in [`public/`](public/), reachable at the URL matching its
path — `public/favicon.ico` → `/favicon.ico`.

**The favicon lives here and not at `app/favicon.ico`, and it must be in exactly one of
them.** Next supports both, and with both present it does not complain: `public/` wins the
URL while the app-router file still generates the `<link rel="icon">` tag, so the markup
advertises one file's type and dimensions while the server returns a different file's
bytes. That mismatch is silent and survives a clean build. Because the icon now sits in
`public/`, the `<link>` is declared explicitly in [`layout.tsx`](src/app/layout.tsx) —
Next announces the app-router convention only, and a file in `public/` is served but never
announced.

Two behaviours worth knowing when swapping an asset, both verified rather than assumed:

- **Replacing the contents** of a file that already existed at build time is picked up
  immediately — no rebuild.
- **Adding a new filename** is a 404 until the next `npm run build`; the set of public
  paths is fixed when the build runs.

On Vercel either change needs a redeploy regardless, since `public/` is uploaded as static
assets at build time.

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

### Chart history

The company chart ships **750 daily bars** (about three years) and shows the most
recent 180 of them. Panning within 20 bars of the left edge fetches the next 750
through [`/api/candles`](src/app/api/candles/route.ts) and prepends them; reaching
the start of a listing's history stops the requests and the readout says so.

The three numbers are decided against different constraints, which is why they are
not one number:

- **750 fetched** is a *payload* decision. Depth is billed per request — a response
  carries `api-credits-request: 1` whether it holds 180 bars or 5000 — so the cost
  of depth is bytes, not credits: ~15kB at 180, ~62kB at 750, ~400kB at 5000.
- **180 shown** is a *legibility* decision. 750 candles in a 22rem plot are about a
  pixel wide each, which is a smear. The extra depth exists to be panned into.
  Using `fitContent()` here would also park the visible range at logical index 0,
  inside the prefetch margin, so every page load would immediately fetch a second
  page nobody asked for.
- **20 bars of margin** is a *latency* decision — far enough out that the fetch
  usually lands before the pan reaches the end of what is drawn.

Paging backwards uses Twelve Data's `end_date`, which is **exclusive**: asking for
bars before `2023-08-09` returns `2023-08-08` and earlier, so consecutive pages
abut without overlapping. Verified against the live API rather than assumed — a
duplicate timestamp makes `lightweight-charts` render wrong rather than throw, so
the merge dedupes by time regardless.

Those historical pages end at a fixed past date and can never change, so they get
an in-memory cache ([`history-cache.ts`](src/lib/market-data/history-cache.ts))
rather than a Postgres table: there is no staleness to reason about, only whether
we ask twice. The leading page is never cached there — it contains today's still-
moving bar.

**Prepending does not move the view**, because `setData` re-anchors the viewport by
time rather than by logical index. That is library behaviour, not something the
component enforces, so it is pinned by an e2e test rather than by code: replacing
that call with `fitContent()` slides the user from 2023-10-31 to 2023-02-23
mid-pan, and [`chart-history.spec.ts`](e2e/chart-history.spec.ts) fails.

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

### The demo account

`npm run seed:demo` creates the reviewer account at the top of this file, or restores it
if it already exists. It is a script rather than a migration because the row lives in
`auth.users`, which belongs to GoTrue: writing it by hand means reproducing a
password-hash format and column set that changes between platform releases, so a
migration that works today can silently produce an unusable row after an upgrade. The
Admin API is the supported door.

Three properties are deliberate:

**It is created pre-confirmed.** The deployed project requires email confirmation —
`supabase/config.toml` sets `enable_confirmations = false` for the *local* stack only,
which is why the signup page promises a confirmation mail. `email_confirm: true` marks
the address verified without sending anything.

**Every run resets it.** The password is published, so anyone reading this file can log
in and rearrange the watchlist. That is the accepted cost of a reviewer not having to
sign up, and re-running the seed is the entire recovery procedure — it resets the
password, replaces the watchlist and replaces the alerts. Run it before you send the
link.

**Its seeded alerts cannot fire.** `check-price-alerts` emails the account's own
address, and this account's address is on a domain we do not control. So the pending
alert sits far below any plausible price, and the fired one is already `triggered_at`
with `active = false` — invisible to the evaluator, which scans only
`where active and triggered_at is null`. Both states render in the UI; neither sends
mail. Note the residual risk: a visitor who *creates* an alert in this account can still
cause a send to a third-party domain, which will bounce against the Resend sending
domain. If that matters, move the account to an address you own.

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
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
`Strict-Transport-Security`. `Referrer-Policy` is the load-bearing one here — a full-URL
referrer would leak routes like `/company/AAPL` to linked-out news publishers, disclosing a
user's private watchlist.

HSTS is set here rather than left to Vercel's default, which carries the same two-year
`max-age` but neither `includeSubDomains` nor `preload`. Its scope is narrower than it
reads: served from `financial-demo.nyxiontech.com`, it binds that host and anything below
it, not sibling subdomains of `nyxiontech.com`. **`preload` is inert until the host is
submitted to and accepted by [hstspreload.org](https://hstspreload.org) — the directive
alone enrols nothing.** It is committed rather than toggled in a dashboard because removal
from the browser preload list takes months, so the intent should live somewhere it can be
argued with.

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

The toggle lives in the nav on every signed-in route, and in the hero's top row
on the landing page, which carries no nav. Both write `data-theme` on `<html>`,
which is what makes that attribute the single signal a chart can watch: both
`lightweight-charts` instances read their palette from CSS custom properties at
construction time, so each one observes `data-theme` and re-applies its colours
on change. Without that a theme switch left dark grid lines and dark axis text
sitting on the light page — the canvas does not inherit CSS.

## About pages

[`/about/project`](src/app/about/project/page.tsx) and
[`/about/author`](src/app/about/author/page.tsx) are the recruiter-facing surface: the
stack, both providers and their limits, the failure taxonomy, the data model and the
release process. Public — an auth gate on the pages that explain the project would defeat
the point of writing them.

They sit behind **one** primary-nav entry with their own two-tab bar rather than two more
top-level items. The primary nav already carries four destinations plus a wordmark, theme
toggle, account mark and sign-out, and already drops Roadmap below `sm` to fit.

The tab marker is a single element that translates and scales between tabs, not one marker
per tab. Two markers cross-fading says "this turned off, that turned on"; one that moves
says the selection moved, which is what happened. It is transform-only, so no frame of the
animation touches layout, and `prefers-reduced-motion` gets the same destination with no
travel.

**The tab bar is a client component on purpose.** An App Router layout does not re-render
when navigating between the routes that share it, so reading the path from the
`x-pathname` header — correct in the primary nav, which renders per page — froze it at
whatever it was when the section mounted. Every hard load looked right and only clicking
between tabs exposed it, which is why it is pinned by an e2e test that navigates by
clicking rather than by `goto`.

## Auth pages

`/login` and `/signup` carry the nav and footer, but the nav starts translated out of view
and comes down once the page scrolls: the form is the whole task, and a bar offering four
ways to leave sits badly above the moment we are asking someone to stay.

A translated element is still focusable, so `focus-within` brings the bar down on the first
Tab rather than letting focus land off-screen. The wordmark stays inside the form as well,
because with the nav hidden on arrival the page would otherwise have no route home at all.

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

**Alerts are evaluated hourly, and again the moment one is created.** The
schedule is a `pg_cron` job committed as a migration
(`20260806073000_schedule_price_alert_checks.sql`), not dashboard state.

Hourly is a budget decision. The sweep costs *one* Twelve Data request no matter
how many alerts exist, because every distinct ticker goes into a single
comma-separated `/quote` call — so 24 credits a day, about 3% of the free tier,
leaves the rest for the dashboard.

That interval alone would make `alert me when AAPL is above $1` look broken for
up to an hour, so `createAlert` also asks the evaluator to look at that one
ticker immediately. That call is best-effort by design: the alert is already
committed before it runs, it is bounded to four seconds so a slow provider
cannot hold the user's form submit open, and every failure path logs and
returns. If it does not happen, the sweep still catches it.

Running both means two evaluations can now be in flight against the same row,
so the claim is a compare-and-set rather than a blind write — the
`triggered_at is null` test moved into the UPDATE's own WHERE clause, and only
the caller whose update returns a row sends. Verified by firing three
concurrent claims at one alert and confirming exactly one won.

The endpoint and the shared secret come from Vault, not the migration — the
function is deployed `--no-verify-jwt`, so committing the secret would publish
the key to the lock. Set them once per project:

```sql
select vault.create_secret(
  'https://<project-ref>.supabase.co/functions/v1/check-price-alerts',
  'alerts_endpoint');
select vault.create_secret('<the CRON_SECRET value>', 'cron_secret');
```

A missing Vault row raises rather than posting to a null URL, so a
misconfigured job shows up in `cron.job_run_details` instead of looking
identical to "nothing crossed".

## Emails

Three messages leave this app: the **price alert** (built in the edge function,
sent through Resend) and the **signup confirmation** and **password reset**
(`supabase/templates/`, rendered by GoTrue). They share a visual system — dark
ground, gold action, monospace figures — and are built to the same rules.

**Email is not the web, and the markup shows it.** Outlook on Windows renders
with Word: no flex, no grid, unreliable padding. So layout is tables, every
style that matters is inline because Gmail drops `<style>` in several contexts,
and each call to action is a bulletproof button — VML for Outlook, a real
anchor for everyone else.

**The dark theme is declared, not assumed.** `color-scheme` and
`supported-color-schemes` are set so Apple Mail and Outlook.com stop
"helpfully" re-colouring a design that is already dark.

**Muted text is lifted above the app's own token.** `--faint` (`#6b6e74`)
measures 3.90:1 on the ground and 3.67:1 on the raised panel — under the 4.5:1
floor. The app can afford it because every faint string is repeated louder
nearby and the reader can switch themes; an email has neither escape. Email
muted text is `#7d8086`, the nearest value clearing AA on both surfaces
(5.03:1 and 4.74:1). The paste-this-link fallback moved from `--gold-dim`
(3.73:1) to `--gold` (8.34:1) — it is the path that has to work when a filter
strips the button, so it cannot be the least legible thing in the message.

**Every alert carries a `text/plain` part.** An html-only message scores
against you with spam filters and reads as blank to anything in plain-text
mode. The direction survives there too: `^` and `v` next to the figure, because
colour does not exist in plain text.

**Tickers are escaped before they reach the HTML.** `price_alerts` only
constrains a ticker to upper-case and 20 characters, and `<B>` satisfies both —
upper-casing does not disarm markup. Verified by rendering `<B>PWN</B>`,
`"><IMG SRC=X>` and `O'BRIEN&CO` and asserting none survive as markup.

### Seeing them without sending them

`npm run mockups` renders all four into [`mockups/emails/`](mockups/emails/) —
both alert directions, both auth templates, plus the alert's `text/plain`
alternative. They are generated from the real sources on every run, never
hand-maintained, because a mockup that has quietly stopped matching the email
is worse than no mockup: it is the artefact people trust when deciding whether
the real thing looks right.

A browser is not an email client, though. The mockups settle copy, hierarchy
and contrast; they cannot tell you how Word treats the VML button or what Gmail
does after stripping `<style>`.

### Deploying the auth templates

`supabase/config.toml` binds them for the **local** stack only, which is what
makes them testable in Inbucket before they reach an inbox. The deployed
project keeps its templates in the dashboard under **Authentication → Emails**,
and they are updated by pasting.

Do not reach for `supabase config push`. It would carry these blocks up, and
also `site_url = 127.0.0.1` and the absence of an `[auth.external.google]`
block — the exact combination documented at the top of `config.toml` as the way
to break Google sign-in.

Only `confirmation` and `recovery` are themed. `invite`, `magic_link`,
`email_change` and `reauthentication` stay on Supabase defaults because no flow
in this app triggers them. Note that the app has no forgot-password UI yet, so
`recovery` is reachable only from the dashboard — the template is ready ahead
of the screen.

## Licence

MIT
