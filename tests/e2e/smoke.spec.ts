import { expect, test } from "@playwright/test";

test("static content pages render inside the app shell", async ({ page }) => {
  await page.goto("/about");
  await expect(page.locator("body")).toContainText("MINION");
  await expect(page.locator("main")).toBeVisible();

  await page.goto("/privacy");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("body")).toContainText(/MINION|privacy/i);
});

test("blocked application surfaces return a page instead of a server crash", async ({ page }) => {
  const response = await page.goto("/admin");
  expect(response?.status()).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
});
