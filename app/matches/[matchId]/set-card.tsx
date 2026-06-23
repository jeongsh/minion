"use client";

import { useState } from "react";
import Image from "next/image";

import { championImage, championLabel } from "@/lib/champions";
import { ObjectiveIconSlots } from "@/components/domain/objective-icon-slots";
import {
  baronIconsForSide,
  dragonIconsForSide,
  heraldIconsForSide,
  voidGrubIconsForSide,
} from "@/lib/objectives";
import { spellImageUrlById, type GameSpell } from "@/lib/spells";
import type { Champion, Player, PlayerStatLine, SetPickBan, SetResult, Team } from "@/lib/types";
import type { TimelineEvent } from "@/lib/data/lck";
import { durationLabel } from "@/lib/view-data";
import { GameTimeline } from "./game-timeline";
import { PlayerItemSlots } from "./player-item-slots";

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


function SpellIcon({ src }: { src: string }) {
  return (
    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-sm border border-border/60 bg-surface-muted">
      {src && <Image src={src} alt="" fill sizes="32px" className="object-cover" />}
    </div>
  );
}

function RuneIcon({ src, isTree = false }: { src: string; isTree?: boolean }) {
  const size = isTree ? 16 : 32;
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${isTree ? "h-4 w-4" : "h-8 w-8 border border-white/10"}`}
      style={isTree ? undefined : { background: "#0d1117" }}
    >
      {src && <Image src={src} alt="" width={size} height={size} unoptimized className="h-full w-full object-contain" />}
    </div>
  );
}

function PlayerRow({
  line,
  player,
  champion,
  teamKills,
  maxDamage,
  maxGold,
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
  maxGold: number;
  side: "blue" | "red";
  spells: GameSpell[];
  itemVersion: string;
  runeImages: Record<string, string>;
}) {
  const img = championImage(champion);
  const kp = killParticipation(line, teamKills);
  const dmgPct = maxDamage > 0 ? (line.damageToChampions / maxDamage) * 100 : 0;
  const goldPct = maxGold > 0 ? (line.gold / maxGold) * 100 : 0;
  const csm = line.gameMinutes > 0 ? (line.cs / line.gameMinutes).toFixed(1) : "-";
  const barColor = side === "blue" ? "bg-blue-500" : "bg-red-500";
  const spell0Url = spellImageUrlById(spells, line.spellIds[0], itemVersion);
  const spell1Url = spellImageUrlById(spells, line.spellIds[1], itemVersion);
  const rune0Url = line.runeIds[0] ? (runeImages[String(line.runeIds[0])] ?? "") : "";
  const rune1Url = line.runeIds[1] ? (runeImages[String(line.runeIds[1])] ?? "") : "";

  return (
    <div className="grid min-w-[920px] grid-cols-[200px_1fr_120px_100px_48px_65px_250px] items-center gap-2 border-t border-border px-3 py-2.5">
      <div className="flex items-center gap-2">
        {/* 챔피언 이미지 */}
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
          {img && <Image src={img} alt={championLabel(champion)} fill sizes="48px" className="object-cover" />}
        </div>
        {/* 스펠 + 룬 2×2 */}
          <div className="flex shrink-0 items-center gap-1">
          <div className="flex flex-col gap-1">
            <SpellIcon src={spell0Url} />
            <SpellIcon src={spell1Url} />
          </div>
          <div className="relative h-8 w-8">
            <RuneIcon src={rune0Url} />
            <span className="absolute -bottom-0.5 -right-0.5">
              <RuneIcon src={rune1Url} isTree />
            </span>
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
      <div>
        <p className="text-sm font-semibold tabular-nums">{line.gold >= 1000 ? `${(line.gold / 1000).toFixed(1)}K` : line.gold}</p>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full rounded-full bg-yellow-500/70" style={{ width: `${goldPct}%` }} />
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
      <PlayerItemSlots
        itemIds={line.itemIds}
        roleBoundItem={line.roleBoundItem}
        version={itemVersion}
        slotClassName="h-8 w-8"
        separatorClassName="h-5 w-px"
        imageSizes="32px"
      />
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
  const maxGold = Math.max(...teamLines.map((l) => l.gold), 1);
  const headerBg = side === "blue" ? "bg-blue-500/10" : "bg-red-500/10";
  const headerText = side === "blue" ? "text-blue-600" : "text-red-500";
  const ROW_GRID = "grid min-w-[920px] grid-cols-[200px_1fr_120px_100px_48px_65px_250px]";

  return (
    <div className="overflow-x-auto">
      <div className={`${ROW_GRID} items-center gap-2 px-3 py-2 ${headerBg}`}>
        <span className={`text-sm font-bold ${headerText}`}>
          {team?.shortName ?? (side === "blue" ? "블루" : "레드")}
          {won && <span className="ml-1.5 rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-foreground">승</span>}
        </span>
        <span className="text-[10px] font-semibold uppercase text-muted">KDA</span>
        <span className="text-[10px] font-semibold uppercase text-muted">딜량</span>
        <span className="text-[10px] font-semibold uppercase text-muted">골드</span>
        <span className="text-center text-[10px] font-semibold uppercase text-muted">시야</span>
        <span className="text-center text-[10px] font-semibold uppercase text-muted">CS</span>
        <span className="text-[10px] font-semibold uppercase text-muted">아이템</span>
      </div>
      {teamLines.map((line) => (
        <PlayerRow
          key={line.playerId}
          line={line}
          player={players.find((p) => p.id === line.playerId)}
          champion={champions.find((c) => c.id === line.championId)}
          teamKills={teamKills}
          maxDamage={maxDamage}
          maxGold={maxGold}
          side={side}
          spells={spells}
          itemVersion={itemVersion}
          runeImages={runeImages}
        />
      ))}
    </div>
  );
}

// ─── 양방향 선수 비교 테이블 ─────────────────────────────────────

function DualPlayerChart({
  blueLines,
  redLines,
  players,
  champions,
  spells,
  itemVersion,
  runeImages,
}: {
  blueLines: PlayerStatLine[];
  redLines: PlayerStatLine[];
  players: Player[];
  champions: Champion[];
  spells: GameSpell[];
  itemVersion: string;
  runeImages: Record<string, string>;
}) {
  const sortByPos = (lines: PlayerStatLine[]) =>
    [...lines].sort((a, b) => (POSITION_ORDER[a.position] ?? 9) - (POSITION_ORDER[b.position] ?? 9));

  const bLines = sortByPos(blueLines);
  const rLines = sortByPos(redLines);
  const getValue = (line: PlayerStatLine): number => line.damageToChampions;
  const fmtVal = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v);
  const goldVal = (line: PlayerStatLine) => `${fmtVal(line.gold)} G`;

  const rowCount = Math.max(bLines.length, rLines.length);
  const maxVal = Math.max(...[...bLines, ...rLines].map(getValue), 1);
  // grid: [champ_b][spells_b][name_b][cs_b][items_b][bar_b] | [bar_r][items_r][cs_r][name_r][spells_r][champ_r]
  const GRID = "grid w-full grid-cols-[40px_42px_minmax(94px,110px)_76px_172px_minmax(110px,1fr)_minmax(110px,1fr)_172px_76px_minmax(94px,110px)_42px_40px]";

  return (
    <div className="border-b border-border">
      <p className="pb-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-muted">
        딜량 (DAMAGE)
      </p>

      {/* 컬럼 헤더 */}
      <div className={`${GRID} items-center gap-x-1 border-t border-border/40 px-4 py-1`}>
        <span /><span />
        <span className="text-right text-[10px] font-semibold uppercase text-muted">선수</span>
        <span className="text-right text-[10px] font-semibold uppercase text-muted">CS · 골드</span>
        <span className="text-right text-[10px] font-semibold uppercase text-muted">아이템</span>
        <span />
        <span />
        <span className="text-left text-[10px] font-semibold uppercase text-muted">아이템</span>
        <span className="text-left text-[10px] font-semibold uppercase text-muted">골드 · CS</span>
        <span className="text-left text-[10px] font-semibold uppercase text-muted">선수</span>
        <span /><span />
      </div>

      {/* 선수 행 */}
      <div className="overflow-x-auto">
        {Array.from({ length: rowCount }, (_, i) => {
          const bl = bLines[i];
          const rl = rLines[i];
          const bv = bl ? getValue(bl) : 0;
          const rv = rl ? getValue(rl) : 0;
          const bPct = (bv / maxVal) * 100;
          const rPct = (rv / maxVal) * 100;
          const bImg = bl ? championImage(champions.find((c) => c.id === bl.championId)) : null;
          const rImg = rl ? championImage(champions.find((c) => c.id === rl.championId)) : null;
          const bPlayer = bl ? players.find((p) => p.id === bl.playerId) : undefined;
          const rPlayer = rl ? players.find((p) => p.id === rl.playerId) : undefined;

          const bSpell0 = bl ? spellImageUrlById(spells, bl.spellIds[0], itemVersion) : "";
          const bSpell1 = bl ? spellImageUrlById(spells, bl.spellIds[1], itemVersion) : "";
          const bRune0 = bl?.runeIds[0] ? (runeImages[String(bl.runeIds[0])] ?? "") : "";
          const bRune1 = bl?.runeIds[1] ? (runeImages[String(bl.runeIds[1])] ?? "") : "";
          const rSpell0 = rl ? spellImageUrlById(spells, rl.spellIds[0], itemVersion) : "";
          const rSpell1 = rl ? spellImageUrlById(spells, rl.spellIds[1], itemVersion) : "";
          const rRune0 = rl?.runeIds[0] ? (runeImages[String(rl.runeIds[0])] ?? "") : "";
          const rRune1 = rl?.runeIds[1] ? (runeImages[String(rl.runeIds[1])] ?? "") : "";

          return (
            <div key={i} className={`${GRID} items-center gap-x-1 border-t border-border/40 px-4 py-2`}>
              {/* 블루 챔피언 */}
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
                {bImg && <Image src={bImg} alt="" fill sizes="40px" className="object-cover" />}
              </div>

              {/* 블루 스펠 + 룬 */}
              <div className="flex shrink-0 flex-col gap-0.5">
                <div className="flex gap-0.5">
                  <SpellIcon src={bSpell0} />
                  <RuneIcon src={bRune0} />
                </div>
                <div className="flex gap-0.5">
                  <SpellIcon src={bSpell1} />
                  <RuneIcon src={bRune1} isTree />
                </div>
              </div>

              {/* 블루 이름 */}
              <div className="text-right">
                <p className="truncate text-xs font-semibold">{bPlayer?.name ?? "-"}</p>
                <p className="truncate text-[10px] text-muted">{champions.find((c) => c.id === bl?.championId)?.name ?? ""}</p>
              </div>

              {/* 블루 CS */}
              <div className="text-right">
                <p className="text-xs tabular-nums font-semibold">{bl ? `${bl.cs} CS` : "-"}</p>
                <p className="text-[10px] tabular-nums text-muted">{bl ? goldVal(bl) : ""}</p>
              </div>

              {/* 블루 아이템 */}
              <PlayerItemSlots
                itemIds={bl?.itemIds ?? []}
                roleBoundItem={bl?.roleBoundItem}
                version={itemVersion}
                className="justify-end"
                slotClassName="h-[18px] w-[18px] rounded-sm"
                separatorClassName="h-3 w-px"
                imageSizes="18px"
              />

              {/* 블루 바 + 값 */}
              <div className="flex h-5 items-center justify-end gap-1.5 pr-px">
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-blue-400">{fmtVal(bv)}</span>
                <div className="flex flex-1 justify-end">
                  <div className="h-3.5 rounded-l-sm bg-blue-500/80" style={{ width: `${bPct}%` }} />
                </div>
              </div>

              {/* 레드 바 + 값 */}
              <div className="flex h-5 items-center gap-1.5 pl-px">
                <div className="flex flex-1">
                  <div className="h-3.5 rounded-r-sm bg-red-500/80" style={{ width: `${rPct}%` }} />
                </div>
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-red-400">{fmtVal(rv)}</span>
              </div>

              {/* 레드 아이템 */}
              <PlayerItemSlots
                itemIds={rl?.itemIds ?? []}
                roleBoundItem={rl?.roleBoundItem}
                version={itemVersion}
                slotClassName="h-[18px] w-[18px] rounded-sm"
                separatorClassName="h-3 w-px"
                imageSizes="18px"
              />

              {/* 레드 CS */}
              <div className="text-left">
                <p className="text-xs tabular-nums font-semibold">{rl ? goldVal(rl) : "-"}</p>
                <p className="text-[10px] tabular-nums text-muted">{rl ? `${rl.cs} CS` : ""}</p>
              </div>

              {/* 레드 이름 */}
              <div className="text-left">
                <p className="truncate text-xs font-semibold">{rPlayer?.name ?? "-"}</p>
                <p className="truncate text-[10px] text-muted">{champions.find((c) => c.id === rl?.championId)?.name ?? ""}</p>
              </div>

              {/* 레드 스펠 + 룬 */}
              <div className="flex shrink-0 flex-col gap-0.5">
                <div className="flex gap-0.5">
                  <SpellIcon src={rSpell0} />
                  <RuneIcon src={rRune0} />
                </div>
                <div className="flex gap-0.5">
                  <SpellIcon src={rSpell1} />
                  <RuneIcon src={rRune1} isTree />
                </div>
              </div>

              {/* 레드 챔피언 */}
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
                {rImg && <Image src={rImg} alt="" fill sizes="40px" className="object-cover" />}
              </div>
            </div>
          );
        })}
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
  timelineEvents,
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
  timelineEvents?: TimelineEvent[];
}) {
  const [showStats, setShowStats] = useState(false);
  const hasStats = statLines.length > 0;
  const blueLines = statLines.filter((l) => l.teamId === set.blueTeamId);
  const redLines = statLines.filter((l) => l.teamId === set.redTeamId);
  const blueGold = blueLines.reduce((s, l) => s + l.gold, 0);
  const redGold = redLines.reduce((s, l) => s + l.gold, 0);
  const blueDamage = blueLines.reduce((s, l) => s + l.damageToChampions, 0);
  const redDamage = redLines.reduce((s, l) => s + l.damageToChampions, 0);

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      {/* 헤더 */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <span className="text-sm font-semibold">{set.setNumber}세트</span>
        <span className="text-xs text-muted">{durationLabel(set.durationSeconds)}</span>
        {!hasPickBan && <span className="text-xs text-muted">밴픽 데이터 없음</span>}
        {hasStats && (
          <button
            type="button"
            onClick={() => setShowStats((v) => !v)}
            className="ml-auto flex items-center rounded border border-border px-2 py-1 text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              className={`transition-transform duration-200 ${showStats ? "rotate-180" : ""}`}
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      {/* 밴픽 */}
      {hasPickBan ? (
        <div className="grid grid-cols-[1fr_minmax(160px,200px)_1fr] items-center gap-3 p-4">
          <SideDraft teamName={blueTeamName} bans={blueBans} picks={bluePicks} champions={champions} won={blueWon} />

          {/* 중앙 스탯 */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
              <span className="text-right text-2xl font-bold tabular-nums text-blue-500">{set.blueKills ?? "-"}</span>
              <span className="px-2 text-center text-[10px] font-semibold text-muted">KILLS</span>
              <span className="text-left text-2xl font-bold tabular-nums text-red-500">{set.redKills ?? "-"}</span>
            </div>
            {(blueDamage > 0 || redDamage > 0) && (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
                <span className="text-right text-sm font-semibold tabular-nums text-blue-400">{blueDamage >= 1000 ? `${(blueDamage / 1000).toFixed(1)}K` : blueDamage}</span>
                <span className="px-2 text-center text-[10px] font-semibold text-muted">딜량</span>
                <span className="text-left text-sm font-semibold tabular-nums text-red-400">{redDamage >= 1000 ? `${(redDamage / 1000).toFixed(1)}K` : redDamage}</span>
              </div>
            )}
            {(blueGold > 0 || redGold > 0) && (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
                <span className="text-right text-sm font-semibold tabular-nums text-blue-400">{blueGold >= 1000 ? `${(blueGold / 1000).toFixed(1)}K` : blueGold}</span>
                <span className="px-2 text-center text-[10px] font-semibold text-muted">골드</span>
                <span className="text-left text-sm font-semibold tabular-nums text-red-400">{redGold >= 1000 ? `${(redGold / 1000).toFixed(1)}K` : redGold}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {[
                {
                  label: "드래곤",
                  blue: <ObjectiveIconSlots icons={dragonIconsForSide(set, "blue")} align="right" />,
                  red: <ObjectiveIconSlots icons={dragonIconsForSide(set, "red")} align="left" />,
                },
                {
                  label: "바론",
                  blue: <ObjectiveIconSlots icons={baronIconsForSide(set, "blue")} align="right" />,
                  red: <ObjectiveIconSlots icons={baronIconsForSide(set, "red")} align="left" />,
                },
                {
                  label: "전령",
                  blue: <ObjectiveIconSlots icons={heraldIconsForSide(set, "blue")} align="right" />,
                  red: <ObjectiveIconSlots icons={heraldIconsForSide(set, "red")} align="left" />,
                },
                {
                  label: "포탑",
                  blue: <span className="text-xs font-bold tabular-nums text-blue-400">{set.blueTowers ?? "-"}</span>,
                  red: <span className="text-xs font-bold tabular-nums text-red-400">{set.redTowers ?? "-"}</span>,
                },
                {
                  label: "공허충",
                  blue: <ObjectiveIconSlots icons={voidGrubIconsForSide(set, "blue")} align="right" />,
                  red: <ObjectiveIconSlots icons={voidGrubIconsForSide(set, "red")} align="left" />,
                },
              ].map(({ label, blue, red }) => (
                <div key={label} className="grid grid-cols-[auto_1fr_auto] items-center gap-1">
                  <span className="text-right">{blue}</span>
                  <span className="text-center text-[10px] font-semibold text-muted">{label}</span>
                  <span className="text-left">{red}</span>
                </div>
              ))}
            </div>
          </div>

          <SideDraft teamName={redTeamName} bans={redBans} picks={redPicks} champions={champions} won={redWon} flip />
        </div>
      ) : (
        <div className="p-4 text-xs text-muted">데이터 없음</div>
      )}

      {/* 선수 스탯 (토글) */}
      {showStats && hasStats && (
        <div className="border-t border-border">
          {/* 데스크탑: 양팀 비교 차트 */}
          <div className="hidden md:block">
            <DualPlayerChart
              blueLines={blueLines}
              redLines={redLines}
              players={players}
              champions={champions}
              spells={spells}
              itemVersion={itemVersion}
              runeImages={runeImages}
            />
          </div>
          {/* 모바일: 팀별 상세 스탯 */}
          <div className="block md:hidden">
            <TeamStats set={set} lines={statLines} players={players} champions={champions} teams={teams} spells={spells} itemVersion={itemVersion} runeImages={runeImages} side="blue" />
            <TeamStats set={set} lines={statLines} players={players} champions={champions} teams={teams} spells={spells} itemVersion={itemVersion} runeImages={runeImages} side="red" />
          </div>
          {timelineEvents && timelineEvents.length > 0 && (
            <div className="border-y border-border bg-surface-muted px-4 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase text-muted">타임라인</p>
              <GameTimeline
                events={timelineEvents}
                durationSeconds={set.durationSeconds}
                blueTeamId={set.blueTeamId}
                redTeamId={set.redTeamId}
                blueTeamName={blueTeamName}
                redTeamName={redTeamName}
                players={players}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
