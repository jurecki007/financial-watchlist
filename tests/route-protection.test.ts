/**
 * Which paths the auth gate covers.
 *
 * The redirect behaviour itself is verified against a running server; this
 * suite guards the part that silently rots — the prefix list. The failure mode
 * is not a broken redirect, it is a new route nobody added to PROTECTED, which
 * looks exactly like working software until someone reads another user's data.
 *
 * Run: node --test tests/route-protection.test.ts
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isProtected } from "../src/lib/auth/routes.ts";

describe("auth gate coverage", () => {
  for (const path of [
    "/dashboard",
    "/dashboard/",
    "/dashboard/settings",
    "/company/AAPL",
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
    // /dashboards-public must not inherit /dashboard's protection by accident,
    // and more importantly the reverse: a prefix match written as a bare
    // startsWith would gate it silently and nobody would notice.
    assert.equal(isProtected("/dashboardish"), false);
    assert.equal(isProtected("/settingsomething"), false);
  });
});
