/**
 * Error classification and failure copy.
 *
 * The classifier is the whole reason nothing downstream ever sees a vendor
 * status code, and it is exactly the kind of mapping that rots quietly: a
 * provider changes a code, the branch stops matching, and every failure
 * silently becomes "unavailable" — which reads as our outage rather than a
 * rate limit that will clear on its own.
 *
 * Run: node --test tests/market-data.test.ts
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { missingKey, twelveDataError } from "../src/lib/market-data/http.ts";
import {
  fail,
  ok,
  normalizeTicker,
  FAILURE_COPY,
  type FailureReason,
} from "../src/lib/market-data/types.ts";

describe("Twelve Data in-body errors", () => {
  // Twelve Data answers HTTP 200 with an error object rather than using status
  // codes for its own failures. A naive res.ok check reads a rate limit as
  // success and produces undefined prices downstream.
  test("429 in a 200 body is a rate limit", () => {
    assert.equal(twelveDataError({ status: "error", code: 429 }), "rate_limited");
  });

  test("403 is not_entitled, not a generic failure", () => {
    assert.equal(twelveDataError({ status: "error", code: 403 }), "not_entitled");
  });

  // The distinction this pair protects is the one that actually misled a
  // reader: with 401 folded into not_entitled, a deployment that had simply
  // never been given TWELVE_DATA_API_KEY told every visitor the chart sat
  // behind a paid plan. 401 is our configuration, 403 is the plan.
  test("401 is misconfigured, not not_entitled", () => {
    assert.equal(twelveDataError({ status: "error", code: 401 }), "misconfigured");
  });

  test("401 and 403 do not collapse to the same reason", () => {
    assert.notEqual(
      twelveDataError({ status: "error", code: 401 }),
      twelveDataError({ status: "error", code: 403 }),
    );
  });

  test("a 400 mentioning the symbol reads as not_found", () => {
    assert.equal(
      twelveDataError({ status: "error", code: 400, message: "**symbol** not found" }),
      "not_found",
    );
  });

  test("an unrecognised error code is unavailable, never null", () => {
    assert.equal(twelveDataError({ status: "error", code: 500 }), "unavailable");
  });

  test("a successful body is not an error", () => {
    assert.equal(twelveDataError({ status: "ok", values: [] }), null);
    assert.equal(twelveDataError({ symbol: "AAPL", close: "1" }), null);
  });

  test("malformed input does not throw", () => {
    assert.equal(twelveDataError(null), null);
    assert.equal(twelveDataError("nonsense"), null);
    assert.equal(twelveDataError(undefined), null);
  });
});

describe("missing credentials", () => {
  test("an absent key fails locally instead of calling the provider", () => {
    const res = missingKey("TWELVE_DATA_API_KEY", "");
    assert.equal(res?.reason, "misconfigured");
  });

  test("a present key does not short-circuit", () => {
    assert.equal(missingKey("TWELVE_DATA_API_KEY", "abc123"), null);
  });

  test("the failure is not retryable — no env var changes on a retry", () => {
    assert.equal(missingKey("FINNHUB_API_KEY", "")?.retryable, false);
  });
});

describe("retryability", () => {
  // Retrying a 403 or a bad symbol spends budget that will never succeed.
  const cases: [FailureReason, boolean][] = [
    ["rate_limited", true],
    ["unavailable", true],
    ["not_entitled", false],
    ["misconfigured", false],
    ["not_found", false],
  ];
  for (const [reason, retryable] of cases) {
    test(`${reason} retryable=${retryable}`, () => {
      assert.equal(fail(reason).retryable, retryable);
    });
  }
});

/**
 * Hand-listed, but the list cannot silently fall behind the union: the
 * `satisfies` clause rejects a name that is not a reason, and the `Missing`
 * check below rejects a reason that is not in the list. Adding a member to
 * FailureReason and forgetting it here is a type error, not a passing suite.
 *
 * Verified by deleting "misconfigured" from this array and confirming
 * `tsc --noEmit` fails on _NO_REASON_UNCOVERED.
 */
const ALL_REASONS = [
  "rate_limited",
  "unavailable",
  "not_entitled",
  "misconfigured",
  "not_found",
] as const satisfies readonly FailureReason[];

type Missing = Exclude<FailureReason, (typeof ALL_REASONS)[number]>;
const _NO_REASON_UNCOVERED: Missing extends never ? true : never = true;

describe("user-facing copy", () => {
  test("every failure reason has copy, so none can reach a user unmapped", () => {
    void _NO_REASON_UNCOVERED;
    for (const reason of ALL_REASONS) {
      const copy = FAILURE_COPY[reason];
      assert.ok(copy?.title && copy?.body, `${reason} has no copy`);
      // Vendor names must not leak into anything a user reads.
      assert.doesNotMatch(copy.body, /twelve ?data|finnhub|supabase/i);
    }
  });

  // The environment variable names belong in the server log, not in a page.
  test("no failure copy names an environment variable", () => {
    for (const reason of ALL_REASONS) {
      assert.doesNotMatch(FAILURE_COPY[reason].body, /API_KEY|SECRET|_URL/);
    }
  });
});

describe("result shape", () => {
  test("ok carries staleness metadata", () => {
    const r = ok({ a: 1 }, { asOf: "2026-08-01T00:00:00Z", stale: true });
    assert.equal(r.ok, true);
    assert.equal(r.stale, true);
    assert.equal(r.asOf, "2026-08-01T00:00:00Z");
  });

  test("normalizeTicker upper-cases and trims to match the DB constraint", () => {
    assert.equal(normalizeTicker("  aapl "), "AAPL");
    assert.equal(normalizeTicker("Msft"), "MSFT");
  });
});
