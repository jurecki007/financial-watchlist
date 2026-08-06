import type { Candle } from "./types.ts";

/**
 * In-memory cache for *historical* candle pages, separate from the Postgres
 * quote cache. A page of daily bars ending at a fixed past date can never
 * change, so there is no staleness to reason about and no TTL to tune.
 *
 * Best-effort by construction: scroll-driven paging is bursty within a session,
 * which a warm instance absorbs, and a cold one simply re-fetches. Only pages
 * requested with an explicit `before` land here — the leading page holds
 * today's still-moving bar.
 */

const MAX_ENTRIES = 120;

const store = new Map<string, Candle[]>();

export const historyKey = (ticker: string, before: string, size: number) =>
  `${ticker}:${before}:${size}`;

export function readHistory(key: string): Candle[] | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  // Re-insert so eviction is least-recently-used, not least-recently-written.
  store.delete(key);
  store.set(key, hit);
  return hit;
}

export function writeHistory(key: string, candles: Candle[]): void {
  // An empty page means end-of-history, and is worth caching — otherwise it
  // costs a request to re-learn every time someone scrolls to the beginning.
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
