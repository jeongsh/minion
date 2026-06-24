"use client";

import { useId, useState } from "react";
import type { TimelineEvent } from "@/lib/data/lck";
import type { Player } from "@/lib/types";
import { OBJECTIVE_ICONS } from "@/lib/objectives";

const SVG_W    = 800;
const PAD_X    = 48;
const ITEM_SZ  = 16;   // icon diameter
const ITEM_SLT = 20;   // px per row
const KILL_R   = 5;    // kill dot radius
const TOP_MAR  = 10;
const BOT_MAR  = 18;
const MIN_HALF = 70;
const CTR_GAP  = 6;
const BADGE_R  = 5;    // count badge radius

function toX(ms: number, duration: number): number {
  return PAD_X + (ms / 1000 / duration) * (SVG_W - PAD_X * 2);
}

// ── 이벤트 종류 식별 (클러스터링 키) ─────────────────────────────

function getEventKind(e: TimelineEvent): string {
  if (e.eventType === "CHAMPION_KILL") return "kill";
  if (e.eventType === "BUILDING_KILL") return "tower";
  const mt = (e.monsterType ?? "").toUpperCase();
  if (mt.includes("BARON"))                              return "baron";
  if (mt.includes("ELDER"))                              return "elder";
  if (mt.includes("RIFTHERALD") || mt === "RIFTHERALD") return "herald";
  if (mt.includes("HORDE"))                             return "voidgrub";
  if (mt.includes("INFERNAL") || mt.includes("FIRE"))   return "dragon_fire";
  if (mt.includes("OCEAN")    || mt.includes("WATER"))  return "dragon_ocean";
  if (mt.includes("CLOUD")    || mt.includes("AIR"))    return "dragon_cloud";
  if (mt.includes("MOUNTAIN") || mt.includes("EARTH"))  return "dragon_mountain";
  if (mt.includes("HEXTECH"))                           return "dragon_hextech";
  if (mt.includes("CHEMTECH"))                          return "dragon_chemtech";
  return "dragon";
}

type ObjInfo = { label: string; color: string; iconUrl?: string };

function getObjInfo(e: TimelineEvent): ObjInfo {
  if (e.eventType === "BUILDING_KILL")
    return { label: "포탑", color: "#fb923c", iconUrl: OBJECTIVE_ICONS.tower };
  const mt = (e.monsterType ?? "").toUpperCase();
  if (mt.includes("BARON"))                              return { label: "바론",   color: "#c084fc", iconUrl: OBJECTIVE_ICONS.baron };
  if (mt.includes("ELDER"))                              return { label: "장로",   color: "#f97316", iconUrl: OBJECTIVE_ICONS.elder };
  if (mt.includes("RIFTHERALD") || mt === "RIFTHERALD") return { label: "전령",   color: "#22d3ee", iconUrl: OBJECTIVE_ICONS.herald };
  if (mt.includes("HORDE"))                             return { label: "공허충", color: "#86efac", iconUrl: OBJECTIVE_ICONS.voidGrub };
  if (mt.includes("INFERNAL") || mt.includes("FIRE"))   return { label: "화염",   color: "#ef4444", iconUrl: OBJECTIVE_ICONS.infernal };
  if (mt.includes("OCEAN")    || mt.includes("WATER"))  return { label: "바다",   color: "#60a5fa", iconUrl: OBJECTIVE_ICONS.ocean };
  if (mt.includes("CLOUD")    || mt.includes("AIR"))    return { label: "바람",   color: "#a3e635", iconUrl: OBJECTIVE_ICONS.cloud };
  if (mt.includes("MOUNTAIN") || mt.includes("EARTH"))  return { label: "대지",   color: "#d97706", iconUrl: OBJECTIVE_ICONS.mountain };
  if (mt.includes("HEXTECH"))                           return { label: "마공",   color: "#818cf8", iconUrl: OBJECTIVE_ICONS.hextech };
  if (mt.includes("CHEMTECH"))                          return { label: "화공",   color: "#84cc16", iconUrl: OBJECTIVE_ICONS.chemtech };
  return { label: "드래곤", color: "#facc15", iconUrl: OBJECTIVE_ICONS.dragon };
}

