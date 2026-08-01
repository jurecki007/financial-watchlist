/**
 * The public market-data interface.
 *
 * Callers import from here and nowhere else. Which vendor answers a given
 * question is an implementation detail that has already changed once during
 * this build and will change again — the point of the seam is that changing it
 * touches this directory only.
 */
import { readCache, throughCache, writeCache } from "./cache.ts";
import * as twelveData from "./providers/twelve-data.ts";
import * as finnhub from "./providers/finnhub.ts";
import {
  normalizeTicker,
  ok,
  type Article,
  type Candle,
  type Fundamentals,
  type Quote,
  type Result,
  type SymbolMatch,
} from "./types.ts";

export * from "./types.ts";

/**
 * Quotes for a whole watchlist in one provider request.
 *
 * Cached per ticker so a dashboard that adds one company does not refetch the
 * other eleven. Only the tickers that are actually stale reach the network.
 */
export async function getQuotes(
  tickers: string[],
): Promise<Result<Record<string, Quote>>> {
  const symbols = [...new Set(tickers.map(normalizeTicker))].filter(Boolean);
  if (symbols.length === 0) return ok({});

  const cached = await Promise.all(
    symbols.map(async (t) => [t, await readCache<Quote>("quote", t)] as const),
  );

  const out: Record<string, Quote> = {};
  const stale: string[] = [];
  const servedFrom: string[] = [];

  for (const [ticker, row] of cached) {
    if (row?.fresh) {
      out[ticker] = row.value;
      servedFrom.push(row.fetchedAt);
    } else {
      stale.push(ticker);
    }
  }

  // The OLDEST contributing timestamp, not the newest. "As of 14:32" has to be
  // true of every number on screen; reporting the freshest row would overstate
  // how current the stalest card is.
  const oldest = (times: string[]) =>
    times.length ? times.slice().sort()[0] : undefined;

  if (stale.length === 0) return ok(out, { asOf: oldest(servedFrom) });

  const fresh = await twelveData.getQuotes(stale);

  if (fresh.ok) {
    await Promise.all(
      Object.entries(fresh.data).map(([t, q]) => writeCache("quote", t, q)),
    );
    Object.assign(out, fresh.data);
    // Mixed response: some cards came from cache, some were just fetched. The
    // oldest cached timestamp still governs what we may claim.
    return ok(out, { asOf: oldest(servedFrom) });
  }

  // Refresh failed. Serve whatever stale rows exist rather than blanking the
  // dashboard — a four-minute-old price beats an error card.
  let servedStale = false;
  for (const ticker of stale) {
    const row = await readCache<Quote>("quote", ticker);
    if (row) {
      out[ticker] = row.value;
      servedFrom.push(row.fetchedAt);
      servedStale = true;
    }
  }

  if (Object.keys(out).length === 0) return fresh;
  return ok(out, { asOf: oldest(servedFrom), stale: servedStale || undefined });
}

export async function getQuote(ticker: string): Promise<Result<Quote>> {
  const res = await getQuotes([ticker]);
  if (!res.ok) return res;
  const q = res.data[normalizeTicker(ticker)];
  if (!q) return { ok: false, reason: "not_found", retryable: false };
  return ok(q, { asOf: res.asOf, stale: res.stale });
}

/** Chart data. Twelve Data owns this — Finnhub gates candles behind a paid plan. */
export function getCandles(
  ticker: string,
  opts?: { days?: number },
): Promise<Result<Candle[]>> {
  return twelveData.getCandles(ticker, opts);
}

/** Autocomplete. Not cached: queries are unbounded and rarely repeat. */
export function searchSymbols(query: string): Promise<Result<SymbolMatch[]>> {
  return twelveData.searchSymbols(query);
}

/** Fundamentals. Finnhub owns this — Twelve Data gates it behind a paid plan. */
export function getFundamentals(ticker: string): Promise<Result<Fundamentals>> {
  return finnhub.getFundamentals(ticker);
}

/** Headlines, cached hard — news does not turn over minute to minute. */
export function getNews(ticker: string): Promise<Result<Article[]>> {
  return throughCache("news", ticker, () => finnhub.getNews(ticker));
}
