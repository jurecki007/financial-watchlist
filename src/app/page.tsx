/**
 * THESIS: the product demonstrates itself before it describes itself. The
 * market prints across the first viewport and the copy sits inside it — the
 * refusal is the category's centred hero over a flat gradient.
 *
 * OWN-WORLD: near-black ground, one metallic gold, XAU/USD candles drawing
 * themselves in. Mono for every numeral. Green and red appear only on price.
 *
 * STORY: a visitor sees live-feeling market data, understands this tracks
 * companies they choose, and signs up.
 *
 * FIRST VIEWPORT: full-bleed candlestick chart; headline and both CTAs sit
 * left over a scrim; instrument label in mono top-left.
 *
 * FORM: full-bleed chart hero — the direction pinned in CLAUDE.md.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { HeroChart } from "@/components/hero-chart";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import fixture from "@/lib/fixtures/xau-daily.json";
import { landingPageGraph, serialiseJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Financial Watchlist — track the companies you care about",
  description:
    "Prices, charts and the news that moves them, for the companies you actually follow.",
  alternates: { canonical: "/" },
};

const bars = fixture.bars as { close: number }[];
const last = bars[bars.length - 1].close;
const prev = bars[bars.length - 2].close;
const delta = ((last - prev) / prev) * 100;
const up = delta >= 0;

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-t border-[var(--rule)] pt-5">
      <h3 className="text-[0.95rem] font-medium tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">{body}</p>
    </div>
  );
}

export default function Home() {
  return (
    <main>
      {/*
        Server-rendered, not injected on the client. Google's December 2025
        JavaScript SEO guidance notes that structured data added by script is
        subject to delayed processing; this page is static, so there is nothing
        to gain by deferring it and a queue to sit in if we did.

        When CSP lands (Phase 3/6, see next.config.ts) this needs a nonce, as
        does the theme script in layout.tsx.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serialiseJsonLd(landingPageGraph()) }}
      />
      <section className="relative min-h-[92vh] overflow-hidden">
        <HeroChart />

        {/* Scrim. Contrast for the copy is verified against the chart's
            lightest frame, not against the empty ground. */}
        <div className="hero-scrim pointer-events-none absolute inset-0 z-10" />
        <div className="hero-fade pointer-events-none absolute inset-x-0 bottom-0 z-10 h-44" />

        <div className="relative z-20 flex min-h-[92vh] flex-col px-6 py-8 sm:px-10">
          {/* The landing page carries no nav, so the theme control has no
              existing home to sit in. It goes here rather than in the footer:
              the decision to switch is made on sight of the dark hero, and a
              control answering that is no use a full scroll below it.
              `items-center` on the row, not `items-baseline` — the icon aligns
              to the line box, while the numerals keep their shared baseline. */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-baseline gap-3 font-mono text-xs">
              <span className="tracking-[0.18em] text-[var(--dim)] uppercase">
                XAU/USD
              </span>
              <span className="tabular-nums text-[var(--fg)]">
                {last.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
              {/* Direction carries a shape and a sign, so it survives colour
                  being stripped out entirely. */}
              <span
                className={`tabular-nums ${up ? "text-[var(--up)]" : "text-[var(--down)]"}`}
              >
                {up ? "▲" : "▼"} {up ? "+" : ""}
                {delta.toFixed(2)}%
              </span>
            </div>
            <ThemeToggle />
          </div>

          <div className="my-auto max-w-[34rem] py-16">
            <h1 className="rise text-balance text-[clamp(1.9rem,7vw,3.5rem)] leading-[1.08] font-medium tracking-[-0.02em]">
              Every company you follow. One clear view.
            </h1>
            <p className="rise mt-6 max-w-[30rem] text-[clamp(0.95rem,2.5vw,1.05rem)] leading-relaxed text-[var(--dim)]">
              Prices, charts and the news that moves them — for the companies
              you actually care about, not the whole market.
            </p>

            <div className="rise mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="flex h-11 items-center bg-[var(--gold)] px-6 text-sm font-medium tracking-tight text-[var(--ground)] transition-opacity hover:opacity-90"
              >
                Start tracking
              </Link>
              <Link
                href="/login"
                className="flex h-11 items-center border border-[var(--rule-strong)] px-6 text-sm text-[var(--fg)] transition-colors hover:border-[var(--faint)] hover:bg-[var(--raised)]"
              >
                Sign in
              </Link>
            </div>
          </div>

          <p className="max-w-full font-mono text-[11px] break-words text-[var(--faint)] sm:text-xs">
            Gold, daily — {fixture.bars.length} sessions to{" "}
            {fixture.captured}. Static sample.
          </p>
        </div>
      </section>

      <section className="px-6 py-24 sm:px-10">
        <div className="mx-auto max-w-[62rem]">
          <h2 className="max-w-[30rem] text-2xl leading-tight font-medium tracking-tight">
            Built to be read, not just clicked through.
          </h2>
          <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-3">
            <Feature
              title="A watchlist that is yours"
              body="Search any listed company, add it, and it stays. Row-level security means your list is yours at the database, not just in the interface."
            />
            <Feature
              title="Charts from the real thing"
              body="TradingView's charting library against live quotes, cached server-side so the free data tier is never the reason a page fails."
            />
            <Feature
              title="Alerts that reach you"
              body="Set a threshold and get an email when it crosses. Evaluated on a schedule, not while you happen to be watching."
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--rule)] px-6 py-10 sm:px-10">
        <div className="mx-auto flex max-w-[62rem] flex-wrap items-center justify-between gap-4 text-sm text-[var(--dim)]">
          <p>
            Next.js, Supabase, Twelve Data and Finnhub, TradingView charts.
          </p>
          <div className="flex gap-6">
            <Link href="/roadmap" className="transition-colors hover:text-[var(--gold)]">
              Roadmap
            </Link>
            <a
              href="https://github.com/jurecki007/financial-watchlist"
              className="transition-colors hover:text-[var(--gold)]"
            >
              Source
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