function makeTooltip(e: TimelineEvent, players: Player[]): string {
  const min = Math.floor(e.timestampMs / 60000);
  const sec = Math.floor((e.timestampMs % 60000) / 1000);
  const t = `${min}:${String(sec).padStart(2, "0")}`;
  if (e.eventType === "CHAMPION_KILL") {
    const killer = players.find((p) => p.id === e.killerPlayerId)?.name ?? "?";
    const victim = players.find((p) => p.id === e.victimPlayerId)?.name ?? "?";
    const assists = e.assistPlayerIds.map((id) => players.find((p) => p.id === id)?.name ?? "?").join(", ");
    return assists ? `${t}  ${killer} → ${victim}  (${assists})` : `${t}  ${killer} → ${victim}`;
  }
  if (e.eventType === "ELITE_MONSTER_KILL") {
    const p = players.find((p) => p.id === e.killerPlayerId)?.name;
    return `${t}  ${e.monsterType ?? "몬스터"}${p ? `  (${p})` : ""}`;
  }
  const lane = e.laneType?.replace("_LANE", "") ?? "";
  return `${t}  ${lane} 포탑`;
}

// ── 1분 윈도우 클러스터링 ─────────────────────────────────────────

type Cluster = {
  id: string;
  kind: string;
  count: number;
  ms: number;           // 클러스터 대표 timestamp (첫 이벤트)
  info: ObjInfo | null; // kill이면 null
  tooltipLines: string[];
};

function clusterTeamEvents(
  teamEvents: TimelineEvent[],
  windowMs: number,
  players: Player[],
): Cluster[] {
  // 종류별 그룹화
  const byKind = new Map<string, TimelineEvent[]>();
  for (const e of teamEvents) {
    const k = getEventKind(e);
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k)!.push(e);
  }

  const clusters: Cluster[] = [];
  for (const [kind, evs] of byKind) {
    const sorted = [...evs].sort((a, b) => a.timestampMs - b.timestampMs);
    let i = 0;
    while (i < sorted.length) {
      const start = sorted[i].timestampMs;
      const group: TimelineEvent[] = [sorted[i]];
      let j = i + 1;
      while (j < sorted.length && sorted[j].timestampMs - start < windowMs) {
        group.push(sorted[j]);
        j++;
      }
      clusters.push({
        id: `${kind}-${start}`,
        kind,
        count: group.length,
        ms: start,
        info: kind === "kill" ? null : getObjInfo(group[0]),
        tooltipLines: group.map((e) => makeTooltip(e, players)),
      });
      i = j;
    }
  }

  return clusters.sort((a, b) => a.ms - b.ms);
}

// ── 행 배치 (클러스터 간 겹침 방지) ──────────────────────────────

type PlacedCluster = Cluster & { row: number };

function assignRows(clusters: Cluster[], windowMs = 12_000): PlacedCluster[] {
  const rowEnd: number[] = [];
  return clusters.map((c) => {
    let row = 0;
    while (rowEnd[row] != null && c.ms - rowEnd[row] < windowMs) row++;
    rowEnd[row] = c.ms;
    return { ...c, row };
  });
}

// ── 아이콘 렌더러 ─────────────────────────────────────────────────

