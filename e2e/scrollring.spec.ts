import { test, expect } from "@playwright/test";

const setScroll = (page, top: number) =>
  page.locator("#list").evaluate((el, t) => {
    el.scrollTop = t;
  }, top);

test("DOM node count stays plat while scrolling 100k rows", async ({
  page,
}) => {
  await page.goto("/demo/");
  const all = page.locator("#list .scroll-row");
  const total = await all.count();

  for (const top of [0, 5_000, 400_000, 3_999_000]) {
    await setScroll(page, top);
    await page.locator("#list").evaluate((el, t) => {
      el.scrollTop = t;
    }, top);

    expect(await all.count()).toBe(total);
  }
});

test("the last row is reachable and visible", async ({ page }) => {
  await page.goto("/demo/");
  await page.locator("#list").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(page.getByText("Row 100000")).toBeVisible();
});

test("scrolling to the middle shows rows near the middle", async ({ page }) => {
  await page.goto("/demo/");
  await page.locator("#list").evaluate((el) => {
    el.scrollTop = el.scrollHeight / 2;
  });
  // The scroll event is async, so poll until the list has repainted.
  await expect
    .poll(async () => {
      const text = await page
        .locator("#list .scroll-row:visible")
        .first()
        .textContent();
      return Number(text!.replace("Row ", ""));
    })
    .toBeGreaterThan(49_900);
});
