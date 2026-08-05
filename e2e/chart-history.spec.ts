import { test, expect } from "./fixtures";

/**
 * Paging older candles in on scroll.
 *
 * This is the one behaviour in the chart that cannot be checked by reading the
 * code: whether the viewport survives a prepend. Adding bars to the front
 * shifts every logical index, so a chart that does not compensate jumps
 * backwards by a whole page exactly when the user is mid-pan. The assertion
 * that matters is therefore not "more bars arrived" but "more bars arrived and
 * the view stayed where it was put".
 *
 * Needs live provider credentials — skipped rather than failed without them,
 * because a missing key is an environment fact, not a regression.
 */

const CHART = 'div[role="img"][aria-label*="Daily price chart"]';

test("panning to the left edge loads earlier sessions without moving the view", async ({
  signedIn: page,
}) => {
  await page.goto("/company/AAPL");

  const chart = page.locator(CHART);
  await expect(chart).toBeVisible();

  // If the deployment has no market-data key the page renders the
  // misconfigured state instead of a chart; that is not what this tests.
  const label = (await chart.getAttribute("aria-label")) ?? "";
  test.skip(
    !/\d+ sessions/.test(label),
    "no live market data available in this environment",
  );

  const sessions = async () => {
    const l = (await chart.getAttribute("aria-label")) ?? "";
    return Number(l.match(/(\d+) sessions/)?.[1] ?? 0);
  };

  const before = await sessions();
  expect(before).toBeGreaterThan(500); // the leading page is 750

  // Hold the response open. Without this the fetch resolves inside a single
  // pan and there is no observable moment "before the prepend" to compare
  // against — the assertion below needs both sides of the event.
  await page.route("**/api/candles**", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });

  // Pan left by dragging the plot to the right. Dragging is what a user does;
  // setting the logical range directly would bypass the subscription under
  // test.
  const box = (await chart.boundingBox())!;
  const midY = box.y + box.height / 2;
  const probeX = box.x + box.width * 0.5;

  const drag = async () => {
    await page.mouse.move(box.x + box.width * 0.2, midY);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.9, midY, { steps: 8 });
    await page.mouse.up();
  };

  const loader = page.getByText("loading earlier sessions");
  for (let i = 0; i < 30; i++) {
    await drag();
    if (await loader.isVisible().catch(() => false)) break;
    await page.waitForTimeout(60);
  }
  expect(await loader.isVisible(), "panning never requested older data").toBe(
    true,
  );

  // Scoped to the chart's own wrapper — the innermost element containing the
  // plot — then its first span, which is the OHLC row's date. A page-wide
  // class selector matched the back-link instead and reported "unchanged" no
  // matter what the chart did, which passed happily against a broken build.
  const readoutDate = page
    .locator("div", {
      has: page.locator('div[role="img"][aria-label*="Daily price chart"]'),
    })
    .last()
    .locator("span")
    .first();

  // Read the date under a fixed point while the request is still in flight.
  //
  // The nudge away first is not superstition: the second call would otherwise
  // move the pointer to where it already is, which fires no mousemove, leaves
  // the crosshair where it was, and returns the *previous* reading. That made
  // this assertion compare a value against itself and pass against a build
  // with the compensation deleted.
  const dateUnderProbe = async () => {
    await page.mouse.move(probeX + 60, midY);
    await page.waitForTimeout(80);
    await page.mouse.move(probeX, midY);
    await page.waitForTimeout(150);
    return readoutDate.textContent();
  };
  await page.waitForTimeout(300);
  const dateBefore = await dateUnderProbe();

  await expect(loader).toBeHidden({ timeout: 15_000 });
  const after = await sessions();
  expect(
    after,
    "panning to the left edge did not load any earlier sessions",
  ).toBeGreaterThan(before);

  // THE invariant. Prepending shifts every logical index, so a chart that does
  // not compensate slides the user a whole page backwards at the exact moment
  // they are mid-pan. The bar under a fixed screen position must be the same
  // bar it was before the data landed.
  const dateAfter = await dateUnderProbe();
  expect(
    dateAfter,
    "the view moved when older bars were prepended",
  ).toBe(dateBefore);
});

test("the chart reports how much history it holds", async ({
  signedIn: page,
}) => {
  await page.goto("/company/AAPL");
  const chart = page.locator(CHART);
  await expect(chart).toBeVisible();

  const label = (await chart.getAttribute("aria-label")) ?? "";
  test.skip(
    !/\d+ sessions/.test(label),
    "no live market data available in this environment",
  );

  // The count is the only signal a screen reader gets that panning did
  // anything, since the canvas itself is a single role="img".
  await expect(page.getByText(/\d+ sessions/)).toBeVisible();
});
