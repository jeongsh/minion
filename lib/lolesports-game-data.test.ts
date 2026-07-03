import assert from "node:assert/strict";
import { test } from "node:test";

import { dragonCounts, parseLolesportsGameData } from "./lolesports-game-data.ts";

test("parses nullable live stats into a final set result", () => {
  const parsed = parseLolesportsGameData(
    { frames: [{ rfc460Timestamp: "2026-07-03T05:00:00Z" }] },
    {
      gameMetadata: {
        patchVersion: "16.13.790.1",
        blueTeamMetadata: { esportsTeamId: "blue", participantMetadata: [{ participantId: 1, championId: "Ahri" }] },
      },
      frames: [{
        rfc460Timestamp: "2026-07-03T05:30:00Z",
        blueTeam: { totalGold: 60000, participants: [{ participantId: 1, kills: 5 }] },
      }],
    },
    { frames: [{ rfc460Timestamp: "2026-07-03T05:30:00Z", participants: [{ participantId: 1, championDamageShare: 0.4 }] }] },
  );
  assert.equal(parsed.patch, "26.13");
  assert.equal(parsed.durationSeconds, 1800);
  assert.equal(parsed.participants[0]?.window?.kills, 5);
  assert.equal(parsed.participants[0]?.detail?.championDamageShare, 0.4);
});

test("counts known dragon types and ignores missing values", () => {
  assert.deepEqual(dragonCounts(["cloud", "ocean", "ocean", null]), {
    total: 3, clouds: 1, infernals: 0, mountains: 0, oceans: 2,
    hextechs: 0, chemtechs: 0, elders: 0,
  });
});
