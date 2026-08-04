import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getQuotes, FAILURE_COPY, type Quote } from "@/lib/market-data";
import { QuoteCardSkeleton } from "@/components/watchlist/quote-card";
import { WatchlistProvider } from "@/components/watchlist/optimistic";
import { WatchlistGrid } from "@/components/watchlist/grid";
import { WatchlistCount } from "@/components/watchlist/count";
import { ErrorState } from "@/components/ui/states";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/ui/footer";
import { Container } from "@/components/ui/shell";
import { AsOf } from "@/components/ui/states";
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
        {/* The companies are still known even when prices are not, so the grid
            keeps its shape rather than collapsing to an error and nothing. */}
        <div className="mt-3">
          <WatchlistGrid quotes={{}} />
        </div>
      </>
    );
  }

  const quotes: Record<string, Quote> = result.data;

  return (
    <>
      {/* Stated once. The same timestamp repeated on every card was five
          copies of one fact competing with the prices they sat under. */}
      {result.asOf && (
        <p className="mb-3">
          <AsOf time={result.asOf} stale={result.stale} />
        </p>
      )}
      <WatchlistGrid quotes={quotes} />
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
      <main className="min-h-screen py-10">
      <Container>
        <WatchlistProvider items={rows}>
        <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">
              Your watchlist
            </h1>
            <WatchlistCount />
          </div>
          {/* Adding is the primary action on this page, so it sits on the
              header line rather than below it as a secondary form. */}
          <div className="w-full max-w-[22rem]">
            <AddTicker watched={rows.map((r) => r.ticker)} />
          </div>
        </header>

        <div className="mt-9">
          {/* The empty state now lives inside the grid, because membership is
              optimistic: adding the first company must replace it immediately
              rather than after the server confirms. */}
          <Suspense
            fallback={
              rows.length === 0 ? null : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((r) => (
                    <QuoteCardSkeleton key={r.id} ticker={r.ticker} />
                  ))}
                </div>
              )
            }
          >
            <Prices rows={rows} />
          </Suspense>
        </div>
        </WatchlistProvider>

      </Container>
      </main>
      <Footer />
    </>
  );
}
