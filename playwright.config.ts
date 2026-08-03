import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config.
 *
 * `webServer` builds and serves the production bundle rather than running
 * `next dev`. The dev server behaves differently enough around streaming,
 * caching and middleware that a passing dev-mode test says less than it
 * appears to — and the earlier stale-`.next` incident in this project is
 * exactly the kind of thing a production build catches and dev does not.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // tests share one Supabase project; serialise writes
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
