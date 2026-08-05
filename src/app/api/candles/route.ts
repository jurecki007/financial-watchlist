import { NextResponse, type NextRequest } from "next/server";
import { getCandles, normalizeTicker } from "@/lib/market-data";
import { getUser } from "@/lib/supabase/server";

/**
 * Older candles, for the company chart's load-on-scroll.
 *
 * Authenticated for the same reason as /api/quotes: an open proxy to a metered
 * API is somebody else's free tier. This one is worth guarding harder, because
 * it is driven by scrolling — a loop that calls it is cheap to write and would
 * spend the daily budget without ever looking like an attack.
 *
 * The key never leaves the server; that is the whole reason the browser talks
 * to this route instead of to Twelve Data.
 */

/** One trading day, `YYYY-MM-DD`. Anything else never reaches the provider. */
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ceiling on a single page. The provider would serve 5000, which is ~400kB of
 * JSON per request — enough that a handful of calls is a denial-of-wallet on
 * bandwidth even though the credit cost is identical. The chart asks for 750.
 */
const MAX_SIZE = 1000;

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const ticker = normalizeTicker(params.get("ticker") ?? "");
  const before = params.get("before") ?? "";

  if (!ticker) {
    return NextResponse.json({ error: "missing_ticker" }, { status: 400 });
  }

  // `before` is required here. Without it this route would duplicate the
  // server-rendered leading page at a cost of one credit, which is a way to
  // spend budget on data the page already had.
  if (!DATE.test(before)) {
    return NextResponse.json({ error: "invalid_before" }, { status: 400 });
  }

  const requested = Number(params.get("size") ?? 750);
  const size =
    Number.isFinite(requested) && requested > 0
      ? Math.min(Math.floor(requested), MAX_SIZE)
      : 750;

  const result = await getCandles(ticker, { days: size, before });

  if (!result.ok) {
    // Reaching the start of a listing's history is not a failure. The provider
    // answers a page before the first bar with 404 "Data not found", which the
    // classifier maps to not_found — for a paging request that means "there is
    // nothing older", which is a complete answer. Returning it as an empty
    // page lets the chart stop asking instead of showing an error for having
    // scrolled to the beginning.
    if (result.reason === "not_found") {
      return NextResponse.json({ candles: [], exhausted: true });
    }

    return NextResponse.json(
      { error: result.reason, retryable: result.retryable },
      { status: result.reason === "rate_limited" ? 429 : 503 },
    );
  }

  return NextResponse.json({
    candles: result.data,
    exhausted: result.data.length === 0,
  });
}
