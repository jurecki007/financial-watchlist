import type { Candle } from "./types.ts";

/**
 * In-memory cache for *historical* candle pages.
 *
 * Deliberately not the Postgres cache in `cache.ts`. That one exists because a
 * quote goes stale in sixty seconds and every dashboard render would otherwise
 * re-fetch it. This solves a different problem: a page of daily bars that ends
 * at a fixed past date **can never change**, so there is no staleness to
 * reason about and no TTL to tune — only a question of whether we ask twice.
 *
 * Why not a table: a `candle_cache` migration to store data that is already
 * immutable and re-derivable buys durability we do not need, and pagination is
 * driven by scrolling, which is bursty within one session rather than spread
 * across many. A warm serverless instance absorbs exactly that burst. This is
 * best-effort by construction — a cold instance simply re-fetches, which is
 * correct, just not free.
 *
 * Only ever holds pages requested with an explicit `before`. The most recent
 * page contains today's still-moving bar and is never cached here.
 */

const MAX_ENTRIES = 120;

const store = new Map<string, Candle[]>();

export const historyKey = (ticker: string, before: string, size: number) =>
  `${ticker}:${before}:${size}`;

export function readHistory(key: string): Candle[] | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  // Re-insert so the least recently *used* entry is the one evicted, not the
  // least recently written. A ticker being scrolled through repeatedly should
  // not lose its pages to one that was fetched once and abandoned.
  store.delete(key);
  store.set(key, hit);
  return hit;
}

export function writeHistory(key: string, candles: Candle[]): void {
  // An empty page means end-of-history. Worth caching: it is the answer that
  // otherwise costs a request to re-learn every time someone scrolls to the
  // very beginning.
  store.set(key, candles);
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/** Test seam. Never called in application code. */
export function clearHistory(): void {
  store.clear();
}
