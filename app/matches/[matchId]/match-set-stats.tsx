import Image from "next/image";

import { championImage, championLabel } from "@/lib/champions";
import { spellImageUrlById, type GameSpell } from "@/lib/spells";
import type { Champion, Player, PlayerStatLine, SetResult, Team } from "@/lib/types";
import { PlayerItemSlots } from "./player-item-slots";

const POSITION_ORDER: Record<string, number> = { TOP: 0, JGL: 1, MID: 2, BOT: 3, SUP: 4 };

function kdaRatio(line: PlayerStatLine) {
  if (line.deaths === 0) return "Perfect";
  return ((line.kills + line.assists) / line.deaths).toFixed(2) + ":1";
}

function killParticipation(line: PlayerStatLine, teamKills: number) {
  if (teamKills === 0) return 0;
  return Math.round(((line.kills + line.assists) / teamKills) * 100);
}

function SpellSlot({ spellId, spells, version }: { spellId: number | null; spells: GameSpell[]; version: string }) {
  const url = spellImageUrlById(spells, spellId ?? undefined, version);
  if (!url) return <div className="h-4 w-4 rounded border border-border bg-surface-muted" />;
  return (
    <div className="relative h-4 w-4 overflow-hidden rounded border border-border">
      <Image src={url} alt="" fill sizes="16px" className="object-cover" />
    </div>
  );
}

