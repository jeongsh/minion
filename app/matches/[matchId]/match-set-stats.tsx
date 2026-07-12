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
  if (!url) return <div className="h-8 w-8 rounded border border-border bg-surface-muted" />;
  return (
    <div className="relative h-8 w-8 overflow-hidden rounded border border-border">
      <Image src={url} alt="" fill sizes="32px" className="object-cover" />
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
  const barColor = side === "blue" ? "bg-team-blue" : "bg-team-red";

  const championBlock = (
    <div className="flex min-w-0 items-center gap-2">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
        {img && <Image src={img} alt={championLabel(champion)} fill sizes="48px" className="object-cover" />}
      </div>
      <div className="flex shrink-0 flex-col gap-0.5">
        <SpellSlot spellId={line.spellIds[0] ?? null} spells={spells} version={itemVersion} />
        <SpellSlot spellId={line.spellIds[1] ?? null} spells={spells} version={itemVersion} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold">{player?.name ?? "-"}</p>
        <p className="truncate text-[15px] text-muted">{champion?.name ?? "-"}</p>
      </div>
    </div>
  );

  return (
    <div className="border-t border-border px-3 py-2.5">
      {/* 모바일: 세로로 쌓아서 가로 스크롤 없이 보이게 */}
      <div className="flex flex-col gap-2.5 lg:hidden">
        {championBlock}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-[15px] font-semibold tabular-nums">
              {line.kills}/<span className="text-red-400">{line.deaths}</span>/{line.assists}
            </p>
            <p className="text-[15px] text-muted">{kdaRatio(line)} ({kp}%)</p>
          </div>
          <div>
            <p className="text-[15px] tabular-nums font-semibold">{line.damageToChampions.toLocaleString("ko-KR")}</p>
            <p className="text-[15px] text-muted">딜량</p>
          </div>
          <div>
            <p className="text-[15px] font-semibold tabular-nums">{line.visionScore}</p>
            <p className="text-[15px] text-muted">시야</p>
          </div>
          <div>
            <p className="text-[15px] font-semibold tabular-nums">{line.cs}</p>
            <p className="text-[15px] text-muted">분 {csm}</p>
          </div>
        </div>
        <PlayerItemSlots
          itemIds={line.itemIds}
          roleBoundItem={line.roleBoundItem}
          version={itemVersion}
          className="flex-wrap justify-center"
          slotClassName="h-7 w-7"
          separatorClassName="h-4 w-px"
          imageSizes="28px"
        />
      </div>

      {/* 데스크톱: 고정 컬럼 그리드 */}
      <div className="hidden lg:grid lg:grid-cols-[220px_1fr_140px_50px_70px_220px] lg:items-center lg:gap-3">
        {championBlock}

        {/* KDA */}
        <div>
          <p className="text-[15px] font-semibold tabular-nums">
            {line.kills} / <span className="text-red-400">{line.deaths}</span> / {line.assists}
          </p>
          <p className="text-[15px] text-muted">
            {kdaRatio(line)} &nbsp;
            <span className="font-semibold text-foreground/70">({kp}%)</span>
          </p>
        </div>

        {/* 딜량 + 바 */}
        <div>
          <p className="text-[15px] tabular-nums font-semibold">{line.damageToChampions.toLocaleString("ko-KR")}</p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${dmgPct}%` }} />
          </div>
        </div>

        {/* 시야 */}
        <div className="text-center">
          <p className="text-[15px] font-semibold tabular-nums">{line.visionScore}</p>
          <p className="text-[15px] text-muted">시야</p>
        </div>

        {/* CS */}
        <div className="text-center">
          <p className="text-[15px] font-semibold tabular-nums">{line.cs}</p>
          <p className="text-[15px] text-muted">분 {csm}</p>
        </div>

        {/* 아이템 */}
        <PlayerItemSlots
          itemIds={line.itemIds}
          roleBoundItem={line.roleBoundItem}
          version={itemVersion}
          slotClassName="h-8 w-8"
          separatorClassName="h-5 w-px"
          imageSizes="32px"
        />
      </div>
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
      {/* 블루 영역: 숫자 + 막대가 오른쪽 정렬로 공간 채움 (선수스탯 딜량 바와 동일 디자인) */}
      <div className="flex items-center justify-end gap-2 pl-3 pr-2">
        <span className="shrink-0 text-[15px] font-semibold tabular-nums">{fmt(blueValue)}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-l-full bg-surface-muted">
          <div className="ml-auto h-full rounded-l-full bg-team-blue" style={{ width: `${bluePct}%` }} />
        </div>
      </div>
      <span className="shrink-0 px-3 text-[15px] font-semibold text-muted">{label}</span>
      {/* 레드 영역: 막대 + 숫자가 왼쪽 정렬로 공간 채움 */}
      <div className="flex items-center gap-2 pl-2 pr-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-r-full bg-surface-muted">
          <div className="h-full rounded-r-full bg-team-red" style={{ width: `${100 - bluePct}%` }} />
        </div>
        <span className="shrink-0 text-[15px] font-semibold tabular-nums">{fmt(redValue)}</span>
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
  const headerBg = side === "blue" ? "bg-team-blue/10" : "bg-team-red/10";
  const headerText = side === "blue" ? "text-team-blue" : "text-team-red";
  return (
    <div>
      {/* 팀 헤더 */}
      <div className={`flex items-center gap-3 px-3 py-2 ${headerBg}`}>
        <span className={`text-[15px] font-bold ${headerText}`}>{team?.shortName ?? (side === "blue" ? "블루" : "레드")}</span>
        {won && (
          <span className="rounded bg-accent px-1.5 py-0.5 text-[15px] font-bold text-accent-foreground">승</span>
        )}
        <div className="ml-auto" />
        {/* 컬럼 레이블 */}
        <div className="hidden grid-cols-[220px_1fr_140px_50px_70px_220px] gap-3 text-[15px] font-semibold uppercase text-muted lg:grid">
          <span />
          <span>KDA</span>
          <span>딜량</span>
          <span className="text-center">시야</span>
          <span className="text-center">CS</span>
          <span>아이템</span>
        </div>
      </div>
      {/* 선수 행 */}
      <div>
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
        <span className="text-[15px] font-semibold">{set.setNumber}세트</span>
        {set.durationSeconds ? (
          <span className="text-[15px] text-muted">
            {Math.floor(set.durationSeconds / 60)}:{String(set.durationSeconds % 60).padStart(2, "0")}
          </span>
        ) : null}
        <span className="text-[15px] font-semibold text-team-blue">{blueTeam?.shortName ?? "블루"}</span>
        <span className="text-[15px] text-muted">
          {set.blueKills ?? "-"} : {set.redKills ?? "-"}
        </span>
        <span className="text-[15px] font-semibold text-team-red">{redTeam?.shortName ?? "레드"}</span>
        {!hasData && <span className="text-[15px] text-muted">데이터 없음</span>}
        <span className="ml-auto text-[15px] text-muted transition-transform group-open:rotate-180">▼</span>
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
        <div className="border-t border-border px-3 py-6 text-center text-[15px] text-muted">선수 스탯 데이터가 없습니다.</div>
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
      <div className="rounded-md border border-dashed border-border bg-surface p-4 text-[15px] text-muted">
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
