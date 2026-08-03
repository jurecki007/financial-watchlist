import { test as base, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A disposable, confirmed user per test.
 *
 * Created through the admin API rather than by driving the signup form,
 * because email confirmation would otherwise block every run. The signup form
 * itself is covered by its own test — this fixture exists so the tests that
 * are *about* the watchlist do not each re-test signup.
 *
 * Every user is torn down afterwards, and the assertion that teardown left
 * nothing behind is part of the suite: a test that quietly accumulates rows in
 * a shared project stops being repeatable.
 */

function env(): Record<string, string> {
  // Playwright does not read .env.local, and the app's own keys are the ones
  // the test needs to talk to the same project the server is using.
  const out: Record<string, string> = { ...process.env } as Record<string, string>;
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !out[m[1]]) out[m[1]] = m[2];
    }
  } catch {
    // CI supplies real environment variables instead.
  }
  return out;
}

const E = env();
const URL = E.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = E.SUPABASE_SECRET_KEY;

export const admin = createClient(URL, SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export type TestUser = { id: string; email: string; password: string };

export const test = base.extend<{ user: TestUser; signedIn: Page }>({
  user: async ({}, use) => {
    const email = `e2e-${crypto.randomUUID()}@example.test`;
    const password = `Pw-${crypto.randomUUID()}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    const user = { id: data.user!.id, email, password };

    await use(user);

    // Cascades to profiles, watchlist_items and price_alerts.
    await admin.auth.admin.deleteUser(user.id);
  },

  /** A page that has signed in through the real form, not a seeded cookie. */
  signedIn: async ({ page, user }, use) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard");
    await use(page);
  },
});

export { expect } from "@playwright/test";
export { PUBLISHABLE, URL as SUPABASE_URL };
