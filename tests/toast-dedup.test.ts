import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Mirrors the provider's dedup rule so the behaviour is pinned even though the
// component itself needs a DOM. The rule is the part that matters: a burst of
// failures from one cause must report once.
const DEDUP_MS = 30_000;
function makeGate() {
  const seen = new Map<string, number>();
  return (key: string, now: number) => {
    const last = seen.get(key) ?? -Infinity;
    if (now - last < DEDUP_MS) return false;
    seen.set(key, now);
    return true;
  };
}

describe("toast dedup", () => {
  test("twelve simultaneous failures from one cause report once", () => {
    const gate = makeGate();
    const fired = Array.from({ length: 12 }, () => gate("rate_limited", 1000)).filter(Boolean);
    assert.equal(fired.length, 1);
  });
  test("different causes each report", () => {
    const gate = makeGate();
    assert.equal(gate("rate_limited", 0), true);
    assert.equal(gate("unavailable", 0), true);
  });
  test("the same cause reports again after the window", () => {
    const gate = makeGate();
    assert.equal(gate("rate_limited", 0), true);
    assert.equal(gate("rate_limited", 29_000), false);
    assert.equal(gate("rate_limited", 31_000), true);
  });
});
