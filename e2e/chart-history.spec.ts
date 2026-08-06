import { test, expect } from "./fixtures";

/**
 * Paging older candles in on scroll. The assertion that matters is not "more
 * bars arrived" but "more bars arrived and the view stayed where it was put":
 * prepending shifts every logical index, so a chart that does not compensate
 * jumps a whole page backwards mid-pan.
 *
 * Skipped without provider credentials — a missing key is an environment fact,
 * not a regression.
 */

const CHART = 'div[role="img"][aria-label*="Daily price chart"]';

test("panning to the left edge loads earlier sessions without moving the view", async ({
  signedIn: page,
}) => {
  await page.goto("/company/AAPL");

  const chart = page.locator(CHART);
  await expect(chart).toBeVisible();

  // Without a key the page renders the misconfigured state, not a chart.
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

  // Hold the response open, or the fetch resolves inside one pan and there is
  // no observable "before" to compare against.
  await page.route("**/api/candles**", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });

  // Drag rather than setting the logical range, which would bypass the
  // subscription under test.
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

  // Scoped to the chart's own wrapper: a page-wide selector matched the
  // back-link and reported "unchanged" against a broken build.
  const readoutDate = page
    .locator("div", {
      has: page.locator('div[role="img"][aria-label*="Daily price chart"]'),
    })
    .last()
    .locator("span")
    .first();

  // Nudge away first: moving the pointer to where it already is fires no
  // mousemove, so the read would return the previous value.
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

  // The invariant: the bar under a fixed screen position must be the same bar
  // it was before the data landed.
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

  // The canvas is a single role="img", so the count is the only signal a
  // screen reader gets that panning did anything.
  await expect(page.getByText(/\d+ sessions/)).toBeVisible();
});
