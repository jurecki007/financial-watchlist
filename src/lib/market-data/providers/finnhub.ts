import { getJson } from "../http.ts";
import {
  fail,
  ok,
  normalizeTicker,
  type Article,
  type Fundamentals,
  type Result,
} from "../types.ts";

/**
 * Finnhub — company news and fundamentals.
 *
 * Here because Twelve Data's free tier covers neither. Finnhub's own free tier
 * excludes historical candles (403), which is why Twelve Data keeps the chart:
 * the two plans are complementary, and between them nothing the product needs
 * sits behind a paywall.
 *
 * 60 calls/minute, US markets only.
 */

const BASE = "https://finnhub.io/api/v1";

const key = () => process.env.FINNHUB_API_KEY ?? "";

type RawMetric = {
  metric?: Record<string, number | string | null>;
};

export async function getFundamentals(
  ticker: string,
): Promise<Result<Fundamentals>> {
  const symbol = normalizeTicker(ticker);
  const url = `${BASE}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${key()}`;

  const res = await getJson<RawMetric>(url, { label: "finnhub/metric" });
  if (!res.ok) return res;

  const m = res.body.metric;
  // Finnhub answers 200 with an empty object for an unknown symbol rather than
  // 404, so emptiness is the not-found signal.
  if (!m || Object.keys(m).length === 0) return fail("not_found");

  const num = (v: unknown): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  return ok({
    ticker: symbol,
    // Reported in millions.
    marketCap: num(m.marketCapitalization) && num(m.marketCapitalization)! * 1e6,
    peRatio: num(m.peTTM),
    weekHigh52: num(m["52WeekHigh"]),
    weekLow52: num(m["52WeekLow"]),
  });
}

type RawArticle = {
  id?: number;
  headline?: string;
  summary?: string;
  source?: string;
  url?: string;
  datetime?: number;
};

export async function getNews(
  ticker: string,
  { days = 14, limit = 8 }: { days?: number; limit?: number } = {},
): Promise<Result<Article[]>> {
  const symbol = normalizeTicker(ticker);
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const url = `${BASE}/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(
    from,
  )}&to=${fmt(to)}&token=${key()}`;

  const res = await getJson<RawArticle[]>(url, { label: "finnhub/company-news" });
  if (!res.ok) return res;

  if (!Array.isArray(res.body)) return fail("unavailable");

  const articles = res.body
    .filter((a) => a.headline && a.url && a.datetime)
    .slice(0, limit)
    .map((a) => ({
      id: String(a.id ?? a.url),
      headline: a.headline!,
      summary: a.summary || undefined,
      source: a.source || undefined,
      url: a.url!,
      publishedAt: new Date(a.datetime! * 1000).toISOString(),
    }));

  // An empty news list is a legitimate answer, not a failure — plenty of
  // companies have no coverage in a two-week window. The UI shows an empty
  // state, which is a different thing from an error state.
  return ok(articles);
}
