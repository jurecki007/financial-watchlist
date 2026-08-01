import { fail, type Failure, type FailureReason } from "./types.ts";

/**
 * Shared fetch for both providers.
 *
 * Every provider error becomes one of four reasons here, so no vendor-specific
 * status code or message survives past this file. Raw responses are logged
 * server-side only — a provider's error body can echo the query string, which
 * on some APIs carries the key.
 */

const TIMEOUT_MS = 8_000;

export type HttpResult<T> = { ok: true; body: T } | Failure;

function classify(status: number): FailureReason {
  if (status === 429) return "rate_limited";
  if (status === 403 || status === 401) return "not_entitled";
  if (status === 404) return "not_found";
  return "unavailable";
}

export async function getJson<T>(
  url: string,
  { label }: { label: string },
): Promise<HttpResult<T>> {
  // AbortSignal.timeout rather than a manual race: a hung socket otherwise
  // holds the request open until the platform kills the function, which turns
  // one slow provider into a page that never renders.
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Caching is ours to control via quote_cache; Next's fetch cache would
      // hide staleness we need to reason about explicitly.
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    if (!res.ok) {
      console.error(`[market-data] ${label} HTTP ${res.status}`);
      return fail(classify(res.status));
    }

    return { ok: true, body: (await res.json()) as T };
  } catch (err) {
    // TimeoutError, network failure, malformed JSON — all "the provider did
    // not give us usable data", which is one condition from a caller's view.
    console.error(`[market-data] ${label} threw:`, err);
    return fail("unavailable");
  }
}

/**
 * Twelve Data answers 200 with `{"status":"error","code":429,...}` rather than
 * using HTTP status codes for its own errors, so a naive `res.ok` check reads
 * a rate-limit as success and produces `undefined` prices downstream.
 */
export function twelveDataError(
  body: unknown,
): FailureReason | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as { status?: string; code?: number; message?: string };
  if (b.status !== "error") return null;
  if (b.code === 429) return "rate_limited";
  if (b.code === 403 || b.code === 401) return "not_entitled";
  if (b.code === 404) return "not_found";
  // Their 400 for an unknown symbol reads as a not-found to a user.
  if (b.code === 400 && /symbol/i.test(b.message ?? "")) return "not_found";
  return "unavailable";
}
