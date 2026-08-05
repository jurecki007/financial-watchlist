import { Suspense } from "react";
import Link from "next/link";
import {
  getCandles,
  getFundamentals,
  getNews,
  getQuote,
  normalizeTicker,
  FAILURE_COPY,
} from "@/lib/market-data";
import { PriceChart } from "@/components/company/price-chart";
import { AsOf, ErrorState, Skeleton, NumberSkeleton } from "@/components/ui/states";
import { AlertPanel, type AlertRow } from "@/components/company/alert-panel";
import { Nav } from "@/components/nav";
import { SentimentTag } from "@/components/news/sentiment-tag";
import { Footer } from "@/components/ui/footer";
import { createClient } from "@/lib/supabase/server";

/**
 * Company detail.
 *
 * Four independent data sources, four Suspense boundaries. Fundamentals coming
 * from a different vendor than the chart means one of them being rate-limited
 * must not blank the other — which is the whole reason the page is composed
 * this way rather than awaiting everything up front.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  return { title: `${normalizeTicker(ticker)} — Financial Watchlist` };
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 font-mono text-xs tracking-[0.18em] text-[var(--dim)] uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Reusable failure rendering so all four surfaces speak with one voice. */
function Failure({ reason }: { reason: keyof typeof FAILURE_COPY }) {
  const copy = FAILURE_COPY[reason];
  return <ErrorState title={copy.title} body={copy.body} />;
}

async function Price({ ticker }: { ticker: string }) {
  const res = await getQuote(ticker);
  if (!res.ok) return <Failure reason={res.reason} />;
  const q = res.data;
  const up = q.changePercent >= 0;
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <span className="font-mono text-[2rem] leading-none tabular-nums">
        {q.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </span>
      <span
        className={`font-mono text-sm tabular-nums ${up ? "text-[var(--up)]" : "text-[var(--down)]"}`}
      >
        {up ? "▲" : "▼"} {up ? "+" : ""}
        {q.changePercent.toFixed(2)}%
      </span>
      <AsOf time={res.asOf} stale={res.stale} />
    </div>
  );
}

/**
 * 750 bars — about three years of sessions, against the 180 (roughly eight
 * months) this used to ship.
 *
 * The number is a payload decision, not an API one. Depth is billed per
 * request, so 750 bars and 180 cost the same single credit; what 750 costs is
 * ~62kB of JSON in the RSC payload against ~15kB. The provider would serve
 * 5000 for that same credit, but at ~400kB it would dominate the page.
 *
 * Anything earlier is paged in by the chart on scroll, so this is the point at
 * which the first pan stops being the common case — not a ceiling on history.
 */
const LEADING_PAGE = 750;

async function Chart({ ticker }: { ticker: string }) {
  const res = await getCandles(ticker, { days: LEADING_PAGE });
  if (!res.ok) return <Failure reason={res.reason} />;
  return <PriceChart candles={res.data} ticker={ticker} />;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-[var(--rule)] pt-3">
      <dt className="text-xs text-[var(--dim)]">{label}</dt>
      <dd className="mt-1 font-mono text-sm tabular-nums">{value}</dd>
    </div>
  );
}

const money = (n?: number) => {
  if (n === undefined) return "—";
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return n.toFixed(0);
};

async function Stats({ ticker }: { ticker: string }) {
  const res = await getFundamentals(ticker);
  if (!res.ok) return <Failure reason={res.reason} />;
  const f = res.data;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
      <Stat label="Market cap" value={money(f.marketCap)} />
      <Stat label="P/E (TTM)" value={f.peRatio?.toFixed(1) ?? "—"} />
      <Stat label="52-week high" value={f.weekHigh52?.toFixed(2) ?? "—"} />
      <Stat label="52-week low" value={f.weekLow52?.toFixed(2) ?? "—"} />
    </dl>
  );
}

async function Alerts({ ticker }: { ticker: string }) {
  const supabase = await createClient();
  // No user_id filter — RLS scopes this to the signed-in user.
  const { data } = await supabase
    .from("price_alerts")
    .select("id, condition, threshold, triggered_at, active")
    .eq("ticker", ticker)
    .order("created_at", { ascending: false });

  const quote = await getQuote(ticker);
  return (
    <AlertPanel
      ticker={ticker}
      alerts={(data ?? []) as AlertRow[]}
      currentPrice={quote.ok ? quote.data.price : undefined}
    />
  );
}