function ClusterIcon({
  cx, cy, cluster, onHover, uid,
}: {
  cx: number; cy: number; cluster: PlacedCluster; uid: string; onHover: () => void;
}) {
  const half = ITEM_SZ / 2;
  const { info, count } = cluster;

  const badge = count > 1 ? (
    <g>
      <circle cx={cx + half} cy={cy - half} r={BADGE_R} fill="#0f172a" stroke="#e5e7eb" strokeWidth={0.8} />
      <text x={cx + half} y={cy - half + 3.5} textAnchor="middle" fontSize={6} fill="#f1f5f9" fontWeight="800">
        {count}
      </text>
    </g>
  ) : null;

  if (!info) {
    // 킬 도트
    return (
      <g className="cursor-pointer" onMouseEnter={onHover}>
        <circle cx={cx} cy={cy} r={count > 1 ? KILL_R + 2 : KILL_R}
          fill="currentColor" filter={`url(#${uid}-glow)`} />
        {count > 1 && (
          <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={7} fill="#0f172a" fontWeight="800">{count}</text>
        )}
      </g>
    );
  }

  if (info.iconUrl) {
    return (
      <g className="cursor-pointer" onMouseEnter={onHover}>
        <circle cx={cx} cy={cy} r={half + 1} fill={info.color} fillOpacity={0.3} />
        <image href={info.iconUrl} x={cx - half} y={cy - half} width={ITEM_SZ} height={ITEM_SZ} />
        {badge}
      </g>
    );
  }
  return (
    <g className="cursor-pointer" onMouseEnter={onHover}>
      <circle cx={cx} cy={cy} r={half} fill={info.color} />
      <text x={cx} y={cy + 3} textAnchor="middle" fontSize={6} fill="#000" fontWeight="800">{info.label}</text>
      {badge}
    </g>
  );
}

// ── 컴포넌트 ─────────────────────────────────────────────────────

