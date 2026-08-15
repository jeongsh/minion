"use client";

import { useState } from "react";
import Image from "next/image";

import { championImage, championLabel } from "@/lib/champions";
import { ObjectiveIconSlots } from "@/components/domain/objective-icon-slots";
import { PlayerLoadout } from "@/components/domain/player-loadout";
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
    <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded border border-border bg-background" title={championLabel(champion)}>
      {img ? (
        <Image src={img} alt={championLabel(champion)} fill sizes="44px" className={`object-cover ${ban ? "grayscale opacity-60" : ""}`} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted">-</div>
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
    <div className={`flex flex-col gap-1.5 ${flip ? "items-end" : ""}`}>
      <p className={`flex items-center gap-1.5 text-sm font-semibold ${flip ? "flex-row-reverse text-red-500" : "text-blue-500"}`}>
        <span>{teamName}</span>
        {won && <span className="rounded bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">승</span>}
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
    <span className="relative block h-6 w-6 shrink-0 overflow-hidden rounded-sm border border-border/60 bg-surface-muted">
      {src ? <Image src={src} alt="" fill sizes="24px" className="object-cover" /> : null}
    </span>
  );
}

function RuneIcon({ src, isTree = false }: { src: string; isTree?: boolean }) {
  const className = isTree ? "h-3.5 w-3.5" : "h-6 w-6 border border-white/10 bg-[#0d1117]";
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-full ${className}`}>
      {src ? <Image src={src} alt="" fill sizes={isTree ? "14px" : "24px"} unoptimized className="object-contain" /> : null}
    </span>
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
  const kp = killParticipation(line, teamKills);
  const dmgPct = maxDamage > 0 ? (line.damageToChampions / maxDamage) * 100 : 0;
  const goldPct = maxGold > 0 ? (line.gold / maxGold) * 100 : 0;
  const csm = line.gameMinutes > 0 ? (line.cs / line.gameMinutes).toFixed(1) : "-";
  const barColor = side === "blue" ? "bg-team-blue" : "bg-team-red";
  const rune0Url = line.runeIds[0] ? (runeImages[String(line.runeIds[0])] ?? "") : "";
  const rune1Url = line.runeIds[1] ? (runeImages[String(line.runeIds[1])] ?? "") : "";

  return (
    <div className="grid min-w-[820px] grid-cols-[180px_0.9fr_104px_88px_44px_58px_218px] items-center gap-2 border-t border-border px-2.5 py-2">
      <PlayerLoadout
        champion={champion}
        spellIds={line.spellIds}
        runeIds={line.runeIds}
        spells={spells}
        version={itemVersion}
        runeImageUrls={[rune0Url, rune1Url]}
        primaryLabel={player?.name ?? "-"}
        secondaryLabel={champion?.name ?? "-"}
        size="sm"
        position={line.position}
      />
      <div>
        <p className="text-sm font-semibold tabular-nums">
          {line.kills} / <span className="text-red-400">{line.deaths}</span> / {line.assists}
        </p>
        <p className="text-xs text-muted">
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
        <p className="text-xs text-muted">시야</p>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold tabular-nums">{line.cs}</p>
        <p className="text-xs text-muted">분 {csm}</p>
      </div>
      <PlayerItemSlots
        itemIds={line.itemIds}
        roleBoundItem={line.roleBoundItem}
        version={itemVersion}
        slotClassName="h-7 w-7"
        separatorClassName="h-4 w-px"
        imageSizes="28px"
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
  const ROW_GRID = "grid min-w-[820px] grid-cols-[180px_0.9fr_104px_88px_44px_58px_218px]";

  return (
    <div className="overflow-x-auto">
      <div className={`${ROW_GRID} items-center gap-2 px-2.5 py-1.5 ${headerBg}`}>
        <span className={`text-sm font-bold ${headerText}`}>
          {team?.shortName ?? (side === "blue" ? "블루" : "레드")}
          {won && <span className="ml-1.5 rounded bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">승</span>}
        </span>
        <span className="text-xs font-medium uppercase text-muted">KDA</span>
        <span className="text-xs font-medium uppercase text-muted">딜량</span>
        <span className="text-xs font-medium uppercase text-muted">골드</span>
        <span className="text-center text-xs font-medium uppercase text-muted">시야</span>
        <span className="text-center text-xs font-medium uppercase text-muted">CS</span>
        <span className="text-xs font-medium uppercase text-muted">아이템</span>
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
  const GRID = "grid w-full grid-cols-[34px_34px_minmax(82px,100px)_64px_150px_minmax(96px,1fr)_minmax(96px,1fr)_150px_64px_minmax(82px,100px)_34px_34px]";

  return (
    <div className="border-b border-border">
      <p className="pb-1 text-center text-xs font-medium uppercase tracking-widest text-muted">
        딜량 (DAMAGE)
      </p>

      {/* 컬럼 헤더 */}
      <div className={`${GRID} items-center gap-x-1 border-t border-border/40 px-3 py-1`}>
        <span /><span />
        <span className="text-right text-xs font-medium uppercase text-muted">선수</span>
        <span className="text-right text-xs font-medium uppercase text-muted">CS · 골드</span>
        <span className="text-right text-xs font-medium uppercase text-muted">아이템</span>
        <span />
        <span />
        <span className="text-left text-xs font-medium uppercase text-muted">아이템</span>
        <span className="text-left text-xs font-medium uppercase text-muted">골드 · CS</span>
        <span className="text-left text-xs font-medium uppercase text-muted">선수</span>
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
            <div key={i} className={`${GRID} items-center gap-x-1 border-t border-border/40 px-3 py-1.5`}>
              {/* 블루 챔피언 */}
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
                {bImg && <Image src={bImg} alt="" fill sizes="32px" className="object-cover" />}
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
                <p className="truncate text-sm font-semibold">{bPlayer?.name ?? "-"}</p>
                <p className="truncate text-xs text-muted">{champions.find((c) => c.id === bl?.championId)?.name ?? ""}</p>
              </div>

              {/* 블루 CS */}
              <div className="text-right">
                <p className="text-sm tabular-nums font-semibold">{bl ? `${bl.cs} CS` : "-"}</p>
                <p className="text-xs tabular-nums text-muted">{bl ? goldVal(bl) : ""}</p>
              </div>

              {/* 블루 아이템 */}
              <PlayerItemSlots
                itemIds={bl?.itemIds ?? []}
                roleBoundItem={bl?.roleBoundItem}
                version={itemVersion}
                className="justify-end"
                slotClassName="h-4 w-4 rounded-sm"
                separatorClassName="h-3 w-px"
                imageSizes="16px"
              />

              {/* 블루 바 + 값 (선수스탯 딜량 바와 동일한 디자인: h-1.5 트랙 + rounded-full, 값은 기본 폰트) */}
              <div className="flex h-5 items-center justify-end gap-1.5 pr-px">
                <span className="shrink-0 text-sm font-semibold tabular-nums">{fmtVal(bv)}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-l-full bg-surface-muted">
                  <div className="ml-auto h-full rounded-l-full bg-team-blue" style={{ width: `${bPct}%` }} />
                </div>
              </div>

              {/* 레드 바 + 값 */}
              <div className="flex h-5 items-center gap-1.5 pl-px">
                <div className="h-1.5 flex-1 overflow-hidden rounded-r-full bg-surface-muted">
                  <div className="h-full rounded-r-full bg-team-red" style={{ width: `${rPct}%` }} />
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{fmtVal(rv)}</span>
              </div>

              {/* 레드 아이템 */}
              <PlayerItemSlots
                itemIds={rl?.itemIds ?? []}
                roleBoundItem={rl?.roleBoundItem}
                version={itemVersion}
                slotClassName="h-4 w-4 rounded-sm"
                separatorClassName="h-3 w-px"
                imageSizes="16px"
              />

              {/* 레드 CS */}
              <div className="text-left">
                <p className="text-sm tabular-nums font-semibold">{rl ? goldVal(rl) : "-"}</p>
                <p className="text-xs tabular-nums text-muted">{rl ? `${rl.cs} CS` : ""}</p>
              </div>

              {/* 레드 이름 */}
              <div className="text-left">
                <p className="truncate text-sm font-semibold">{rPlayer?.name ?? "-"}</p>
                <p className="truncate text-xs text-muted">{champions.find((c) => c.id === rl?.championId)?.name ?? ""}</p>
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
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
                {rImg && <Image src={rImg} alt="" fill sizes="32px" className="object-cover" />}
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
      <div className="flex items-center gap-2.5 border-b border-border px-3 py-2">
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
        <div className="grid grid-cols-[1fr_minmax(136px,176px)_1fr] items-center gap-2.5 p-3">
          <SideDraft teamName={blueTeamName} bans={blueBans} picks={bluePicks} champions={champions} won={blueWon} />

          {/* 중앙 스탯 */}
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
              <span className="text-right text-xl font-bold tabular-nums text-blue-500">{set.blueKills ?? "-"}</span>
              <span className="px-2 text-center text-xs font-medium text-muted">KILLS</span>
              <span className="text-left text-xl font-bold tabular-nums text-red-500">{set.redKills ?? "-"}</span>
            </div>
            {(blueDamage > 0 || redDamage > 0) && (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
                <span className="text-right text-xs font-medium tabular-nums text-blue-400">{blueDamage >= 1000 ? `${(blueDamage / 1000).toFixed(1)}K` : blueDamage}</span>
                <span className="px-2 text-center text-xs font-medium text-muted">딜량</span>
                <span className="text-left text-xs font-medium tabular-nums text-red-400">{redDamage >= 1000 ? `${(redDamage / 1000).toFixed(1)}K` : redDamage}</span>
              </div>
            )}
            {(blueGold > 0 || redGold > 0) && (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
                <span className="text-right text-xs font-medium tabular-nums text-blue-400">{blueGold >= 1000 ? `${(blueGold / 1000).toFixed(1)}K` : blueGold}</span>
                <span className="px-2 text-center text-xs font-medium text-muted">골드</span>
                <span className="text-left text-xs font-medium tabular-nums text-red-400">{redGold >= 1000 ? `${(redGold / 1000).toFixed(1)}K` : redGold}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
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
                  blue: <span className="text-xs font-medium tabular-nums text-blue-400">{set.blueTowers ?? "-"}</span>,
                  red: <span className="text-xs font-medium tabular-nums text-red-400">{set.redTowers ?? "-"}</span>,
                },
                {
                  label: "공허충",
                  blue: <ObjectiveIconSlots icons={voidGrubIconsForSide(set, "blue")} align="right" />,
                  red: <ObjectiveIconSlots icons={voidGrubIconsForSide(set, "red")} align="left" />,
                },
              ].map(({ label, blue, red }) => (
                <div key={label} className="grid grid-cols-[auto_1fr_auto] items-center gap-1">
                  <span className="text-right">{blue}</span>
                  <span className="text-center text-xs font-medium text-muted">{label}</span>
                  <span className="text-left">{red}</span>
                </div>
              ))}
            </div>
          </div>

          <SideDraft teamName={redTeamName} bans={redBans} picks={redPicks} champions={champions} won={redWon} flip />
        </div>
      ) : (
        <div className="p-3 text-sm text-muted">데이터 없음</div>
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
            <div className="border-y border-border bg-surface-muted px-3 py-2.5">
              <p className="mb-2 text-xs font-medium uppercase text-muted">타임라인</p>
              <GameTimeline
                events={timelineEvents}
                durationSeconds={set.durationSeconds}
                blueTeamId={set.blueTeamId}
                redTeamId={set.redTeamId}
                blueTeamName={blueTeamName}
                redTeamName={redTeamName}
                players={players}
                winnerTeamId={set.winnerTeamId}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
