import { NextResponse, type NextRequest } from "next/server";
import { getCandles, normalizeTicker } from "@/lib/market-data";
import { getUser } from "@/lib/supabase/server";

/**
 * Older candles for the chart's load-on-scroll. Authenticated because an open
 * proxy to a metered API is somebody else's free tier — and this one is driven
 * by scrolling, so a loop against it would spend the daily budget without ever
 * looking like an attack.
 */

/** One trading day, `YYYY-MM-DD`. Anything else never reaches the provider. */
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ceiling on one page. The provider would serve 5000, at ~400kB per request —
 * a denial-of-wallet on bandwidth even though the credit cost is identical.
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

  // Required: without it this duplicates the server-rendered leading page at
  // the cost of a credit.
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
    // Reaching the start of history is not a failure. The provider answers a
    // page before the first bar with 404, which for a paging request means
    // "nothing older" — returned as an empty page so the chart stops asking.
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
