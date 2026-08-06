import { createClient } from "@supabase/supabase-js";
import { normalizeTicker, ok, type Result } from "./types.ts";

/**
 * Cache-first reads against quote_cache / news_cache.
 *
 * Uses the secret key, which is why those tables have RLS enabled with zero
 * policies: they are unreachable from the browser, and a client able to read
 * quote_cache could enumerate every ticker the user base follows.
 *
 * A failed refresh with a stale row in hand serves the stale row — on this
 * budget that fires routinely, and a four-minute-old price beats an error card.
 */

const TTL_MS = {
  quote: 60_000, // a minute is well inside what a free tier can sustain
  news: 30 * 60_000, // headlines do not turn over on a one-minute cadence
} as const;

type Kind = keyof typeof TTL_MS;

const TABLE: Record<Kind, { name: string; column: string }> = {
  quote: { name: "quote_cache", column: "quote_json" },
  news: { name: "news_cache", column: "article_json" },
};

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type CacheRow<T> = { value: T; fetchedAt: string; fresh: boolean };

export async function readCache<T>(
  kind: Kind,
  ticker: string,
): Promise<CacheRow<T> | null> {
  const db = admin();
  if (!db) return null;
  const { name, column } = TABLE[kind];

  // select("*") because supabase-js parses the column list at the type level
  // and cannot resolve a dynamic one. Both tables are three columns wide.
  const { data, error } = await db
    .from(name)
    .select("*")
    .eq("ticker", normalizeTicker(ticker))
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as Record<string, unknown>;
  const fetchedAt = String(row.fetched_at);
  const age = Date.now() - new Date(fetchedAt).getTime();

  return {
    value: row[column] as T,
    fetchedAt,
    fresh: age < TTL_MS[kind],
  };
}

export async function writeCache<T>(
  kind: Kind,
  ticker: string,
  value: T,
): Promise<void> {
  const db = admin();
  if (!db) return;
  const { name, column } = TABLE[kind];

  // Best-effort: a failure means the next request refetches, which is wasteful
  // but not a reason to fail a request that already has its data.
  const { error } = await db.from(name).upsert(
    {
      ticker: normalizeTicker(ticker),
      [column]: value,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "ticker" },
  );
  if (error) console.error(`[market-data] cache write ${name}:`, error.message);
}

/**
 * Fresh cache → return it. Stale or missing → refetch. Refetch failed but a
 * stale row exists → return the stale row marked as such, rather than the
 * error. Only a failure with nothing to fall back on surfaces as a failure.
 */
export async function throughCache<T>(
  kind: Kind,
  ticker: string,
  refetch: () => Promise<Result<T>>,
): Promise<Result<T>> {
  const cached = await readCache<T>(kind, ticker);

  if (cached?.fresh) {
    return ok(cached.value, { asOf: cached.fetchedAt });
  }

  const fresh = await refetch();

  if (fresh.ok) {
    await writeCache(kind, ticker, fresh.data);
    return fresh;
  }

  if (cached) {
    return ok(cached.value, { asOf: cached.fetchedAt, stale: true });
  }

  return fresh;
}
