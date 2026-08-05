import { test, expect } from "./fixtures";

/**
 * The About tab bar tracks the route on client-side navigation.
 *
 * This exists because the bug it guards was invisible to a reload. The tab bar
 * lives in a layout, and an App Router layout does not re-render when you move
 * between the routes that share it — so a path read at mount stayed frozen.
 * Every hard load looked correct; only clicking between the two tabs exposed
 * it, and it put `aria-current="page"` on the tab you had just left.
 *
 * Both assertions matter and they fail differently: the marker is what a
 * sighted visitor sees, `aria-current` is the entire signal for everyone else.
 *
 * /about is public, so no session is needed.
 */

const tabs = (page: import("@playwright/test").Page) =>
  page.locator('nav[aria-label="About"]');

test("the tab marker follows client-side navigation between About pages", async ({
  page,
}) => {
  await page.goto("/about/project");

  const project = tabs(page).getByRole("link", { name: "The project" });
  const author = tabs(page).getByRole("link", { name: "The author" });

  await expect(project).toHaveAttribute("aria-current", "page");
  await expect(author).not.toHaveAttribute("aria-current", "page");

  // Click, do not navigate by URL — a fresh load remounts the layout and
  // cannot reproduce this.
  await author.click();
  await page.waitForURL("**/about/author");

  await expect(
    author,
    "aria-current stayed on the tab that was left",
  ).toHaveAttribute("aria-current", "page");
  await expect(project).not.toHaveAttribute("aria-current", "page");

  // And back, so a one-directional fix does not pass.
  await project.click();
  await page.waitForURL("**/about/project");
  await expect(project).toHaveAttribute("aria-current", "page");
  await expect(author).not.toHaveAttribute("aria-current", "page");
});

test("the marker is a single element that travels between tabs", async ({
  page,
}) => {
  await page.goto("/about/project");
  const marker = tabs(page).locator("span[aria-hidden]");

  // One marker for the bar, not one per tab. Two that cross-fade cannot
  // travel, so this is the structural precondition for the animation rather
  // than a style preference.
  await expect(marker).toHaveCount(1);

  const box = async () => (await marker.boundingBox())!;
  const from = await box();

  await tabs(page).getByRole("link", { name: "The author" }).click();
  await page.waitForURL("**/about/author");

  // Deliberately not asserting an intermediate position here. Catching the
  // marker mid-transition depends on when the route commits relative to the
  // sample, which makes it flaky in CI — and a flaky test is worse than none.
  // The reduced-motion case below pins the animation behaviour deterministically
  // instead: if travel were removed entirely, that test still fails.
  await page.waitForTimeout(500);
  const to = await box();
  expect(to.x, "the marker did not move to the other tab").toBeGreaterThan(
    from.x,
  );
  // It also resizes to the label it is under — the two tabs are different
  // widths, so a fixed-width marker would sit wrong under one of them.
  expect(Math.round(to.width)).not.toBe(Math.round(from.width));
});

test("reduced motion removes the travel, not the marker", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/about/project");

  const marker = tabs(page).locator("span[aria-hidden]");
  await expect(marker).toHaveCount(1);
  const from = (await marker.boundingBox())!;

  await tabs(page).getByRole("link", { name: "The author" }).click();
  await page.waitForURL("**/about/author");
  await page.waitForTimeout(40);

  // Same destination, arrived at instantly rather than animated toward.
  const at40 = (await marker.boundingBox())!;
  await page.waitForTimeout(500);
  const settled = (await marker.boundingBox())!;
  expect(
    Math.round(at40.x),
    "reduced motion still animated the marker",
  ).toBe(Math.round(settled.x));
  expect(settled.x).toBeGreaterThan(from.x);

  await context.close();
});

test("both About pages are reachable without a session", async ({ page }) => {
  // The audience for these two pages is people evaluating the work, so an auth
  // gate on either would defeat the point of writing them.
  for (const path of ["/about/project", "/about/author"]) {
    const res = await page.goto(path);
    expect(res?.status(), `${path} did not return 200`).toBe(200);
    expect(new URL(page.url()).pathname).toBe(path);
  }

  // And the landing page — which renders no nav — must still offer a way in.
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "About" }).first(),
  ).toBeVisible();
});
