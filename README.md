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
| `npm run test:routes` | auth-gate coverage (no server needed) |
| `npm run test:market` | market-data error classification |
| `npm run test` | both suites |

The local Supabase stack runs on ports `544xx` rather than the default `543xx`, so it can
coexist with other Supabase projects on the same machine.

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

## Licence

MIT
