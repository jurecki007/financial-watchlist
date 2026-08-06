import { fail, type Failure, type FailureReason } from "./types.ts";

/**
 * Shared fetch for both providers. Every provider error becomes one of the
 * shared reasons here, so no vendor status or message survives this file, and
 * raw bodies stay in the server log — some echo the query string.
 */

const TIMEOUT_MS = 8_000;

export type HttpResult<T> = { ok: true; body: T } | Failure;

// 401 and 403 must not collapse: 401 is our configuration, 403 is the plan's
// limit. Different copy, because different people can fix them.
function classify(status: number): FailureReason {
  if (status === 429) return "rate_limited";
  if (status === 401) return "misconfigured";
  if (status === 403) return "not_entitled";
  if (status === 404) return "not_found";
  return "unavailable";
}

/**
 * Refuse to call a provider with no credential. Otherwise `apikey=` is sent,
 * the provider answers 401, and the user is told the data sits behind a paid
 * plan. The variable name goes to the server log, never to the browser.
 */
export function missingKey(varName: string, value: string): Failure | null {
  if (value) return null;
  console.error(
    `[market-data] ${varName} is not set — refusing to call the provider`,
  );
  return fail("misconfigured");
}

export async function getJson<T>(
  url: string,
  { label }: { label: string },
): Promise<HttpResult<T>> {
  // A hung socket would otherwise hold the request open until the platform
  // kills the function, turning one slow provider into a page that never renders.
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Caching is ours via quote_cache; Next's would hide staleness.
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    if (!res.ok) {
      console.error(`[market-data] ${label} HTTP ${res.status}`);
      return fail(classify(res.status));
    }

    return { ok: true, body: (await res.json()) as T };
  } catch (err) {
    // Timeout, network failure, malformed JSON — one condition to a caller.
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
  // Same 401/403 split as classify(): an unset key once reached the browser
  // dressed as a paid-plan limit.
  if (b.code === 401) return "misconfigured";
  if (b.code === 403) return "not_entitled";
  if (b.code === 404) return "not_found";
  // Their 400 for an unknown symbol is a not-found to a user.
  if (b.code === 400 && /symbol/i.test(b.message ?? "")) return "not_found";
  return "unavailable";
}
