/**
 * The market-data contract. Callers never learn which vendor answered.
 *
 * Nothing in this layer throws. A provider being rate-limited or down is an
 * expected operating condition on a free tier, not an exception — and an
 * exception thrown through a server component takes out the whole route.
 * Failures are values, so every caller is forced by the type system to decide
 * what to render when data is absent.
 */

export type FailureReason =
  /** 429, or the daily credit budget is spent. Recovers on its own. */
  | "rate_limited"
  /** 5xx, timeout, network failure. The provider, not us. */
  | "unavailable"
  /** 403 — the endpoint exists but the free plan does not include it. */
  | "not_entitled"
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
  /**
   * When the data was fetched from the provider. Present whenever the value
   * came from cache so the UI can say "as of 14:32" rather than implying it is
   * live. Absent means it was just fetched.
   */
  asOf?: string;
  /** True when a refresh failed and this is the last good value. */
  stale?: boolean;
};

export type Result<T> = Success<T> | Failure;

export const fail = (reason: FailureReason): Failure => ({
  ok: false,
  reason,
  // not_entitled will never succeed on this plan, and not_found will never
  // succeed for this symbol. Retrying either is wasted budget.
  retryable: reason === "rate_limited" || reason === "unavailable",
});

export const ok = <T>(data: T, extra?: Omit<Success<T>, "ok" | "data">): Success<T> => ({
  ok: true,
  data,
  ...extra,
});

/**
 * User-facing copy per failure. Lives here rather than in components so every
 * surface says the same thing, and so no raw provider message can reach a
 * browser: the mapping is total, and the vendor's own text is never an input.
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
};

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
