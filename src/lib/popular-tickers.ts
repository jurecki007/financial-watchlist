/**
 * Starting suggestions for an empty search field.
 *
 * A curated constant rather than a query or a provider call. It costs nothing
 * from the 800-call daily budget, cannot fail, and renders instantly — and an
 * empty dropdown on focus is a worse first impression than a short honest one.
 *
 * Labelled "Popular" in the UI and nothing stronger. These are large, widely
 * held US listings, not a ranking of market activity, and the copy should
 * never imply otherwise. Swapping in a real most-added query later means
 * changing this module and nothing else.
 */
export type PopularTicker = { ticker: string; name: string };

export const POPULAR_TICKERS: PopularTicker[] = [
  { ticker: "AAPL", name: "Apple Inc" },
  { ticker: "MSFT", name: "Microsoft Corporation" },
  { ticker: "NVDA", name: "NVIDIA Corporation" },
  { ticker: "AMZN", name: "Amazon.com Inc" },
  { ticker: "GOOGL", name: "Alphabet Inc" },
  { ticker: "META", name: "Meta Platforms Inc" },
  { ticker: "TSLA", name: "Tesla Inc" },
  { ticker: "JPM", name: "JPMorgan Chase & Co" },
];

/**
 * Suggestions worth showing: anything already on the watchlist is noise, and
 * offering to add a duplicate makes the feature look broken when the insert
 * silently no-ops on the unique constraint.
 */
export function suggestionsFor(watched: string[]): PopularTicker[] {
  const have = new Set(watched.map((t) => t.toUpperCase()));
  return POPULAR_TICKERS.filter((p) => !have.has(p.ticker));
}
