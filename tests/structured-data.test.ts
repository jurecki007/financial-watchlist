/**
 * The escape in serialiseJsonLd is a guard, and a guard that has never been
 * given something to catch is an assumption. These tests hand it the exact
 * payload it exists to stop.
 *
 * Every value in the graph is a static constant today, so this protects a
 * future edit rather than present input — which is precisely when a
 * </script> breakout would land unnoticed.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { landingPageGraph, serialiseJsonLd } from "../src/lib/structured-data.ts";

describe("serialiseJsonLd", () => {
  test("neutralises a </script> breakout", () => {
    const out = serialiseJsonLd({
      name: "</script><img src=x onerror=alert(1)>",
    });
    assert.ok(!out.includes("</script>"), "raw </script> survived escaping");
    assert.ok(out.includes("\\u003c"), "expected < to be escaped");
  });

  test("escaping is lossless — the value survives a round trip", () => {
    const value = { name: "</script>", note: "a < b" };
    const parsed = JSON.parse(serialiseJsonLd(value));
    assert.deepEqual(parsed, value);
  });

  test("output is valid JSON", () => {
    assert.doesNotThrow(() => JSON.parse(serialiseJsonLd(landingPageGraph())));
  });
});

describe("landingPageGraph", () => {
  const graph = landingPageGraph() as {
    "@graph": Record<string, unknown>[];
  };
  const byType = (t: string) =>
    graph["@graph"].find((n) => n["@type"] === t) as
      | Record<string, unknown>
      | undefined;

  test("creator reference resolves to a node in the same graph", () => {
    const website = byType("WebSite");
    const person = byType("Person");
    assert.ok(website && person, "expected both WebSite and Person nodes");
    const ref = (website.creator as { "@id": string })["@id"];
    assert.equal(
      ref,
      person["@id"],
      "creator points at an @id that is not in the graph",
    );
  });

  test("declares no SearchAction — the search endpoint is behind auth", () => {
    assert.ok(!JSON.stringify(graph).includes("SearchAction"));
  });

  test("asserts no identity beyond the GitHub account the footer links", () => {
    const person = byType("Person")!;
    assert.equal(person.name, "jurecki007");
    assert.deepEqual(person.sameAs, ["https://github.com/jurecki007"]);
  });

  test("inLanguage matches the lang attribute the layout renders", () => {
    assert.equal(byType("WebSite")!.inLanguage, "en");
  });
});
