/**
 * Which paths the auth gate covers. The redirect itself is verified against a
 * running server; this guards the prefix list, whose failure mode is a new
 * route nobody added — which looks like working software.
 *
 * Run: node --test tests/route-protection.test.ts
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isProtected, safeRedirectPath } from "../src/lib/auth/routes.ts";

describe("auth gate coverage", () => {
  for (const path of [
    "/dashboard",
    "/dashboard/",
    "/dashboard/settings",
    "/company/AAPL",
    "/news",
    "/alerts",
    "/alerts/new",
    "/settings/profile",
  ]) {
    test(`gates ${path}`, () => {
      assert.equal(isProtected(path), true, `${path} was left open`);
    });
  }

  for (const path of ["/", "/login", "/signup", "/roadmap"]) {
    test(`leaves ${path} public`, () => {
      assert.equal(isProtected(path), false, `${path} was gated`);
    });
  }

  test("does not gate paths that merely start with the same letters", () => {
    // A bare startsWith would gate /dashboards-public silently.
    assert.equal(isProtected("/dashboardish"), false);
    assert.equal(isProtected("/settingsomething"), false);
  });
});

describe("post-auth redirect safety", () => {
  // Every one of these is an attempt to bounce a freshly-authenticated user
  // off-origin at the moment they are most primed to trust the page.
  for (const hostile of [
    "//evil.com",
    "///evil.com",
    "/\\evil.com",
    "https://evil.com",
    "http://evil.com/x",
    "javascript:alert(1)",
    "evil.com",
    "",
  ]) {
    test(`rejects ${JSON.stringify(hostile)}`, () => {
      assert.equal(safeRedirectPath(hostile), "/dashboard");
    });
  }

  for (const ok of ["/dashboard", "/company/AAPL", "/alerts?new=1"]) {
    test(`allows ${ok}`, () => {
      assert.equal(safeRedirectPath(ok), ok);
    });
  }

  test("rejects non-string input", () => {
    assert.equal(safeRedirectPath(null), "/dashboard");
    assert.equal(safeRedirectPath(undefined), "/dashboard");
    assert.equal(safeRedirectPath(42), "/dashboard");
  });
});
