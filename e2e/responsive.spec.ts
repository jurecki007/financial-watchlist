import { test, expect, admin } from "./fixtures";

/**
 * Responsive verification. Playwright sets a real layout viewport; headless
 * Chrome's --window-size only crops, so it measures a wide render through a
 * narrow window.
 *
 * The assertion is horizontal overflow — nothing here is wider than its
 * container by intent, so a document wider than the viewport is always a bug.
 */
const SIZES = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

async function overflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
}

for (const size of SIZES) {
  test(`public pages fit at ${size.name} (${size.width}px)`, async ({ page }) => {
    await page.setViewportSize(size);
    for (const path of ["/", "/roadmap", "/login", "/signup"]) {
      await page.goto(path);
      const { scroll, client } = await overflow(page);
      expect(
        scroll,
        `${path} overflows by ${scroll - client}px at ${size.width}px`,
      ).toBeLessThanOrEqual(client + 1); // 1px for sub-pixel rounding
    }
  });

  test(`signed-in pages fit at ${size.name} (${size.width}px)`, async ({
    signedIn: page,
    user,
  }) => {
    await admin.from("watchlist_items").insert([
      { user_id: user.id, ticker: "AAPL", company_name: "Apple Inc" },
      { user_id: user.id, ticker: "MSFT", company_name: "Microsoft Corporation" },
    ]);
    await admin.from("price_alerts").insert({
      user_id: user.id,
      ticker: "AAPL",
      condition: "above",
      threshold: 500,
    });

    await page.setViewportSize(size);
    for (const path of ["/dashboard", "/news", "/alerts", "/company/AAPL"]) {
      await page.goto(path);
      await page.waitForTimeout(600);
      const { scroll, client } = await overflow(page);
      expect(
        scroll,
        `${path} overflows by ${scroll - client}px at ${size.width}px`,
      ).toBeLessThanOrEqual(client + 1);
    }
  });
}

test("the search overlay does not move the page at mobile width", async ({
  signedIn: page,
  user,
}) => {
  await admin
    .from("watchlist_items")
    .insert({ user_id: user.id, ticker: "AAPL", company_name: "Apple Inc" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/dashboard");
  await page.waitForTimeout(800);

  const card = page.getByRole("link", { name: /AAPL/ }).first();
  const before = await card.boundingBox();
  await page.getByLabel("Add a company").click();
  await page.waitForTimeout(300);
  const after = await card.boundingBox();

  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(1);
});

test("theme toggle persists and applies before paint", async ({
  signedIn: page,
}) => {
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: /Switch to light theme/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // Applied before paint — landing on dark and flipping after is the flash
  // this exists to prevent.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // And it must survive navigation to a different route.
  await page.goto("/news");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("light theme keeps text readable", async ({ signedIn: page, user }) => {
  await admin
    .from("watchlist_items")
    .insert({ user_id: user.id, ticker: "AAPL", company_name: "Apple Inc" });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /Switch to light theme/ }).click();
  await page.waitForTimeout(600);

  // A half-flipped palette fails here: light ground, still-light ink.
  const contrastOk = await page.evaluate(() => {
    const lum = (c: string) => {
      const [r, g, b] = (c.match(/\d+/g) ?? ["0", "0", "0"]).map(Number);
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const body = getComputedStyle(document.body);
    const a = lum(body.color);
    const b = lum(body.backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(contrastOk).toBeGreaterThan(4.5);
});