export function GameTimeline({
  events,
  durationSeconds,
  blueTeamId,
  redTeamId,
  blueTeamName,
  redTeamName,
  players,
  blueGold,
  redGold,
}: {
  events: TimelineEvent[];
  durationSeconds: number | null;
  blueTeamId: string;
  redTeamId: string;
  blueTeamName: string;
  redTeamName: string;
  players: Player[];
  blueGold?: number | null;
  redGold?: number | null;
}) {
  const uid = useId().replace(/:/g, "");
  const [tooltip, setTooltip] = useState<{ lines: string[]; xPct: number } | null>(null);

  if (!events.length) {
    return <div className="flex items-center justify-center py-6 text-xs text-muted">타임라인 데이터 없음</div>;
  }

  const duration = durationSeconds ?? Math.ceil((events.at(-1)?.timestampMs ?? 0) / 1000);
  const tx = (ms: number) => toX(ms, duration);

  const uniqueEvents = Array.from(new Map(events.map((e) => [e.id, e])).values());
  const killEvents = uniqueEvents.filter((e) => e.eventType === "CHAMPION_KILL").sort((a, b) => a.timestampMs - b.timestampMs);
  const objEvents  = uniqueEvents.filter((e) => e.eventType !== "CHAMPION_KILL" && !(e.buildingType ?? "").includes("INHIBITOR")).sort((a, b) => a.timestampMs - b.timestampMs);

  const blueKills = killEvents.filter((e) => e.teamId === blueTeamId).length;
  const redKills  = killEvents.filter((e) => e.teamId === redTeamId).length;
  const goldDiff  = blueGold != null && redGold != null ? blueGold - redGold : null;
  const goldFmt   = (g: number) => `${g >= 0 ? "+" : ""}${(g / 1000).toFixed(1)}K`;

  // 1분 클러스터링 → 행 배치
  const blueRaw = [...killEvents, ...objEvents].filter((e) => e.teamId === blueTeamId);
  const redRaw  = [...killEvents, ...objEvents].filter((e) => e.teamId === redTeamId);

  const blueClusters = assignRows(clusterTeamEvents(blueRaw, 60_000, players));
  const redClusters  = assignRows(clusterTeamEvents(redRaw,  60_000, players));

  const maxBlueRow = blueClusters.length > 0 ? Math.max(...blueClusters.map((c) => c.row)) : 0;
  const maxRedRow  = redClusters.length  > 0 ? Math.max(...redClusters.map( (c) => c.row)) : 0;

  const blueH = Math.max((maxBlueRow + 1) * ITEM_SLT, MIN_HALF);
  const redH  = Math.max((maxRedRow  + 1) * ITEM_SLT, MIN_HALF);

  const graphTop = TOP_MAR;
  const centerY  = graphTop + blueH + CTR_GAP;
  const graphBot = centerY  + CTR_GAP + redH;
  const axisY    = graphBot;
  const svgH     = axisY + BOT_MAR;

  const blueCY = (row: number) => graphTop + ITEM_SZ / 2 + row * ITEM_SLT;
  const redCY  = (row: number) => centerY  + CTR_GAP + ITEM_SZ / 2 + row * ITEM_SLT;

  // 킬 차이 곡선
  let tmpDiff = 0;
  let maxDiff = 5;
  for (const e of killEvents) {
    if (e.teamId === blueTeamId) tmpDiff++; else tmpDiff--;
    maxDiff = Math.max(maxDiff, Math.abs(tmpDiff));
  }
  const ampBlue = blueH * 0.92;
  const ampRed  = redH  * 0.92;
  const dy = (d: number) =>
    d >= 0 ? centerY - (d / maxDiff) * ampBlue : centerY + (-d / maxDiff) * ampRed;

  let diff = 0;
  const pts: string[] = [`M ${PAD_X} ${dy(0)}`];
  for (const e of killEvents) {
    if (e.teamId === blueTeamId) diff++; else diff--;
    pts.push(`L ${tx(e.timestampMs)} ${dy(diff)}`);
  }
  const endX = SVG_W - PAD_X;
  pts.push(`L ${endX} ${dy(diff)}`);
  const lineD = pts.join(" ");
  const areaD = `${lineD} L ${endX} ${centerY} L ${PAD_X} ${centerY} Z`;

  const mins: number[] = [];
  for (let m = 5; m * 60 < duration; m += 5) mins.push(m);

  const yStep = maxDiff <= 4 ? 1 : maxDiff <= 8 ? 2 : Math.ceil(maxDiff / 4);

  return (
    <div className="relative select-none">
      <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold">
        <span className="flex items-center gap-1.5 text-blue-400">
          {blueTeamName}
          <span className="rounded bg-blue-400/15 px-1.5 py-0.5 text-white tabular-nums">{blueKills} K</span>
        </span>
        {goldDiff !== null && (
          <span className={`rounded px-2 py-0.5 tabular-nums ${goldDiff > 0 ? "bg-blue-400/10 text-blue-300" : goldDiff < 0 ? "bg-red-400/10 text-red-300" : "bg-white/5 text-muted"}`}>
            골드 {goldFmt(goldDiff)}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-red-400">
          <span className="rounded bg-red-400/15 px-1.5 py-0.5 text-white tabular-nums">{redKills} K</span>
          {redTeamName}
        </span>
      </div>

      <svg viewBox={`0 0 ${SVG_W} ${svgH}`} className="w-full" onMouseLeave={() => setTooltip(null)}>
        <defs>
          <clipPath id={`${uid}-bc`}>
            <rect x={PAD_X} y={graphTop} width={SVG_W - PAD_X * 2} height={blueH + CTR_GAP} />
          </clipPath>
          <clipPath id={`${uid}-rc`}>
            <rect x={PAD_X} y={centerY} width={SVG_W - PAD_X * 2} height={CTR_GAP + redH} />
          </clipPath>
          <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={`${uid}-line-glow`} x="-20%" y="-100%" width="140%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id={`${uid}-gb`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id={`${uid}-gr`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#f87171" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        <rect x={PAD_X} y={graphTop} width={SVG_W - PAD_X * 2} height={blueH + CTR_GAP} fill="#0d1e3a" />
        <rect x={PAD_X} y={centerY}  width={SVG_W - PAD_X * 2} height={CTR_GAP + redH}  fill="#1e0a0d" />

        <path d={areaD} fill={`url(#${uid}-gb)`} clipPath={`url(#${uid}-bc)`} />
        <path d={areaD} fill={`url(#${uid}-gr)`} clipPath={`url(#${uid}-rc)`} />

        {/* y축 그리드 */}
        {Array.from({ length: maxDiff * 2 + 1 }, (_, i) => i - maxDiff).map((d) => {
          const y = dy(d);
          const show = d % yStep === 0;
          return (
            <g key={`gy${d}`}>
              <line x1={PAD_X} y1={y} x2={SVG_W - PAD_X} y2={y}
                stroke="#ffffff" strokeWidth={d === 0 ? 1 : 0.5} strokeOpacity={d === 0 ? 0.25 : 0.1} />
              {show && (
                <text x={PAD_X - 4} y={y + 3} textAnchor="end" fontSize={7}
                  fill={d > 0 ? "#60a5fa" : d < 0 ? "#f87171" : "#9ca3af"} fontWeight="500">
                  {d > 0 ? `+${d}K` : d < 0 ? `${d}K` : "0"}
                </text>
              )}
            </g>
          );
        })}

        <path d={lineD} fill="none" stroke="#ffffff" strokeWidth={4} strokeOpacity={0.15} filter={`url(#${uid}-line-glow)`} />
        <path d={lineD} fill="none" stroke="#e5e7eb" strokeWidth={2} />

        <text x={PAD_X + 6} y={graphTop + blueH / 2 + 3} textAnchor="start" fontSize={8} fontWeight="700" fill="#60a5fa" fillOpacity={0.7}>{blueTeamName}</text>
        <text x={PAD_X + 6} y={centerY + CTR_GAP + redH / 2 + 3} textAnchor="start" fontSize={8} fontWeight="700" fill="#f87171" fillOpacity={0.7}>{redTeamName}</text>

        {mins.map((m) => {
          const x = tx(m * 60 * 1000);
          return <line key={`g${m}`} x1={x} y1={graphTop} x2={x} y2={graphBot}
            stroke="#ffffff" strokeWidth={0.3} strokeOpacity={0.08} strokeDasharray="2 4" />;
        })}

        <line x1={PAD_X} y1={axisY} x2={SVG_W - PAD_X} y2={axisY} stroke="#374151" strokeWidth={0.8} />
        {mins.map((m) => {
          const x = tx(m * 60 * 1000);
          return (
            <g key={m}>
              <line x1={x} y1={axisY} x2={x} y2={axisY + 3} stroke="#4b5563" strokeWidth={0.8} />
              <text x={x} y={axisY + 11} textAnchor="middle" fontSize={7} fill="#6b7280">{m}'</text>
            </g>
          );
        })}

        {/* 블루 클러스터 */}
        {blueClusters.map((c) => {
          const x = tx(c.ms);
          const cy = blueCY(c.row);
          return (
            <g key={`b-${c.id}`} style={{ color: "#93c5fd" }}>
              <ClusterIcon cx={x} cy={cy} cluster={c} uid={uid}
                onHover={() => setTooltip({ lines: c.tooltipLines, xPct: (x / SVG_W) * 100 })} />
            </g>
          );
        })}

        {/* 레드 클러스터 */}
        {redClusters.map((c) => {
          const x = tx(c.ms);
          const cy = redCY(c.row);
          return (
            <g key={`r-${c.id}`} style={{ color: "#fca5a5" }}>
              <ClusterIcon cx={x} cy={cy} cluster={c} uid={uid}
                onHover={() => setTooltip({ lines: c.tooltipLines, xPct: (x / SVG_W) * 100 })} />
            </g>
          );
        })}
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded bg-background/95 px-2 py-1 text-xs shadow-md ring-1 ring-border"
          style={{ left: `${Math.min(Math.max(tooltip.xPct, 5), 60)}%` }}
        >
          {tooltip.lines.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}

      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 px-1 text-[10px] text-muted">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue-400/80" />블루 킬</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-400/80" />레드 킬</span>
        {[
          { src: OBJECTIVE_ICONS.dragon,   label: "드래곤" },
          { src: OBJECTIVE_ICONS.baron,    label: "바론" },
          { src: OBJECTIVE_ICONS.elder,    label: "장로" },
          { src: OBJECTIVE_ICONS.herald,   label: "전령" },
          { src: OBJECTIVE_ICONS.voidGrub, label: "공허충" },
          { src: OBJECTIVE_ICONS.tower,    label: "포탑" },
        ].map(({ src, label }) => (
          <span key={label} className="flex items-center gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-3 w-3 object-contain" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
