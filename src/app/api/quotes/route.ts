import { NextResponse, type NextRequest } from "next/server";
import { getQuotes } from "@/lib/market-data";
import { getUser } from "@/lib/supabase/server";

/**
 * Quotes for a set of tickers. Authenticated because an open proxy to a metered
 * API is somebody else's free tier, and the keys never leave the server — which
 * is why this route exists rather than the browser calling Twelve Data.
 */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const raw = request.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = raw.split(",").map((t) => t.trim()).filter(Boolean);

  // Bound the fan-out. Without this a crafted request could ask for hundreds
  // of symbols in one call and spend the daily budget in a single request.
  if (tickers.length > 50) {
    return NextResponse.json({ error: "too_many_tickers" }, { status: 400 });
  }

  const result = await getQuotes(tickers);

  if (!result.ok) {
    // The mapped reason, never the provider's own message.
    return NextResponse.json(
      { error: result.reason, retryable: result.retryable },
      { status: result.reason === "rate_limited" ? 429 : 503 },
    );
  }

  return NextResponse.json({
    quotes: result.data,
    asOf: result.asOf,
    stale: result.stale ?? false,
  });
}
