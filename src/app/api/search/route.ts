import { NextResponse, type NextRequest } from "next/server";
import { searchSymbols } from "@/lib/market-data";
import { getUser } from "@/lib/supabase/server";

/** Ticker autocomplete. Authenticated for the same budget reason as /api/quotes. */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();

  // Below two characters the result set is meaningless and the request is
  // pure cost. The client debounces too; this is the backstop that holds when
  // the client is not ours.
  if (query.length < 2) return NextResponse.json({ matches: [] });
  if (query.length > 40) {
    return NextResponse.json({ error: "query_too_long" }, { status: 400 });
  }

  const result = await searchSymbols(query);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason, retryable: result.retryable },
      { status: result.reason === "rate_limited" ? 429 : 503 },
    );
  }

  return NextResponse.json({ matches: result.data });
}
