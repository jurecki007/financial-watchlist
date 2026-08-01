# Financial Watchlist Dashboard

Track companies, watch prices and charts, read the news that moves them.

> **Status: in development.** Building in phases — see [ROADMAP.md](ROADMAP.md), or the live
> `/roadmap` page once it is deployed. Full architecture write-up lands with Phase 6.

## Stack

| | |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind |
| Charts | [lightweight-charts](https://github.com/tradingview/lightweight-charts) |
| Auth & DB | Supabase (Postgres + Auth), email/password + Google OAuth |
| Market data | Twelve Data (quotes, OHLC, search) + Finnhub (news, fundamentals) |
| Email | Resend, via Supabase edge functions |
| Hosting | Vercel + Cloudflare DNS |

Two market-data providers because neither free tier covers the whole surface alone —
Finnhub gates historical candles, Twelve Data gates news and fundamentals. Both sit behind
one typed interface in `lib/market-data/`, so callers never know which vendor answered.

## Local setup

```bash
cp .env.example .env.local   # fill in your own keys
npm install
git config core.hooksPath .githooks   # enable the pre-commit secret scan
npm run dev
```

## Security

This repo is public, so secrets are guarded at three layers:

- **`.githooks/pre-commit`** — blocks credential-shaped strings and `.env` files before they enter history.
- **`scripts/check-env-exposure.sh`** — asserts no server-only var is `NEXT_PUBLIC_`-prefixed or referenced from a client component.
- **[`.github/workflows/security.yml`](.github/workflows/security.yml)** — gitleaks over full history, semgrep OWASP Top 10, and a dependency audit on every push, plus a weekly scheduled sweep.

## Licence

MIT
