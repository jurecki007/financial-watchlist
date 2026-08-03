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

async function Chart({ ticker }: { ticker: string }) {
  const res = await getCandles(ticker, { days: 180 });
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
    <ul className="space-y-4">
      {res.data.map((a) => (
        <li key={a.id} className="border-t border-[var(--rule)] pt-4">
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[0.95rem] leading-snug transition-colors hover:text-[var(--gold)]"
          >
            {a.headline}
          </a>
          <p className="mt-1.5 font-mono text-[11px] text-[var(--faint)]">
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
  );
}
