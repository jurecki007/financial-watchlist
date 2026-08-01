# Financial Watchlist Dashboard

Track companies, watch prices and charts, read the news that moves them.

**Live:** [financial-demo.nyxiontech.com](https://financial-demo.nyxiontech.com)

> **Status: Phase 1 complete (bar the Supabase project).** Building in phases — see
> [ROADMAP.md](ROADMAP.md), or the live `/roadmap` page once Phase 3 ships. Full
> architecture write-up lands with Phase 6.

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
