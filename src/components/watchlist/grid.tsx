"use client";

import { QuoteCard } from "@/components/watchlist/quote-card";
import { EmptyState } from "@/components/ui/states";
import { useWatchlist } from "@/components/watchlist/optimistic";
import type { Quote } from "@/lib/market-data";

/**
 * The card grid, rendered from optimistic state.
 *
 * Quotes still come from the server; only membership is optimistic. A card
 * added a moment ago has no price yet and says so, rather than inventing a
 * number — guessing a price in a product about prices is the one lie this UI
 * must never tell.
 */
export function WatchlistGrid({
  quotes,
}: {
  quotes: Record<string, Quote>;
}) {
  const { items } = useWatchlist();

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing tracked yet"
        body="Search for a company above and add it. Prices, charts and news appear here once you do."
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <QuoteCard
          key={item.id}
          ticker={item.ticker}
          companyName={item.company_name}
          quote={quotes[item.ticker]}
          pending={item.pending}
        />
      ))}
    </div>
  );
}