function PlayerRow({
  line,
  player,
  champion,
  teamKills,
  maxDamage,
  spells,
  itemVersion,
  side,
}: {
  line: PlayerStatLine;
  player?: Player;
  champion?: Champion;
  teamKills: number;
  maxDamage: number;
  spells: GameSpell[];
  itemVersion: string;
  side: "blue" | "red";
}) {
  const img = championImage(champion);
  const kp = killParticipation(line, teamKills);
  const dmgPct = maxDamage > 0 ? (line.damageToChampions / maxDamage) * 100 : 0;
  const csm = line.gameMinutes > 0 ? (line.cs / line.gameMinutes).toFixed(1) : "-";
  const barColor = side === "blue" ? "bg-blue-500" : "bg-red-500";

  return (
    <div className="grid min-w-[760px] grid-cols-[220px_1fr_140px_50px_70px_220px] items-center gap-3 border-t border-border px-3 py-2.5">
      {/* 챔피언 + 스펠 + 선수 */}
      <div className="flex items-center gap-2">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
          {img && <Image src={img} alt={championLabel(champion)} fill sizes="48px" className="object-cover" />}
        </div>
        <div className="flex flex-col gap-0.5">
          <SpellSlot spellId={line.spellIds[0] ?? null} spells={spells} version={itemVersion} />
          <SpellSlot spellId={line.spellIds[1] ?? null} spells={spells} version={itemVersion} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{player?.name ?? "-"}</p>
          <p className="truncate text-[11px] text-muted">{champion?.name ?? "-"}</p>
        </div>
      </div>

      {/* KDA */}
      <div>
        <p className="text-sm font-semibold tabular-nums">
          {line.kills} / <span className="text-red-400">{line.deaths}</span> / {line.assists}
        </p>
        <p className="text-[11px] text-muted">
          {kdaRatio(line)} &nbsp;
          <span className="font-semibold text-foreground/70">({kp}%)</span>
        </p>
      </div>

      {/* 딜량 + 바 */}
      <div>
        <p className="text-sm tabular-nums font-semibold">{line.damageToChampions.toLocaleString("ko-KR")}</p>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${dmgPct}%` }} />
        </div>
      </div>

      {/* 시야 */}
      <div className="text-center">
        <p className="text-sm font-semibold tabular-nums">{line.visionScore}</p>
        <p className="text-[10px] text-muted">시야</p>
      </div>

      {/* CS */}
      <div className="text-center">
        <p className="text-sm font-semibold tabular-nums">{line.cs}</p>
        <p className="text-[10px] text-muted">분 {csm}</p>
      </div>

      {/* 아이템 */}
      <PlayerItemSlots
        itemIds={line.itemIds}
        roleBoundItem={line.roleBoundItem}
        version={itemVersion}
        slotClassName="h-6 w-6"
        separatorClassName="h-4 w-px"
        imageSizes="24px"
      />
    </div>
  );
}

function ComparisonBar({
  label,
  blueValue,
  redValue,
  format,
}: {
  label: string;
  blueValue: number;
  redValue: number;
  format?: (v: number) => string;
}) {
  const total = blueValue + redValue;
  const bluePct = total > 0 ? (blueValue / total) * 100 : 50;
  const fmt = format ?? ((v) => v.toLocaleString("ko-KR"));

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center py-1.5">
      {/* 블루 영역: 숫자 + 막대가 오른쪽 정렬로 공간 채움 */}
      <div className="flex items-center justify-end gap-2 pl-3 pr-2">
        <span className="shrink-0 text-sm font-bold tabular-nums text-blue-500">{fmt(blueValue)}</span>
        <div className="h-4 flex-1 overflow-hidden rounded-l-full bg-surface-muted">
          <div className="ml-auto h-full rounded-l-full bg-blue-500" style={{ width: `${bluePct}%` }} />
        </div>
      </div>
      <span className="shrink-0 px-3 text-[11px] font-semibold text-muted">{label}</span>
      {/* 레드 영역: 막대 + 숫자가 왼쪽 정렬로 공간 채움 */}
      <div className="flex items-center gap-2 pl-2 pr-3">
        <div className="h-4 flex-1 overflow-hidden rounded-r-full bg-surface-muted">
          <div className="h-full rounded-r-full bg-red-500" style={{ width: `${100 - bluePct}%` }} />
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-red-400">{fmt(redValue)}</span>
      </div>
    </div>
  );
}

function TeamSection({
  set,
  lines,
  players,
  champions,
  teams,
  spells,
  itemVersion,
  side,
}: {
  set: SetResult;
  lines: PlayerStatLine[];
  players: Player[];
  champions: Champion[];
  teams: Team[];
  spells: GameSpell[];
  itemVersion: string;
  side: "blue" | "red";
}) {
  const teamId = side === "blue" ? set.blueTeamId : set.redTeamId;
  const teamLines = lines
    .filter((l) => l.teamId === teamId)
    .sort((a, b) => (POSITION_ORDER[a.position] ?? 9) - (POSITION_ORDER[b.position] ?? 9));
  const team = teams.find((t) => t.id === teamId);
  const won = set.winnerTeamId === teamId;
  const teamKills = teamLines.reduce((s, l) => s + l.kills, 0);
  const maxDamage = Math.max(...teamLines.map((l) => l.damageToChampions), 1);
  const headerBg = side === "blue" ? "bg-blue-500/10" : "bg-red-500/10";
  const headerText = side === "blue" ? "text-blue-600" : "text-red-500";
  return (
    <div>
      {/* 팀 헤더 */}
      <div className={`flex items-center gap-3 px-3 py-2 ${headerBg}`}>
        <span className={`text-sm font-bold ${headerText}`}>{team?.shortName ?? (side === "blue" ? "블루" : "레드")}</span>
        {won && (
          <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-foreground">승</span>
        )}
        <div className="ml-auto" />
        {/* 컬럼 레이블 */}
        <div className="hidden min-w-[760px] grid-cols-[220px_1fr_140px_50px_70px_220px] gap-3 text-[10px] font-semibold uppercase text-muted md:grid">
          <span />
          <span>KDA</span>
          <span>딜량</span>
          <span className="text-center">시야</span>
          <span className="text-center">CS</span>
          <span>아이템</span>
        </div>
      </div>
      {/* 선수 행 */}
      <div className="overflow-x-auto">
        {teamLines.map((line) => (
          <PlayerRow
            key={line.playerId}
            line={line}
            player={players.find((p) => p.id === line.playerId)}
            champion={champions.find((c) => c.id === line.championId)}
            teamKills={teamKills}
            maxDamage={maxDamage}
            spells={spells}
            itemVersion={itemVersion}
            side={side}
          />
        ))}
      </div>
    </div>
  );
}

function SetScoreboard({
  set,
  lines,
  players,
  champions,
  teams,
  spells,
  itemVersion,
}: {
  set: SetResult;
  lines: PlayerStatLine[];
  players: Player[];
  champions: Champion[];
  teams: Team[];
  spells: GameSpell[];
  itemVersion: string;
}) {
  const blueLines = lines.filter((l) => l.teamId === set.blueTeamId);
  const redLines = lines.filter((l) => l.teamId === set.redTeamId);
  const blueKills = blueLines.reduce((s, l) => s + l.kills, 0);
  const redKills = redLines.reduce((s, l) => s + l.kills, 0);
  const blueGold = blueLines.reduce((s, l) => s + l.gold, 0);
  const redGold = redLines.reduce((s, l) => s + l.gold, 0);
  const hasData = lines.length > 0;
  const blueTeam = teams.find((t) => t.id === set.blueTeamId);
  const redTeam = teams.find((t) => t.id === set.redTeamId);

  return (
    <details className="group overflow-hidden rounded-md border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 hover:bg-surface-muted">
        <span className="text-sm font-semibold">{set.setNumber}세트</span>
        {set.durationSeconds ? (
          <span className="text-xs text-muted">
            {Math.floor(set.durationSeconds / 60)}:{String(set.durationSeconds % 60).padStart(2, "0")}
          </span>
        ) : null}
        <span className="text-xs font-semibold text-blue-500">{blueTeam?.shortName ?? "블루"}</span>
        <span className="text-xs text-muted">
          {set.blueKills ?? "-"} : {set.redKills ?? "-"}
        </span>
        <span className="text-xs font-semibold text-red-500">{redTeam?.shortName ?? "레드"}</span>
        {!hasData && <span className="text-xs text-muted">데이터 없음</span>}
        <span className="ml-auto text-xs text-muted transition-transform group-open:rotate-180">▼</span>
      </summary>

      {hasData ? (
        <>
          <TeamSection set={set} lines={lines} players={players} champions={champions} teams={teams} spells={spells} itemVersion={itemVersion} side="blue" />

          {/* 팀 비교 바 */}
          <div className="border-y border-border bg-surface-muted py-1">
            <ComparisonBar label="Total Kill" blueValue={blueKills} redValue={redKills} />
            <ComparisonBar
              label="Total Gold"
              blueValue={blueGold}
              redValue={redGold}
              format={(v) => `${(v / 1000).toFixed(1)}K`}
            />
          </div>

          <TeamSection set={set} lines={lines} players={players} champions={champions} teams={teams} spells={spells} itemVersion={itemVersion} side="red" />
        </>
      ) : (
        <div className="border-t border-border px-3 py-6 text-center text-sm text-muted">선수 스탯 데이터가 없습니다.</div>
      )}
    </details>
  );
}

export function MatchSetStats({
  sets,
  statLines,
  players,
  champions,
  teams,
  spells,
  itemVersion,
}: {
  sets: SetResult[];
  statLines: PlayerStatLine[];
  players: Player[];
  champions: Champion[];
  teams: Team[];
  spells: GameSpell[];
  itemVersion: string;
}) {
  if (sets.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface p-4 text-sm text-muted">
        세트 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sets.map((set) => (
        <SetScoreboard
          key={set.id}
          set={set}
          lines={statLines.filter((l) => l.setId === set.id)}
          players={players}
          champions={champions}
          teams={teams}
          spells={spells}
          itemVersion={itemVersion}
        />
      ))}
    </div>
  );
}
