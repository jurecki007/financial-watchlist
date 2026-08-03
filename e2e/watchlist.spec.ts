import { test, expect, admin } from "./fixtures";

/**
 * The journey the roadmap names: sign in, add a ticker, see it on the
 * dashboard. Plus the things that only break in a real browser — the auth
 * gate, the redirect-back, and teardown actually tearing down.
 */

test("unauthenticated visitors are sent to sign in, and returned afterwards", async ({
  page,
  user,
}) => {
  await page.goto("/dashboard");

  // Middleware, not a component, does this — so it must hold before any React
  // has run.
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await expect(page.getByText("You'll need an account")).toBeVisible();

  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // The `next` parameter has to survive the round trip, or a bookmarked deep
  // link always dumps people on the dashboard root.
  await expect(page).toHaveURL(/\/dashboard/);
});

test("wrong password is refused without revealing whether the account exists", async ({
  page,
  user,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("definitely-not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  const error = page.getByRole("alert");
  await expect(error).toBeVisible();
  // Must not confirm the address is registered.
  await expect(error).not.toContainText(/registered|exists|found/i);
  await expect(page).toHaveURL(/\/login/);
});

test("search, add a company, and see it on the dashboard", async ({
  signedIn: page,
  user,
}) => {
  await expect(page.getByText("Nothing tracked yet")).toBeVisible();

  await page.getByLabel("Add a company").fill("AAPL");

  // Results come from a live provider, so wait for the option rather than a
  // fixed timeout.
  const option = page.getByRole("button", { name: /AAPL/ }).first();
  await expect(option).toBeVisible();
  await option.click();

  // The card must name the company; the price may legitimately be absent if
  // the provider is rate-limited, and the test should not fail for that.
  const card = page.getByText("AAPL", { exact: false }).first();
  await expect(card).toBeVisible();
  await expect(page.getByText("Nothing tracked yet")).toBeHidden();

  // Confirm it really persisted rather than only appearing optimistically.
  const { data } = await admin
    .from("watchlist_items")
    .select("ticker")
    .eq("user_id", user.id);
  expect(data?.map((r) => r.ticker)).toContain("AAPL");
});

test("a watched company links through to its detail page", async ({
  signedIn: page,
  user,
}) => {
  await admin
    .from("watchlist_items")
    .insert({ user_id: user.id, ticker: "MSFT", company_name: "Microsoft" });
  await page.reload();

  await page.getByRole("link", { name: /MSFT/ }).first().click();
  await expect(page).toHaveURL(/\/company\/MSFT/);
  await expect(
    page.getByRole("heading", { name: "MSFT", level: 1 }),
  ).toBeVisible();
});

test("removing a company clears it from the list and the database", async ({
  signedIn: page,
  user,
}) => {
  await admin
    .from("watchlist_items")
    .insert({ user_id: user.id, ticker: "NVDA", company_name: "NVIDIA" });
  await page.reload();

  await page
    .getByRole("button", { name: "Remove NVDA from your watchlist" })
    .click();

  await expect(page.getByText("Nothing tracked yet")).toBeVisible();

  const { data } = await admin
    .from("watchlist_items")
    .select("ticker")
    .eq("user_id", user.id);
  expect(data).toHaveLength(0);
});

test("signing out revokes access to the dashboard", async ({
  signedIn: page,
}) => {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");

  // Back-navigation must not resurrect the session from cache.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("focusing the empty search offers popular tickers", async ({
  signedIn: page,
}) => {
  const field = page.getByLabel("Add a company");
  // Nothing before focus — the panel is a response to intent, not decoration.
  await expect(page.getByText("Popular")).toBeHidden();

  await field.click();
  await expect(page.getByText("Popular")).toBeVisible();
  await expect(page.getByRole("button", { name: /AAPL/ })).toBeVisible();

  // Typing hands the panel over to the real search; two lists of companies
  // with no way to tell which answers the query would be worse than none.
  await field.fill("micro");
  await expect(page.getByText("Popular")).toBeHidden();
});

test("popular suggestions exclude companies already watched", async ({
  signedIn: page,
  user,
}) => {
  await admin
    .from("watchlist_items")
    .insert({ user_id: user.id, ticker: "AAPL", company_name: "Apple Inc" });
  await page.reload();

  await page.getByLabel("Add a company").click();
  await expect(page.getByText("Popular")).toBeVisible();

  // Offering a duplicate makes the feature look broken when the insert
  // silently no-ops on the unique constraint.
  const list = page.getByRole("list").filter({ hasText: "Popular" });
  await expect(list.getByRole("button", { name: /AAPL/ })).toHaveCount(0);
  await expect(list.getByRole("button", { name: /MSFT/ })).toBeVisible();
});

test("a popular suggestion can be added in one click", async ({
  signedIn: page,
  user,
}) => {
  await page.getByLabel("Add a company").click();
  await page.getByRole("button", { name: /NVDA/ }).first().click();

  // Wait for the card, not for the click. Querying the database straight after
  // the click races the server action's round trip.
  await expect(
    page.getByRole("link", { name: /NVDA/ }).first(),
  ).toBeVisible();

  const { data } = await admin
    .from("watchlist_items")
    .select("ticker")
    .eq("user_id", user.id);
  expect(data?.map((r) => r.ticker)).toContain("NVDA");
});
