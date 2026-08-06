/**
 * The market-data contract. Callers never learn which vendor answered.
 *
 * Nothing here throws: on a free tier, being rate-limited is an operating
 * condition rather than an exception, and one thrown through a server component
 * takes out the route. Failures are values, so callers must handle them.
 */

export type FailureReason =
  /** 429, or the daily credit budget is spent. Recovers on its own. */
  | "rate_limited"
  /** 5xx, timeout, network failure. The provider, not us. */
  | "unavailable"
  /** 403 — the endpoint exists but the free plan does not include it. */
  | "not_entitled"
  /**
   * 401, or no key at all — our fault, not the plan's. Kept separate from
   * `not_entitled`, which would otherwise render a missing env var as a
   * deliberate paid-plan limit.
   */
  | "misconfigured"
  /** The symbol does not exist. A user error, not a system one. */
  | "not_found";

export type Failure = {
  ok: false;
  reason: FailureReason;
  /** Whether retrying the same call could plausibly succeed. */
  retryable: boolean;
};

export type Success<T> = {
  ok: true;
  data: T;
  /** Set when the value came from cache, so the UI can say "as of 14:32". */
  asOf?: string;
  /** True when a refresh failed and this is the last good value. */
  stale?: boolean;
};

export type Result<T> = Success<T> | Failure;

export const fail = (reason: FailureReason): Failure => ({
  ok: false,
  reason,
  // None of these can succeed on a retry, so retrying is wasted budget.
  retryable: reason === "rate_limited" || reason === "unavailable",
});

export const ok = <T>(data: T, extra?: Omit<Success<T>, "ok" | "data">): Success<T> => ({
  ok: true,
  data,
  ...extra,
});

/**
 * User-facing copy per failure. Central so every surface agrees, and so no raw
 * provider message can reach a browser — the mapping is total.
 */
export const FAILURE_COPY: Record<FailureReason, { title: string; body: string }> = {
  rate_limited: {
    title: "Refreshing shortly",
    body: "We're fetching data faster than our market feed allows. Prices will update in a moment.",
  },
  unavailable: {
    title: "Market data unavailable",
    body: "Our market data provider isn't responding right now.",
  },
  not_entitled: {
    title: "Not included in this demo",
    body: "This data sits behind a paid plan and isn't part of the demo.",
  },
  // Names our fault as ours, without naming the variable — that belongs in the
  // server log, not the browser.
  misconfigured: {
    title: "Market data isn't configured",
    body: "This deployment is missing its market-data credentials, so prices and charts can't load.",
  },
  not_found: {
    title: "Symbol not found",
    body: "We couldn't find a listing for that symbol.",
  },
};

export type Quote = {
  ticker: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  currency?: string;
  /** Session range. Already in every quote response — costs nothing extra. */
  dayLow?: number;
  dayHigh?: number;
  /** 52-week range. The context that turns a price into a judgement. */
  yearLow?: number;
  yearHigh?: number;
  /** A flat price reads as a bug unless the market is known to be shut. */
  marketOpen?: boolean;
};

/**
 * Where a price sits in a range, 0–1. Undefined rather than 0 when the range is
 * absent — a marker at the left edge would read as "at its low", which is a
 * claim rather than a gap.
 */
export function positionInRange(
  price: number,
  low?: number,
  high?: number,
): number | undefined {
  if (low === undefined || high === undefined) return undefined;
  if (!(high > low)) return undefined;
  return Math.min(1, Math.max(0, (price - low) / (high - low)));
}

export type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type SymbolMatch = {
  ticker: string;
  name: string;
  exchange?: string;
  country?: string;
};

export type Fundamentals = {
  ticker: string;
  marketCap?: number;
  peRatio?: number;
  weekHigh52?: number;
  weekLow52?: number;
};

export type Article = {
  id: string;
  headline: string;
  summary?: string;
  source?: string;
  url: string;
  publishedAt: string;
};

/** Tickers are stored and compared upper-case; the DB enforces it too. */
export const normalizeTicker = (raw: string): string =>
  raw.trim().toUpperCase();
