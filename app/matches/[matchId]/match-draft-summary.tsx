import type { Champion, Player, PlayerStatLine, SetPickBan, SetResult, Team } from "@/lib/types";
import type { GameSpell } from "@/lib/spells";
import { DEFAULT_DDRAGON_VERSION, ddragonVersionFromPatch } from "@/lib/ddragon";
import type { TimelineEvent } from "@/lib/data/lck";
import { SetCard } from "./set-card";

export function MatchDraftSummary({
  sets,
  picksBans,
  champions,
  teams,
  statLines,
  players,
  spellsByVersion,
  runeImagesByVersion,
  pomPlayerId,
  timelineEventsBySetId,
}: {
  sets: SetResult[];
  picksBans: SetPickBan[];
  champions: Champion[];
  teams: Team[];
  statLines: PlayerStatLine[];
  players: Player[];
  spellsByVersion: Record<string, GameSpell[]>;
  runeImagesByVersion: Record<string, Record<string, string>>;
  pomPlayerId?: string | null;
  timelineEventsBySetId?: Record<string, TimelineEvent[]>;
}) {
  if (sets.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface p-4 text-sm text-muted">
        밴픽 데이터가 아직 연결되지 않았습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sets.map((set) => {
        const setPicksBans = picksBans.filter((p) => p.setId === set.id);
        const blueBans = setPicksBans.filter((p) => p.side === "blue" && p.actionType === "ban");
        const bluePicks = setPicksBans.filter((p) => p.side === "blue" && p.actionType === "pick");
        const redBans = setPicksBans.filter((p) => p.side === "red" && p.actionType === "ban");
        const redPicks = setPicksBans.filter((p) => p.side === "red" && p.actionType === "pick");
        const blueTeam = teams.find((t) => t.id === set.blueTeamId);
        const redTeam = teams.find((t) => t.id === set.redTeamId);
        const blueTeamName = blueTeam?.shortName ?? "블루";
        const redTeamName = redTeam?.shortName ?? "레드";
        const blueWon = set.winnerTeamId === set.blueTeamId;
        const redWon = set.winnerTeamId === set.redTeamId;
        const hasPickBan = setPicksBans.length > 0;
        const setStatLines = statLines.filter((l) => l.setId === set.id);
        const itemVersion = ddragonVersionFromPatch(set.patch);
        const spells = spellsByVersion[itemVersion] ?? spellsByVersion[DEFAULT_DDRAGON_VERSION] ?? [];
        const runeImages = runeImagesByVersion[itemVersion] ?? runeImagesByVersion[DEFAULT_DDRAGON_VERSION] ?? {};

        return (
          <SetCard
            key={set.id}
            set={set}
            blueBans={blueBans}
            bluePicks={bluePicks}
            redBans={redBans}
            redPicks={redPicks}
            blueTeamName={blueTeamName}
            redTeamName={redTeamName}
            blueWon={blueWon}
            redWon={redWon}
            hasPickBan={hasPickBan}
            champions={champions}
            statLines={setStatLines}
            players={players}
            teams={teams}
            spells={spells}
            itemVersion={itemVersion}
            runeImages={runeImages}
            pomPlayerId={pomPlayerId}
            timelineEvents={timelineEventsBySetId?.[set.id] ?? []}
          />
        );
      })}
    </div>
  );
}
