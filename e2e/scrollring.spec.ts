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

test("making the list taller adds nodes and fills the new space", async ({
  page,
}) => {
  await page.goto("/demo/");
  const nodes = page.locator("#list .scroll-row");
  const before = await nodes.count();

  await page.locator("#list").evaluate((el) => {
    el.style.height = "800px";
    el.scrollTop = 40 * 5000; // rows from 5000 on, 40px each
  });

  // ResizeObserver runs after layout, so wait for the pool to grow.
  await expect.poll(() => nodes.count()).toBeGreaterThan(before);
  // clientHeight 798 (1px borders): visible rows 5000..5019, window
  // 4950..5069 = 120 rows. The old pool (111) would stop at index 5060, so
  // index 5069 ("Row 5070") is only drawn if the pool really grew.
  await expect(page.getByText("Row 5070", { exact: true })).toBeVisible();
});
