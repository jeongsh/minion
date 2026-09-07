import assert from "node:assert/strict";
import test from "node:test";

import {
  activeFavoriteTeamCooldown,
  favoriteTeamConfirmationMessage,
  favoriteTeamCooldownFromError,
  favoriteTeamCooldownMessage,
  nextFavoriteTeamChangeAvailableAt,
} from "./favorite-team-cooldown.ts";

test("최애팀 변경 가능 시각은 변경 시점으로부터 정확히 7일 뒤다", () => {
  assert.equal(nextFavoriteTeamChangeAvailableAt(Date.UTC(2026, 8, 7)), "2026-09-14T00:00:00.000Z");
});

test("아직 끝나지 않은 제한만 활성 상태로 반환한다", () => {
  assert.equal(activeFavoriteTeamCooldown("2026-09-14T00:00:00.000Z", Date.UTC(2026, 8, 7)), "2026-09-14T00:00:00.000Z");
  assert.equal(activeFavoriteTeamCooldown("2026-09-06T00:00:00.000Z", Date.UTC(2026, 8, 7)), null);
  assert.equal(activeFavoriteTeamCooldown("invalid", Date.UTC(2026, 8, 7)), null);
});

test("차단 안내에는 한국 시각의 변경 가능 시점이 포함된다", () => {
  assert.equal(
    favoriteTeamCooldownMessage("2026-09-14T00:00:00.000Z"),
    "2026년 9월 14일 오전 9:00까지 최애팀을 선택·변경·해제할 수 없습니다.",
  );
});

test("선택과 해제 확인 문구에 7일 제한을 명시한다", () => {
  assert.match(favoriteTeamConfirmationMessage("T1", true), /설정 후 7일 동안/);
  assert.match(favoriteTeamConfirmationMessage("T1", false), /해제 후 7일 동안/);
});

test("DB 트리거 오류에서 제한 시각을 복원한다", () => {
  assert.equal(
    favoriteTeamCooldownFromError({ message: "FAVORITE_TEAM_CHANGE_COOLDOWN", details: "2026-09-14T00:00:00.000Z" }),
    "2026-09-14T00:00:00.000Z",
  );
});
