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
  const option = page.getByRole("option", { name: /AAPL/ }).first();
  await expect(option).toBeVisible();
  await option.click();

  // The card must name the company; the price may legitimately be absent if
  // the provider is rate-limited, and the test should not fail for that.
  const card = page.getByText("AAPL", { exact: false }).first();
  await expect(card).toBeVisible();
  await expect(page.getByText("Nothing tracked yet")).toBeHidden();

  // The card appears optimistically, so its presence proves nothing about the
  // database. Poll the real rows instead — with optimistic UI the screen is no
  // longer evidence of persistence.
  await expect
    .poll(async () => {
      const { data } = await admin
        .from("watchlist_items")
        .select("ticker")
        .eq("user_id", user.id);
      return data?.map((r) => r.ticker) ?? [];
    })
    .toContain("AAPL");
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

  // Disappears optimistically, so wait on the database rather than the DOM.
  await expect(page.getByText("Nothing tracked yet")).toBeVisible();
  await expect
    .poll(async () => {
      const { data } = await admin
        .from("watchlist_items")
        .select("ticker")
        .eq("user_id", user.id);
      return data?.length ?? -1;
    })
    .toBe(0);
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
  await expect(page.getByRole("option", { name: /AAPL/ })).toBeVisible();

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
  const list = page.getByRole("listbox");
  await expect(list.getByRole("option", { name: /AAPL/ })).toHaveCount(0);
  await expect(list.getByRole("option", { name: /MSFT/ })).toBeVisible();
});

test("a popular suggestion can be added in one click", async ({
  signedIn: page,
  user,
}) => {
  await page.getByLabel("Add a company").click();
  await page.getByRole("option", { name: /NVDA/ }).first().click();

  // Wait for the card, not for the click. Querying the database straight after
  // the click races the server action's round trip.
  await expect(
    page.getByRole("link", { name: /NVDA/ }).first(),
  ).toBeVisible();

  await expect
    .poll(async () => {
      const { data } = await admin
        .from("watchlist_items")
        .select("ticker")
        .eq("user_id", user.id);
      return data?.map((r) => r.ticker) ?? [];
    })
    .toContain("NVDA");
});

test("news and alerts are reachable from the nav and gated when signed out", async ({
  page,
}) => {
  // Gated before any React runs.
  await page.goto("/news");
  await expect(page).toHaveURL(/\/login\?next=%2Fnews/);
  await page.goto("/alerts");
  await expect(page).toHaveURL(/\/login\?next=%2Falerts/);
});

test("news aggregates headlines across the whole watchlist", async ({
  signedIn: page,
  user,
}) => {
  await page.getByRole("link", { name: "News" }).click();
  await expect(page).toHaveURL(/\/news/);
  // Nothing watched yet, so the feed must guide rather than show an error.
  await expect(page.getByText("Nothing to report yet")).toBeVisible();

  await admin
    .from("watchlist_items")
    .insert({ user_id: user.id, ticker: "AAPL", company_name: "Apple Inc" });
  await page.reload();

  // Either headlines or an honest empty/error state — never a blank page.
  await expect(
    page.getByRole("heading", { name: "News", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Across the 1 company you follow")).toBeVisible();
});

test("alerts page lists what a company page armed", async ({
  signedIn: page,
  user,
}) => {
  await page.goto("/alerts");
  await expect(page.getByText("No alerts set")).toBeVisible();

  await admin.from("price_alerts").insert({
    user_id: user.id,
    ticker: "AAPL",
    condition: "above",
    threshold: 1,
  });
  await page.reload();

  await expect(page.getByText("1 watching for a price")).toBeVisible();
  await expect(page.getByText("above 1.00")).toBeVisible();

  // Deleting from here must actually remove the row, not just hide it.
  await page.getByRole("button", { name: "Delete the AAPL alert" }).click();
  await expect(page.getByText("No alerts set")).toBeVisible();
  await expect
    .poll(async () => {
      const { data } = await admin
        .from("price_alerts")
        .select("id")
        .eq("user_id", user.id);
      return data?.length ?? -1;
    })
    .toBe(0);
});

test("the search can be driven entirely from the keyboard", async ({
  signedIn: page,
  user,
}) => {
  await page.getByLabel("Add a company").focus();
  const field = page.getByLabel("Add a company");
  await expect(field).toHaveAttribute("aria-expanded", "true");

  // Arrow down twice, then Enter — no pointer involved.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  const chosen = await page
    .locator('[role="option"][aria-selected="true"]')
    .innerText();
  await page.keyboard.press("Enter");

  const ticker = chosen.trim().split(/\s+/)[0];
  await expect
    .poll(async () => {
      const { data } = await admin
        .from("watchlist_items")
        .select("ticker")
        .eq("user_id", user.id);
      return data?.map((r) => r.ticker) ?? [];
    })
    .toContain(ticker);
});

test("a card shows where the price sits in its 52-week range", async ({
  signedIn: page,
  user,
}) => {
  await admin
    .from("watchlist_items")
    .insert({ user_id: user.id, ticker: "AAPL", company_name: "Apple Inc" });
  await page.reload();

  // The marker is positional and invisible to assistive tech, so the same
  // fact must exist in words.
  await expect(
    page.getByText(/percent of the 52-week range/),
  ).toBeAttached();
});