async function News({ ticker }: { ticker: string }) {
  const res = await getNews(ticker);
  if (!res.ok) return <Failure reason={res.reason} />;

  // An empty list is a legitimate answer, not a failure — plenty of companies
  // have no coverage in a two-week window. That is an empty state.
  if (res.data.length === 0) {
    return (
      <p className="text-sm text-[var(--dim)]">
        No coverage for {ticker} in the last two weeks.
      </p>
    );
  }

  return (
    // Spacing alone could not carry the separation here. A wrapped headline
    // sets its own lines 26px apart, and the gap between articles was 28px —
    // 1.08x, which the eye cannot read as a boundary, so eight articles merged
    // into one block. The separator is what distinguishes them; the space
    // around it is what keeps it from feeling like a table.
    <ul className="space-y-5">
      {res.data.map((a, i) => (
        <li key={a.id}>
          {/* Inset by 40px on both sides, deliberately NOT full-bleed. A rule
              spanning the panel already means "section divider" in this layout
              — Key statistics above uses exactly that — so an item separator
              has to be a visibly different mark rather than the same one at a
              different frequency. The inset is what distinguishes them.

              Measured against the panel, not the headline column. It reads as
              the same mark as the separators between alert rows — which do run
              the full content width — pulled in at both ends, so the two are
              recognisably one family rather than two unrelated rules. Tying it
              to the 58ch measure instead made it a third, shorter thing.

              No max-width: a block element already fills its parent, so the
              margins alone set the length and it insets identically at every
              width. Never before the first article — a rule under the heading
              would read as the heading's own underline. */}
          {i > 0 && (
            <div
              aria-hidden
              className="mx-10 mb-5 border-t border-[var(--rule-strong)]"
            />
          )}
          {/* Measure cap. The panel is 992px wide, which ran long headlines to
              ~127 characters a line — well past the 45–75 that stays readable.
              It sits on a wrapper rather than the anchor so the sentiment tag
              still flows inline after the last word.
              58 and not 75: `ch` is the width of "0", which in Geist is
              narrower than the average lowercase letter, so the unit
              undercounts real characters by about a third. 58ch measures ~75
              actual characters — the ceiling, not the number in the class. */}
          <div className="max-w-[58ch]">
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              // Was 0.95rem/leading-snug: under the 1rem body floor and tighter
              // than default, when light-on-dark wants the opposite — a little
              // more leading, not less.
              className="text-base leading-relaxed transition-colors hover:text-[var(--gold)]"
            >
              {a.headline}
            </a>
            <SentimentTag headline={a.headline} />
          </div>
          {/* --faint at 11px measured 3.9:1 against the ground: the smallest
              text on the page at the lowest contrast, and under the 4.5:1 floor
              for anything this size. --dim clears it. */}
          <p className="mt-2 font-mono text-xs text-[var(--dim)]">
            {a.source} · {new Date(a.publishedAt).toLocaleDateString("en-GB")}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: raw } = await params;
  const ticker = normalizeTicker(decodeURIComponent(raw));

  return (
    <>
      <Nav />
      <main className="min-h-screen px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-[62rem] space-y-12">
        <header>
          <Link
            href="/dashboard"
            className="font-mono text-xs text-[var(--dim)] transition-colors hover:text-[var(--gold)]"
          >
            ← Watchlist
          </Link>
          <h1 className="mt-5 font-mono text-2xl tracking-wide">{ticker}</h1>
          <div className="mt-4">
            <Suspense
              fallback={
                <div className="flex items-baseline gap-4">
                  <NumberSkeleton digits={8} className="h-[2rem]" />
                  <NumberSkeleton digits={7} />
                </div>
              }
            >
              <Price ticker={ticker} />
            </Suspense>
          </div>
        </header>

        <Suspense
          fallback={<Skeleton className="h-[24rem] w-full" />}
        >
          <Chart ticker={ticker} />
        </Suspense>

        <Panel title="Key statistics">
          <Suspense
            fallback={
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="border-t border-[var(--rule)] pt-3">
                    <Skeleton className="h-3 w-20" />
                    <div className="mt-2">
                      <NumberSkeleton digits={6} />
                    </div>
                  </div>
                ))}
              </div>
            }
          >
            <Stats ticker={ticker} />
          </Suspense>
        </Panel>

        <Panel title="Price alerts">
          <Suspense fallback={<Skeleton className="h-28 w-full" />}>
            <Alerts ticker={ticker} />
          </Suspense>
        </Panel>

        <Panel title="Recent coverage">
          <Suspense
            fallback={
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="border-t border-[var(--rule)] pt-4">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="mt-2 h-3 w-32" />
                  </div>
                ))}
              </div>
            }
          >
            <News ticker={ticker} />
          </Suspense>
        </Panel>
      </div>
      </main>
      <Footer />
    </>
  );
}
