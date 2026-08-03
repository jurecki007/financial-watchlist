import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getQuotes, FAILURE_COPY, type Quote } from "@/lib/market-data";
import { QuoteCard, QuoteCardSkeleton } from "@/components/watchlist/quote-card";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Nav } from "@/components/nav";
import { AddTicker } from "@/components/watchlist/add-ticker";

export const metadata = { title: "Dashboard — Financial Watchlist" };

type Row = { id: string; ticker: string; company_name: string | null };

/**
 * Prices, in their own Suspense boundary.
 *
 * The shell — heading, the add control, and the ticker of every row — renders
 * immediately from the database. Only prices wait on the market provider, so a
 * slow or rate-limited feed delays the numbers rather than the page. The
 * skeletons can already name which companies are loading, because the tickers
 * come from Postgres and not from the quote call.
 */
async function Prices({ rows }: { rows: Row[] }) {
  const result = await getQuotes(rows.map((r) => r.ticker));

  if (!result.ok) {
    const copy = FAILURE_COPY[result.reason];
    return (
      <>
        <div className="sm:col-span-2 lg:col-span-3">
          <ErrorState
            title={copy.title}
            body={copy.body}
            retry={
              result.retryable ? (
                <Link
                  href="/dashboard"
                  className="inline-flex h-8 items-center border border-[var(--rule-strong)] px-3 text-xs transition-colors hover:border-[var(--faint)]"
                >
                  Try again
                </Link>
              ) : undefined
            }
          />
        </div>
        {/* The companies are still known even when prices are not, so the grid
            keeps its shape rather than collapsing to an error and nothing. */}
        {rows.map((r) => (
          <QuoteCard key={r.id} ticker={r.ticker} companyName={r.company_name} />
        ))}
      </>
    );
  }

  const quotes: Record<string, Quote> = result.data;

  return (
    <>
      {rows.map((r) => (
        <QuoteCard
          key={r.id}
          ticker={r.ticker}
          companyName={r.company_name}
          quote={quotes[r.ticker]}
          asOf={result.asOf}
          stale={result.stale}
        />
      ))}
    </>
  );
}

export default async function DashboardPage() {
  // Identity now lives in the nav; this page only needs the data.
  const supabase = await createClient();

  // No user_id filter: RLS returns only this user's rows. tests/rls.test.ts
  // proves that rather than this code assuming it.
  const { data } = await supabase
    .from("watchlist_items")
    .select("id, ticker, company_name")
    .order("added_at", { ascending: false });

  const rows = (data ?? []) as Row[];

  return (
    <>
      <Nav />
      <main className="min-h-screen px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-[62rem]">
        <header>
          <p className="font-mono text-xs tracking-[0.18em] text-[var(--dim)] uppercase">
            Watchlist
          </p>
          <h1 className="mt-3 text-2xl font-medium tracking-tight">
            {rows.length
              ? `${rows.length} ${rows.length === 1 ? "company" : "companies"}`
              : "Your watchlist"}
          </h1>
        </header>

        <div className="mt-8 max-w-[26rem]">
          <AddTicker />
        </div>

        <div className="mt-10">
          {rows.length === 0 ? (
            <EmptyState
              title="Nothing tracked yet"
              body="Search for a company above and add it. Prices, charts and news appear here once you do."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Suspense
                fallback={rows.map((r) => (
                  <QuoteCardSkeleton key={r.id} ticker={r.ticker} />
                ))}
              >
                <Prices rows={rows} />
              </Suspense>
            </div>
          )}
        </div>

      </div>
      </main>
    </>
  );
}
