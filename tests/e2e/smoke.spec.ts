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

test("mobile fan pages keep global and local navigation distinct", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/fan/t1/matches");

  const globalNav = page.getByRole("navigation", { name: "모바일 주요 메뉴" });
  await expect(globalNav).toBeVisible();
  await expect(globalNav.getByRole("link", { name: "팬", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(globalNav.getByRole("link", { name: "매치", exact: true })).not.toHaveAttribute("aria-current", "page");

  const localNav = page.getByRole("navigation", { name: "팬페이지 로컬 메뉴" });
  await expect(localNav).toBeVisible();
  await expect(page.locator("header.fixed").first().getByRole("link", { name: "MINION 메인으로 이동" })).toBeVisible();
  await expect(page.locator("header.fixed").first().getByRole("button", { name: /최애팀/ })).toHaveCount(0);
  await expect(localNav.getByRole("link", { name: "일정", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(localNav.getByRole("link", { name: "커뮤니티", exact: true })).toBeVisible();
  await expect(localNav.getByRole("link", { name: "기록", exact: true })).toHaveCount(0);
  await expect(globalNav.getByRole("link")).toHaveCount(5);
  await expect(globalNav.getByRole("link", { name: "뉴스", exact: true })).toBeVisible();
  await expect(globalNav.getByRole("link", { name: "피드", exact: true })).toHaveCount(0);

  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  const mainHubNav = page.getByRole("navigation", { name: "허브 로컬 메뉴" });
  await expect(mainHubNav.getByRole("link", { name: "메인", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(mainHubNav.getByRole("link", { name: "메인", exact: true })).toHaveCSS("color", "rgb(3, 222, 138)");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true);
  await page.getByRole("button", { name: "색상 모드 전환" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  const primaryHeader = page.locator("header.fixed").first();
  await page.evaluate(() => window.scrollTo(0, 800));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await expect(primaryHeader).toHaveClass(/-translate-y-full/);
  await expect(page.locator("[data-app-shell]")).toHaveCSS("--shell-mobile-header-offset", "0px");
  await page.evaluate(() => window.scrollTo(0, 300));
  await expect(primaryHeader).toHaveClass(/translate-y-0/);
});

test("team dock opens the team media explorer instead of a detail page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/teams?team=t1");

  await expect(page.getByRole("heading", { name: "팀 둘러보기" })).toBeVisible();
  await expect(page.getByRole("link", { name: /T1/ }).first()).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("heading", { name: "최신 소셜 피드" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "최신 영상" })).toBeVisible();
  await expect(page.getByRole("link", { name: /팬페이지/ })).toHaveAttribute("href", "/fan/t1");

  await page.goto("/fan/t1");
  await expect(page.getByRole("button", { name: /T1 최애팀 (설정|해제)/ }).first()).toBeVisible();
});

test("mobile hub local navigation and schedule date bar share the header offset", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/schedule");

  await expect(page.getByRole("button", { name: "내비게이션 열기" })).toBeHidden();
  const hubNav = page.getByRole("navigation", { name: "허브 로컬 메뉴" });
  const dateBar = page.locator(".schedule-mobile-sticky");
  await expect(hubNav).toBeVisible();
  await expect(hubNav.getByRole("link", { name: "메인", exact: true })).toBeVisible();
  await expect(hubNav.getByRole("link", { name: "대회", exact: true })).toBeVisible();
  await expect(hubNav.getByRole("link", { name: "승부예측", exact: true })).toBeVisible();
  await expect(hubNav.getByRole("link", { name: "커뮤니티", exact: true })).toBeVisible();
  await expect(hubNav.getByRole("link", { name: "피드", exact: true })).toHaveCount(0);
  await expect(hubNav.getByRole("link", { name: "리포트", exact: true })).toHaveCount(0);
  await expect(dateBar).toHaveCSS("top", "104px");

  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await expect(hubNav).toHaveCSS("top", "0px");
  await expect(dateBar).toHaveCSS("top", "48px");

  await page.mouse.wheel(0, -300);
  await expect(hubNav).toHaveCSS("top", "56px");
  await expect(dateBar).toHaveCSS("top", "104px");
});
