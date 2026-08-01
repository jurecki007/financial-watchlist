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
import { twelveDataError } from "../src/lib/market-data/http.ts";
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

describe("retryability", () => {
  // Retrying a 403 or a bad symbol spends budget that will never succeed.
  const cases: [FailureReason, boolean][] = [
    ["rate_limited", true],
    ["unavailable", true],
    ["not_entitled", false],
    ["not_found", false],
  ];
  for (const [reason, retryable] of cases) {
    test(`${reason} retryable=${retryable}`, () => {
      assert.equal(fail(reason).retryable, retryable);
    });
  }
});

describe("user-facing copy", () => {
  test("every failure reason has copy, so none can reach a user unmapped", () => {
    for (const reason of [
      "rate_limited",
      "unavailable",
      "not_entitled",
      "not_found",
    ] as FailureReason[]) {
      const copy = FAILURE_COPY[reason];
      assert.ok(copy?.title && copy?.body, `${reason} has no copy`);
      // Vendor names must not leak into anything a user reads.
      assert.doesNotMatch(copy.body, /twelve ?data|finnhub|supabase/i);
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
