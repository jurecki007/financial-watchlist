/**
 * Pins the two properties that make the history cache safe: pages are keyed by
 * everything that changes their contents, and it never grows without bound.
 *
 * Run: node --test tests/history-cache.test.ts
 */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  clearHistory,
  historyKey,
  readHistory,
  writeHistory,
} from "../src/lib/market-data/history-cache.ts";
import type { Candle } from "../src/lib/market-data/types.ts";

const bar = (time: string): Candle => ({
  time,
  open: 1,
  high: 2,
  low: 0.5,
  close: 1.5,
});

beforeEach(() => clearHistory());

describe("history keys", () => {
  test("a different ticker is a different page", () => {
    assert.notEqual(
      historyKey("AAPL", "2024-01-01", 750),
      historyKey("MSFT", "2024-01-01", 750),
    );
  });

  test("a different boundary date is a different page", () => {
    assert.notEqual(
      historyKey("AAPL", "2024-01-01", 750),
      historyKey("AAPL", "2023-01-01", 750),
    );
  });

  // Same ticker and boundary at a different page size is a different set of
  // bars — omitting size would serve 750 to a request that asked for 100.
  test("a different page size is a different page", () => {
    assert.notEqual(
      historyKey("AAPL", "2024-01-01", 750),
      historyKey("AAPL", "2024-01-01", 100),
    );
  });
});

describe("read and write", () => {
  test("a written page reads back", () => {
    const k = historyKey("AAPL", "2024-01-01", 750);
    writeHistory(k, [bar("2023-12-29")]);
    assert.deepEqual(readHistory(k), [bar("2023-12-29")]);
  });

  test("an unknown page is a miss, not an empty array", () => {
    assert.equal(readHistory(historyKey("NVDA", "2020-01-01", 750)), undefined);
  });

  // End-of-history is worth caching: without this, scrolling to the very
  // beginning re-asks the provider every single time to be told "nothing".
  test("an empty page is cached as a hit, not a miss", () => {
    const k = historyKey("AAPL", "1980-01-01", 750);
    writeHistory(k, []);
    assert.deepEqual(readHistory(k), []);
    assert.notEqual(readHistory(k), undefined);
  });
});

describe("bounded growth", () => {
  test("the cache evicts rather than growing without limit", () => {
    for (let i = 0; i < 400; i++) {
      writeHistory(historyKey("AAPL", `2024-01-${i}`, 750), [bar(`d${i}`)]);
    }
    // The earliest writes must be gone; the most recent must survive.
    assert.equal(readHistory(historyKey("AAPL", "2024-01-0", 750)), undefined);
    assert.ok(readHistory(historyKey("AAPL", "2024-01-399", 750)));
  });

  test("reading an entry keeps it from being the next evicted", () => {
    const keep = historyKey("AAPL", "2024-01-keep", 750);
    writeHistory(keep, [bar("keep")]);

    // Touch it, then push enough entries to overflow the cache once.
    for (let i = 0; i < 200; i++) {
      readHistory(keep);
      writeHistory(historyKey("AAPL", `f-${i}`, 750), [bar(`f${i}`)]);
    }

    assert.ok(
      readHistory(keep),
      "a repeatedly-read page was evicted ahead of write-once pages",
    );
  });
});
