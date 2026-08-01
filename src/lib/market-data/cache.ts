import { createClient } from "@supabase/supabase-js";
import { normalizeTicker, ok, type Result } from "./types.ts";

/**
 * Cache-first reads against quote_cache / news_cache.
 *
 * Uses the secret key, so it bypasses RLS. That is deliberate and is why those
 * tables have RLS enabled with zero policies: they are unreachable from the
 * browser entirely, and only this module touches them. A client able to read
 * quote_cache could enumerate every ticker the whole user base follows.
 *
 * The rule that matters: a failed refresh with a stale row in hand serves the
 * stale row. On an 8-request-per-minute budget this fires routinely, and a
 * price from four minutes ago is a far better answer than an error card.
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

  // select("*") rather than a template literal: supabase-js parses the column
  // list at the type level and cannot resolve a dynamic one. Both cache tables
  // are three columns wide, so there is nothing to gain from narrowing it.
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

  // Cache writes are best-effort. A failure here means the next request re-
  // fetches — wasteful, but not a reason to fail a request that already has
  // its data.
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
