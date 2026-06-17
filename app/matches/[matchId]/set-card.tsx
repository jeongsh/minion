"use client";

import { useState } from "react";
import Image from "next/image";

import { championImage, championLabel } from "@/lib/champions";
import { spellImageUrlById, type GameSpell } from "@/lib/spells";
import type { Champion, Player, PlayerStatLine, SetPickBan, SetResult, Team } from "@/lib/types";

// ─── Ban/Pick 렌더링 ──────────────────────────────────────────

function CompactTile({ champion, ban = false }: { champion?: Champion; ban?: boolean }) {
  const img = championImage(champion);
  return (
    <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded border border-border bg-background" title={championLabel(champion)}>
      {img ? (
        <Image src={img} alt={championLabel(champion)} fill sizes="56px" className={`object-cover ${ban ? "grayscale opacity-60" : ""}`} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted">-</div>
      )}
      {ban && <div className="absolute inset-x-1 top-1/2 h-px rotate-[-18deg] bg-white/70" />}
    </div>
  );
}

function SideDraft({
  teamName,
  bans,
  picks,
  champions,
  won = false,
  flip = false,
}: {
  teamName: string;
  bans: SetPickBan[];
  picks: SetPickBan[];
  champions: Champion[];
  won?: boolean;
  flip?: boolean;
}) {
  const banChampions = [...bans].sort((a, b) => a.orderIndex - b.orderIndex).map((b) => champions.find((c) => c.id === b.championId));
  const pickChampions = [...picks].sort((a, b) => a.orderIndex - b.orderIndex).map((p) => champions.find((c) => c.id === p.championId));

  return (
    <div className={`flex flex-col gap-2 ${flip ? "items-end" : ""}`}>
      <p className={`flex items-center gap-1.5 text-sm font-semibold ${flip ? "flex-row-reverse text-red-500" : "text-blue-500"}`}>
        <span>{teamName}</span>
        {won && <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-foreground">승</span>}
      </p>
      <div className={`flex gap-1 ${flip ? "flex-row-reverse" : ""}`}>
        {Array.from({ length: 5 }, (_, i) => <CompactTile key={i} champion={banChampions[i]} ban />)}
      </div>
      <div className={`flex gap-1 ${flip ? "flex-row-reverse" : ""}`}>
        {Array.from({ length: 5 }, (_, i) => <CompactTile key={i} champion={pickChampions[i]} />)}
      </div>
    </div>
  );
}

// ─── 선수 스탯 렌더링 ──────────────────────────────────────────

const POSITION_ORDER: Record<string, number> = { TOP: 0, JGL: 1, MID: 2, BOT: 3, SUP: 4 };

function kdaRatio(line: PlayerStatLine) {
  if (line.deaths === 0) return "Perfect";
  return ((line.kills + line.assists) / line.deaths).toFixed(2) + ":1";
}

function killParticipation(line: PlayerStatLine, teamKills: number) {
  if (teamKills === 0) return 0;
  return Math.round(((line.kills + line.assists) / teamKills) * 100);
}


function ItemIcon({ src }: { src: string }) {
  return (
    <div className="relative h-[22px] w-[22px] shrink-0 overflow-hidden rounded border border-border/50 bg-surface-muted">
      {src && <Image src={src} alt="" fill sizes="22px" className="object-cover" />}
    </div>
  );
}

function SpellIcon({ src }: { src: string }) {
  return (
    <div className="relative h-[20px] w-[20px] shrink-0 overflow-hidden rounded-sm border border-border/60 bg-surface-muted">
      {src && <Image src={src} alt="" fill sizes="20px" className="object-cover" />}
    </div>
  );
}

function RuneIcon({ src }: { src: string }) {
  return (
    <div className="relative h-[20px] w-[20px] shrink-0 overflow-hidden rounded-full bg-black/40">
      {src && <Image src={src} alt="" fill sizes="20px" className="object-contain p-0.5" />}
    </div>
  );
}

function PlayerRow({
  line,
  player,
  champion,
  teamKills,
  maxDamage,
  side,
  spells,
  itemVersion,
  runeImages,
}: {
  line: PlayerStatLine;
  player?: Player;
  champion?: Champion;
  teamKills: number;
  maxDamage: number;
  side: "blue" | "red";
  spells: GameSpell[];
  itemVersion: string;
  runeImages: Record<string, string>;
}) {
  const img = championImage(champion);
  const kp = killParticipation(line, teamKills);
  const dmgPct = maxDamage > 0 ? (line.damageToChampions / maxDamage) * 100 : 0;
  const csm = line.gameMinutes > 0 ? (line.cs / line.gameMinutes).toFixed(1) : "-";
  const barColor = side === "blue" ? "bg-blue-500" : "bg-red-500";
  const spell0Url = spellImageUrlById(spells, line.spellIds[0], itemVersion);
  const spell1Url = spellImageUrlById(spells, line.spellIds[1], itemVersion);
  const rune0Url = line.runeIds[0] ? (runeImages[String(line.runeIds[0])] ?? "") : "";
  const rune1Url = line.runeIds[1] ? (runeImages[String(line.runeIds[1])] ?? "") : "";

  return (
    <div className="grid min-w-[660px] grid-cols-[220px_1fr_140px_50px_70px_170px] items-center gap-3 border-t border-border px-3 py-2.5">
      <div className="flex items-center gap-2">
        {/* 챔피언 이미지 */}
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
          {img && <Image src={img} alt={championLabel(champion)} fill sizes="48px" className="object-cover" />}
        </div>
        {/* 스펠 + 룬 2×2 */}
        <div className="flex shrink-0 flex-col gap-0.5">
          <div className="flex gap-0.5">
            <SpellIcon src={spell0Url} />
            <RuneIcon src={rune0Url} />
          </div>
          <div className="flex gap-0.5">
            <SpellIcon src={spell1Url} />
            <RuneIcon src={rune1Url} />
          </div>
        </div>
        {/* 닉네임 / 챔피언명 */}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{player?.name ?? "-"}</p>
          <p className="truncate text-[11px] text-muted">{champion?.name ?? "-"}</p>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold tabular-nums">
          {line.kills} / <span className="text-red-400">{line.deaths}</span> / {line.assists}
        </p>
        <p className="text-[11px] text-muted">
          {kdaRatio(line)} &nbsp;<span className="font-semibold text-foreground/70">({kp}%)</span>
        </p>
      </div>
      <div>
        <p className="text-sm font-semibold tabular-nums">{line.damageToChampions.toLocaleString("ko-KR")}</p>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${dmgPct}%` }} />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold tabular-nums">{line.visionScore}</p>
        <p className="text-[10px] text-muted">시야</p>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold tabular-nums">{line.cs}</p>
        <p className="text-[10px] text-muted">분 {csm}</p>
      </div>
      <div className="flex items-center gap-0.5">
        {line.itemIds.slice(0, 7).map((id, i) => (
          <ItemIcon
            key={`it${i}`}
            src={id ? `https://ddragon.leagueoflegends.com/cdn/${itemVersion}/img/item/${id}.png` : ""}
          />
        ))}
      </div>
    </div>
  );
}

