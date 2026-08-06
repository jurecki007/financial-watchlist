/**
 * The public market-data interface. Callers import from here and nowhere else,
 * so which vendor answers stays an implementation detail.
 */
import { readCache, throughCache, writeCache } from "./cache.ts";
import { historyKey, readHistory, writeHistory } from "./history-cache.ts";
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
 * Quotes for a whole watchlist in one request. Cached per ticker, so adding one
 * company does not refetch the other eleven.
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

  // The oldest contributing timestamp: "as of 14:32" has to be true of every
  // number on screen, not just the freshest.
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

/**
 * Chart data. Twelve Data owns this — Finnhub gates candles behind a paid plan.
 *
 * `before` pages backwards for load-older-on-scroll. Those pages end at a fixed
 * past date and are immutable, which is why they are cached and the leading
 * page — carrying today's still-moving bar — is not.
 */
export async function getCandles(
  ticker: string,
  opts?: { days?: number; before?: string },
): Promise<Result<Candle[]>> {
  const { days = 180, before } = opts ?? {};

  if (!before) return twelveData.getCandles(ticker, { days });

  const key = historyKey(normalizeTicker(ticker), before, days);
  const cached = readHistory(key);
  if (cached) return ok(cached);

  const res = await twelveData.getCandles(ticker, { days, before });
  if (res.ok) writeHistory(key, res.data);
  return res;
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
