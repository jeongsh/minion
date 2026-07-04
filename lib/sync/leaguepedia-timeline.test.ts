import assert from "node:assert/strict";
import test from "node:test";

import { parseLeaguepediaTimelineEvents } from "./leaguepedia-timeline.ts";

test("parses kills, objectives, and buildings with participant identities", () => {
  const participants = new Map([
    [1, { playerId: "blue-top", teamId: "blue" }],
    [6, { playerId: "red-top", teamId: "red" }],
  ]);
  const rows = parseLeaguepediaTimelineEvents({ frames: [{ timestamp: 60_000, events: [
    { type: "CHAMPION_KILL", timestamp: 61_000, killerId: 1, victimId: 6, assistingParticipantIds: [] },
    { type: "ELITE_MONSTER_KILL", timestamp: 62_000, killerId: 1, killerTeamId: 100, monsterType: "DRAGON" },
    { type: "BUILDING_KILL", timestamp: 63_000, killerId: 1, teamId: 200, buildingType: "TOWER_BUILDING", laneType: "TOP_LANE" },
  ] }] }, "set", "blue", "red", participants);

  assert.equal(rows.length, 3);
  assert.equal(rows[0].killer_player_id, "blue-top");
  assert.equal(rows[0].victim_player_id, "red-top");
  assert.equal(rows[1].team_id, "blue");
  assert.equal(rows[2].team_id, "blue");
});
