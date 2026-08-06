/**
 * Starting suggestions for an empty search field. A constant, not a query:
 * it costs nothing from the daily provider budget and cannot fail.
 *
 * Labelled "Popular" and nothing stronger — these are large US listings, not a
 * ranking of activity.
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

/** Anything already watched is noise — adding it would no-op on the unique constraint. */
export function suggestionsFor(watched: string[]): PopularTicker[] {
  const have = new Set(watched.map((t) => t.toUpperCase()));
  return POPULAR_TICKERS.filter((p) => !have.has(p.ticker));
}