function ComparisonBar({ label, blueValue, redValue, format }: { label: string; blueValue: number; redValue: number; format?: (v: number) => string }) {
  const total = blueValue + redValue;
  const bluePct = total > 0 ? (blueValue / total) * 100 : 50;
  const fmt = format ?? ((v) => v.toLocaleString("ko-KR"));
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center py-1.5">
      <div className="flex items-center justify-end gap-2 pl-3 pr-2">
        <span className="shrink-0 text-sm font-bold tabular-nums text-blue-500">{fmt(blueValue)}</span>
        <div className="h-4 flex-1 overflow-hidden rounded-l-full bg-surface-muted">
          <div className="ml-auto h-full rounded-l-full bg-blue-500" style={{ width: `${bluePct}%` }} />
        </div>
      </div>
      <span className="shrink-0 px-3 text-[11px] font-semibold text-muted">{label}</span>
      <div className="flex items-center gap-2 pl-2 pr-3">
        <div className="h-4 flex-1 overflow-hidden rounded-r-full bg-surface-muted">
          <div className="h-full rounded-r-full bg-red-500" style={{ width: `${100 - bluePct}%` }} />
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-red-400">{fmt(redValue)}</span>
      </div>
    </div>
  );
}

function TeamStats({
  set,
  lines,
  players,
  champions,
  teams,
  side,
  spells,
  itemVersion,
  runeImages,
}: {
  set: SetResult;
  lines: PlayerStatLine[];
  players: Player[];
  champions: Champion[];
  teams: Team[];
  side: "blue" | "red";
  spells: GameSpell[];
  itemVersion: string;
  runeImages: Record<string, string>;
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
      <div className={`flex items-center gap-3 px-3 py-2 ${headerBg}`}>
        <span className={`text-sm font-bold ${headerText}`}>{team?.shortName ?? (side === "blue" ? "블루" : "레드")}</span>
        {won && <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-foreground">승</span>}
        <div className="ml-auto hidden min-w-[660px] grid-cols-[220px_1fr_140px_50px_70px_170px] gap-3 text-[10px] font-semibold uppercase text-muted md:grid">
          <span />
          <span>KDA</span>
          <span>딜량</span>
          <span className="text-center">시야</span>
          <span className="text-center">CS</span>
          <span>아이템</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        {teamLines.map((line) => (
          <PlayerRow
            key={line.playerId}
            line={line}
            player={players.find((p) => p.id === line.playerId)}
            champion={champions.find((c) => c.id === line.championId)}
            teamKills={teamKills}
            maxDamage={maxDamage}
            side={side}
            spells={spells}
            itemVersion={itemVersion}
            runeImages={runeImages}
          />
        ))}
      </div>
    </div>
  );
}

// ─── 메인 SetCard ──────────────────────────────────────────────

export function SetCard({
  set,
  blueBans,
  bluePicks,
  redBans,
  redPicks,
  blueTeamName,
  redTeamName,
  blueWon,
  redWon,
  hasPickBan,
  champions,
  statLines,
  players,
  teams,
  spells,
  itemVersion,
  runeImages,
}: {
  set: SetResult;
  blueBans: SetPickBan[];
  bluePicks: SetPickBan[];
  redBans: SetPickBan[];
  redPicks: SetPickBan[];
  blueTeamName: string;
  redTeamName: string;
  blueWon: boolean;
  redWon: boolean;
  hasPickBan: boolean;
  champions: Champion[];
  statLines: PlayerStatLine[];
  players: Player[];
  teams: Team[];
  spells: GameSpell[];
  itemVersion: string;
  runeImages: Record<string, string>;
}) {
  const [showStats, setShowStats] = useState(false);
  const hasStats = statLines.length > 0;
  const blueLines = statLines.filter((l) => l.teamId === set.blueTeamId);
  const redLines = statLines.filter((l) => l.teamId === set.redTeamId);
  const blueKills = blueLines.reduce((s, l) => s + l.kills, 0);
  const redKills = redLines.reduce((s, l) => s + l.kills, 0);
  const blueGold = blueLines.reduce((s, l) => s + l.gold, 0);
  const redGold = redLines.reduce((s, l) => s + l.gold, 0);

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      {/* 헤더 */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <span className="text-sm font-semibold">{set.setNumber}세트</span>
        <span className="text-xs text-muted">{set.blueKills ?? "-"} : {set.redKills ?? "-"}</span>
        {!hasPickBan && <span className="text-xs text-muted">밴픽 데이터 없음</span>}
        {hasStats && (
          <button
            type="button"
            onClick={() => setShowStats((v) => !v)}
            className="ml-auto rounded border border-border px-3 py-1 text-xs font-semibold hover:bg-surface-muted"
          >
            {showStats ? "스탯 닫기" : "선수 스탯"}
          </button>
        )}
      </div>

      {/* 밴픽 */}
      {hasPickBan ? (
        <div className="grid grid-cols-[1fr_24px_1fr] items-center gap-2 p-4">
          <SideDraft teamName={blueTeamName} bans={blueBans} picks={bluePicks} champions={champions} won={blueWon} />
          <div className="flex flex-col items-center gap-8 text-[10px] font-semibold text-muted">
            <span>BAN</span>
            <span>PICK</span>
          </div>
          <SideDraft teamName={redTeamName} bans={redBans} picks={redPicks} champions={champions} won={redWon} flip />
        </div>
      ) : (
        <div className="p-4 text-xs text-muted">데이터 없음</div>
      )}

      {/* 선수 스탯 (토글) */}
      {showStats && hasStats && (
        <div className="border-t border-border">
          <TeamStats set={set} lines={statLines} players={players} champions={champions} teams={teams} spells={spells} itemVersion={itemVersion} runeImages={runeImages} side="blue" />
          <div className="border-y border-border bg-surface-muted py-1">
            <ComparisonBar label="Total Kill" blueValue={blueKills} redValue={redKills} />
            <ComparisonBar label="Total Gold" blueValue={blueGold} redValue={redGold} format={(v) => `${(v / 1000).toFixed(1)}K`} />
          </div>
          <TeamStats set={set} lines={statLines} players={players} champions={champions} teams={teams} spells={spells} itemVersion={itemVersion} side="red" />
        </div>
      )}
    </div>
  );
}
