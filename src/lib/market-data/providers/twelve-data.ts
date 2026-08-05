import { getJson, missingKey, twelveDataError } from "../http.ts";
import {
  fail,
  ok,
  normalizeTicker,
  type Candle,
  type Quote,
  type Result,
  type SymbolMatch,
} from "../types.ts";

/**
 * Twelve Data — quotes, historical OHLC, symbol search.
 *
 * Free tier: 800 credits/day, 8 per minute. The per-minute ceiling is the
 * binding constraint and it shapes the whole interface: a twelve-ticker
 * dashboard fetching one quote per card exceeds it on a single page load.
 * Hence `getQuotes` takes an array and issues one request.
 */

const BASE = "https://api.twelvedata.com";

const key = () => process.env.TWELVE_DATA_API_KEY ?? "";

type RawQuote = {
  symbol?: string;
  name?: string;
  close?: string;
  change?: string;
  percent_change?: string;
  currency?: string;
  high?: string;
  low?: string;
  is_market_open?: boolean;
  fifty_two_week?: { low?: string; high?: string };
  status?: string;
  code?: number;
};

const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

function toQuote(raw: RawQuote): Quote | null {
  const price = Number(raw.close);
  if (!raw.symbol || !Number.isFinite(price)) return null;
  return {
    ticker: normalizeTicker(raw.symbol),
    name: raw.name,
    price,
    change: Number(raw.change) || 0,
    changePercent: Number(raw.percent_change) || 0,
    currency: raw.currency,
    // All of these ship in the same response. Reading them costs no extra
    // request, and they are what let a card say more than "the price".
    dayLow: num(raw.low),
    dayHigh: num(raw.high),
    yearLow: num(raw.fifty_two_week?.low),
    yearHigh: num(raw.fifty_two_week?.high),
    marketOpen: raw.is_market_open,
  };
}

/**
 * One request for many symbols. Twelve Data returns a bare object for a single
 * symbol and a keyed map for several, so both shapes are handled rather than
 * assuming the array form.
 */
export async function getQuotes(
  tickers: string[],
): Promise<Result<Record<string, Quote>>> {
  const symbols = [...new Set(tickers.map(normalizeTicker))].filter(Boolean);
  if (symbols.length === 0) return ok({});

  const absent = missingKey("TWELVE_DATA_API_KEY", key());
  if (absent) return absent;

  const url = `${BASE}/quote?symbol=${encodeURIComponent(symbols.join(","))}&apikey=${key()}`;
  const res = await getJson<Record<string, RawQuote> | RawQuote>(url, {
    label: "twelvedata/quote",
  });
  if (!res.ok) return res;

  const err = twelveDataError(res.body);
  if (err) return fail(err);

  const out: Record<string, Quote> = {};
  const body = res.body as Record<string, RawQuote> | RawQuote;

  if (symbols.length === 1) {
    const q = toQuote(body as RawQuote);
    if (q) out[q.ticker] = q;
  } else {
    for (const [symbol, raw] of Object.entries(body as Record<string, RawQuote>)) {
      // A single bad symbol in a batch comes back as a per-key error object.
      // Skip it rather than failing the other eleven cards.
      if (raw?.status === "error") continue;
      const q = toQuote(raw);
      if (q) out[normalizeTicker(symbol)] = q;
    }
  }

  return ok(out);
}

type RawSeries = {
  values?: { datetime: string; open: string; high: string; low: string; close: string }[];
};

export async function getCandles(
  ticker: string,
  { days = 180, before }: { days?: number; before?: string } = {},
): Promise<Result<Candle[]>> {
  const absent = missingKey("TWELVE_DATA_API_KEY", key());
  if (absent) return absent;

  // `end_date` pages backwards, and it is EXCLUSIVE: asking for bars before
  // 2023-08-09 returns 2023-08-08 and earlier, so consecutive pages abut
  // without overlapping. Verified against the live API rather than assumed —
  // an off-by-one here hands lightweight-charts a duplicate timestamp, which
  // it renders wrong rather than rejecting.
  //
  // Depth costs nothing extra: the response carries `api-credits-request: 1`
  // whether it returns 180 bars or 5000, so paging is billed per request. The
  // binding constraint is the 8/min request ceiling, not the data volume.
  const window = before ? `&end_date=${encodeURIComponent(before)}` : "";

  const url = `${BASE}/time_series?symbol=${encodeURIComponent(
    normalizeTicker(ticker),
  )}&interval=1day&outputsize=${days}${window}&apikey=${key()}`;

  const res = await getJson<RawSeries>(url, { label: "twelvedata/time_series" });
  if (!res.ok) return res;

  const err = twelveDataError(res.body);
  if (err) return fail(err);

  const values = res.body.values ?? [];
  if (values.length === 0) return fail("not_found");

  // Twelve Data returns newest-first; charting libraries require ascending
  // time and will render silently wrong rather than erroring if given the
  // reverse, so the sort is not optional.
  const candles = values
    .map((v) => ({
      time: v.datetime,
      open: Number(v.open),
      high: Number(v.high),
      low: Number(v.low),
      close: Number(v.close),
    }))
    .filter((c) => Number.isFinite(c.close))
    .sort((a, b) => a.time.localeCompare(b.time));

  return ok(candles);
}

type RawSearch = {
  data?: {
    symbol: string;
    instrument_name: string;
    exchange?: string;
    country?: string;
  }[];
};

export async function searchSymbols(
  query: string,
): Promise<Result<SymbolMatch[]>> {
  const q = query.trim();
  if (q.length === 0) return ok([]);

  const url = `${BASE}/symbol_search?symbol=${encodeURIComponent(q)}&outputsize=12`;
  const res = await getJson<RawSearch>(url, { label: "twelvedata/symbol_search" });
  if (!res.ok) return res;

  const err = twelveDataError(res.body);
  if (err) return fail(err);

  return ok(
    (res.body.data ?? []).map((d) => ({
      ticker: normalizeTicker(d.symbol),
      name: d.instrument_name,
      exchange: d.exchange,
      country: d.country,
    })),
  );
}
