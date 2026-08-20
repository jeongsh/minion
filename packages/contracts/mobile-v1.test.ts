import assert from "node:assert/strict";
import test from "node:test";

import { matchMobileRoute, mobileApiRoutes, toMobileDeepLink } from "./src/mobile-v1.ts";

test("mobile API route allow-list is versioned and excludes web-only surfaces", () => {
  const paths = Object.values(mobileApiRoutes).map(route => route.path);
  assert.ok(paths.every(path => path.startsWith("/api/mobile/v1/")));
  assert.ok(paths.every(path => !path.startsWith("/api/mobile/v1/admin") && !path.startsWith("/api/mobile/v1/reports")));
});

test("dock activation follows the current compact navigation policy", () => {
  assert.equal(matchMobileRoute("/")?.dockTab, "home");
  assert.equal(matchMobileRoute("/matches/match-1")?.dockTab, "matches");
  assert.equal(matchMobileRoute("/tournaments/regular")?.dockTab, "matches");
  assert.equal(matchMobileRoute("/predictions")?.dockTab, "matches");
  assert.equal(matchMobileRoute("/fan/t1/videos")?.dockTab, "fan");
  assert.equal(matchMobileRoute("/fan/t1/schedule")?.params.section, "schedule");
  assert.equal(matchMobileRoute("/fan/t1/social")?.params.section, "social");
  assert.equal(matchMobileRoute("/search")?.screen, "search");
  assert.equal(matchMobileRoute("/teams/t1")?.dockTab, "teams");
  assert.equal(matchMobileRoute("/news/article")?.dockTab, "news");
});

test("focus and post-detail routes carry navigation behavior", () => {
  assert.deepEqual(matchMobileRoute("/community/post/post-1"), {
    screen: "community-post",
    params: { postId: "post-1" },
    dockTab: null,
    hideGlobalDock: true,
    focus: false,
  });
  assert.equal(matchMobileRoute("/fan/t1/community/post/post-1/edit")?.fallbackPath, "/fan/t1/community/post/post-1");
  assert.equal(matchMobileRoute("/fan/t1/community/new")?.screen, "community-compose");
  assert.equal(matchMobileRoute("/fan/t1/community/new")?.focus, true);
  assert.equal(matchMobileRoute("/me/settings")?.fallbackPath, "/me");
});

test("web-only and unknown routes do not produce app deep links", () => {
  assert.equal(matchMobileRoute("/admin"), null);
  assert.equal(matchMobileRoute("/reports/2026-w10"), null);
  assert.equal(toMobileDeepLink("/not-a-real-route"), null);
  assert.equal(toMobileDeepLink("/matches/a%2Fb"), "minion://app/matches/a%2Fb");
});
