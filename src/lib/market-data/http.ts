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

// 401 and 403 are deliberately not collapsed. 401 means the credential was
// rejected or never sent — our configuration. 403 means it was accepted and the
// plan does not cover the endpoint — the free tier doing what it says. They
// need different copy because they need different people to fix them.
function classify(status: number): FailureReason {
  if (status === 429) return "rate_limited";
  if (status === 401) return "misconfigured";
  if (status === 403) return "not_entitled";
  if (status === 404) return "not_found";
  return "unavailable";
}

/**
 * Refuse to call a provider with no credential.
 *
 * Without this the empty string is sent as `apikey=`, the provider answers 401,
 * and the user is told the data is behind a paid plan. Checking first turns a
 * misleading round-trip into an honest local answer, and puts the variable's
 * actual name in the server log where the person who can fix it will look.
 *
 * The name is logged, never returned — `FAILURE_COPY.misconfigured` is what
 * reaches the browser, per the rule that vendor and deployment internals stay
 * server-side.
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
  // Twelve Data answers a missing or wrong apikey with code 401 in a 200-status
  // envelope, which is exactly how an unset env var reached the browser dressed
  // as a paid-plan limit. Same split as classify() above.
  if (b.code === 401) return "misconfigured";
  if (b.code === 403) return "not_entitled";
  if (b.code === 404) return "not_found";
  // Their 400 for an unknown symbol reads as a not-found to a user.
  if (b.code === 400 && /symbol/i.test(b.message ?? "")) return "not_found";
  return "unavailable";
}
