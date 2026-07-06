"use client";

import { useId, useState } from "react";
import type { MatchTimelineFrame, TimelineEvent } from "@/lib/data/lck";
import type { Player } from "@/lib/types";
import { OBJECTIVE_ICONS } from "@/lib/objectives";

const SVG_W    = 800;
const PAD_X    = 28;
const ITEM_SZ  = 18;   // icon diameter
const ITEM_SLT = 28;   // px per row
const KILL_R   = 5;    // kill dot radius
const TOP_MAR  = 18;
const BOT_MAR  = 28;
const MIN_HALF = 110;
const CTR_GAP  = 10;
const BADGE_R  = 5;    // count badge radius

function toX(ms: number, duration: number): number {
  return PAD_X + (ms / 1000 / duration) * (SVG_W - PAD_X * 2);
}

type ChartPoint = { x: number; y: number };

function smoothPath(points: ChartPoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const commands = [`M ${points[0].x} ${points[0].y}`];

  for (let index = 1; index < points.length - 1; index++) {
    const current = points[index];
    const next = points[index + 1];
    const midpointX = (current.x + next.x) / 2;
    const midpointY = (current.y + next.y) / 2;
    commands.push(`Q ${current.x} ${current.y}, ${midpointX} ${midpointY}`);
  }

  const last = points.at(-1)!;
  const penultimate = points.at(-2)!;
  commands.push(`Q ${penultimate.x} ${penultimate.y}, ${last.x} ${last.y}`);

  return commands.join(" ");
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
  cx, cy, cluster, onHover,
}: {
  cx: number; cy: number; cluster: PlacedCluster; onHover: () => void;
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
          fill="currentColor" stroke="var(--timeline-chart-surface)" strokeWidth={1.5} />
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
  frames = [],
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
  frames?: MatchTimelineFrame[];
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

  // 아이콘(킬/오브젝트)이 실제로 필요로 하는 최소 높이(겹치면 안 되는 진짜 하한)
  const blueIconMin = (maxBlueRow + 1) * ITEM_SLT;
  const redIconMin  = (maxRedRow  + 1) * ITEM_SLT;
  // 기존과 동일한 전체 높이(변하지 않음) — 이 안에서만 블루/레드 비중을 재분배한다
  const totalH = Math.max(blueIconMin, MIN_HALF) + Math.max(redIconMin, MIN_HALF);

  // 골드 프레임 동기화가 있으면 실제 분당 골드 차이를 쓰고, 없으면 킬 차이로 대체한다(이 경우 단위는 킬 개수).
  const goldPoints = frames
    .filter((f) => f.goldDiff !== null || (f.blueTotalGold !== null && f.redTotalGold !== null))
    .map((f) => ({
      seconds: f.timestampMs / 1000,
      diff: (f.goldDiff ?? (f.blueTotalGold as number) - (f.redTotalGold as number)),
    }))
    .sort((a, b) => a.seconds - b.seconds);
  const hasGoldFrames = goldPoints.length >= 2;
  const unit: "gold" | "kills" = hasGoldFrames ? "gold" : "kills";

  let maxBlueLead: number;
  let maxRedLead: number;
  let displayDiffAt: (seconds: number) => number;

  if (hasGoldFrames) {
    maxBlueLead = Math.max(0, ...goldPoints.map((p) => p.diff));
    maxRedLead  = Math.max(0, ...goldPoints.map((p) => -p.diff));
    displayDiffAt = (seconds: number) => {
      if (seconds <= goldPoints[0].seconds) return goldPoints[0].diff;
      const last = goldPoints[goldPoints.length - 1];
      if (seconds >= last.seconds) return last.diff;
      for (let i = 0; i < goldPoints.length - 1; i++) {
        const a = goldPoints[i], b = goldPoints[i + 1];
        if (seconds >= a.seconds && seconds <= b.seconds) {
          const t = (seconds - a.seconds) / (b.seconds - a.seconds);
          return a.diff + (b.diff - a.diff) * t;
        }
      }
      return 0;
    };
  } else {
    let tmpDiff = 0;
    maxBlueLead = 0;
    maxRedLead = 0;
    for (const e of killEvents) {
      if (e.teamId === blueTeamId) tmpDiff++; else tmpDiff--;
      maxBlueLead = Math.max(maxBlueLead, tmpDiff);
      maxRedLead = Math.max(maxRedLead, -tmpDiff);
    }
    const transitionSeconds = Math.min(90, Math.max(45, duration / 5));
    const eventTransitions = killEvents.map((event) => {
      const eventSeconds = event.timestampMs / 1000;
      const start = Math.max(0, Math.min(eventSeconds - transitionSeconds / 2, duration - transitionSeconds));
      return {
        start,
        end: Math.min(duration, start + transitionSeconds),
        delta: event.teamId === blueTeamId ? 1 : -1,
      };
    });
    const smoothStep = (value: number) => {
      const clamped = Math.min(1, Math.max(0, value));
      return clamped * clamped * (3 - 2 * clamped);
    };
    displayDiffAt = (seconds: number) => eventTransitions.reduce((sum, transition) => {
      const progress = transition.end === transition.start
        ? 1
        : (seconds - transition.start) / (transition.end - transition.start);
      return sum + transition.delta * smoothStep(progress);
    }, 0);
  }

  // 한쪽 팀이 계속 우세해서 다른 쪽이 거의 0 근처에만 머무는 경우, 전체 높이(totalH)는
  // 그대로 둔 채 그 안에서만 블루/레드 비중을 골드(킬) 차이 비율에 맞게 재분배한다.
  // 아이콘이 겹치면 안 되므로 각자의 진짜 최소 높이(blueIconMin/redIconMin) 밑으로는
  // 줄이지 않고, 모자란 만큼은 반대쪽에서 가져온다.
  const totalLead = maxBlueLead + maxRedLead;
  const blueLeadRatio = totalLead > 0 ? maxBlueLead / totalLead : 0.5;
  let blueH = totalH * blueLeadRatio;
  let redH  = totalH - blueH;
  if (blueH < blueIconMin) { blueH = blueIconMin; redH = totalH - blueH; }
  if (redH < redIconMin)   { redH = redIconMin;   blueH = totalH - redH; }

  const graphTop = TOP_MAR;
  const centerY  = graphTop + blueH + CTR_GAP;
  const graphBot = centerY  + CTR_GAP + redH;
  const axisY    = graphBot;
  const svgH     = axisY + BOT_MAR;

  const blueCY = (row: number) => graphTop + ITEM_SZ / 2 + row * ITEM_SLT;
  const redCY  = (row: number) => centerY  + CTR_GAP + ITEM_SZ / 2 + row * ITEM_SLT;

  // 두 팀 y축 단위를 통일하지 않고, 각자 실제 최대치에 맞춰 독립적으로 스케일링한다
  // (한쪽이 크게 앞서도 반대쪽의 작은 변화가 눌려 보이지 않게).
  const scaleFloor = unit === "kills" ? 5 : 1000;
  const blueScaleMax = Math.max(scaleFloor, maxBlueLead);
  const redScaleMax  = Math.max(scaleFloor, maxRedLead);

  const ampBlue = blueH * 0.92;
  const ampRed  = redH  * 0.92;
  const dy = (d: number) =>
    d >= 0 ? centerY - (d / blueScaleMax) * ampBlue : centerY + (-d / redScaleMax) * ampRed;

  const sampleStep = Math.max(5, duration / 140);
  const chartPoints: ChartPoint[] = [];
  for (let seconds = 0; seconds < duration; seconds += sampleStep) {
    chartPoints.push({ x: toX(seconds * 1000, duration), y: dy(displayDiffAt(seconds)) });
  }
  const endX = SVG_W - PAD_X;
  chartPoints.push({ x: endX, y: dy(displayDiffAt(duration)) });
  const lineD = smoothPath(chartPoints);
  const areaD = `${lineD} L ${endX} ${centerY} L ${PAD_X} ${centerY} Z`;

  const mins: number[] = [];
  for (let m = 5; m * 60 < duration; m += 5) mins.push(m);

  // y축 그리드 간격: 킬 단위는 1~2 단위로, 골드 단위는 라운드 넘버(1000/2000/5000 등)로 잡는다.
  // 블루/레드 각자의 최대치를 기준으로 따로 계산해 서로 다른 단위 간격을 쓸 수 있다.
  function computeGridStep(maxVal: number) {
    if (unit === "kills") return maxVal <= 4 ? 1 : maxVal <= 8 ? 2 : Math.ceil(maxVal / 4);
    const rough = maxVal / 4;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const normalized = rough / magnitude;
    const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return niceNormalized * magnitude;
  }
  const blueGridStep = computeGridStep(blueScaleMax);
  const redGridStep  = computeGridStep(redScaleMax);
  const gridValues: number[] = [0];
  for (let d = blueGridStep; d <= blueScaleMax; d += blueGridStep) gridValues.push(d);
  for (let d = redGridStep; d <= redScaleMax; d += redGridStep) gridValues.push(-d);
  const formatDiffLabel = (d: number) => {
    if (d === 0) return "0";
    if (unit === "kills") return `${d > 0 ? "+" : ""}${d}`;
    const k = d / 1000;
    return `${d > 0 ? "+" : ""}${Number.isInteger(k) ? k : k.toFixed(1)}K`;
  };

  return (
    <div className="game-timeline-chart relative w-full select-none">
      <div className="flex items-center justify-between border-b border-border px-5 py-4 text-xs font-semibold">
        <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
          {blueTeamName}
          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 tabular-nums">{blueKills} K</span>
        </span>
        {goldDiff !== null && (
          <span className={`rounded-full px-2.5 py-1 tabular-nums ${goldDiff > 0 ? "bg-blue-500/10 text-blue-600 dark:text-blue-300" : goldDiff < 0 ? "bg-red-500/10 text-red-600 dark:text-red-300" : "bg-surface-muted text-muted"}`}>
            골드 {goldFmt(goldDiff)}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 tabular-nums">{redKills} K</span>
          {redTeamName}
        </span>
      </div>

      <svg viewBox={`0 0 ${SVG_W} ${svgH}`} className="block w-full" onMouseLeave={() => setTooltip(null)}>
        <defs>
          <clipPath id={`${uid}-bc`}>
            <rect x={PAD_X} y={graphTop} width={SVG_W - PAD_X * 2} height={blueH + CTR_GAP} />
          </clipPath>
          <clipPath id={`${uid}-rc`}>
            <rect x={PAD_X} y={centerY} width={SVG_W - PAD_X * 2} height={CTR_GAP + redH} />
          </clipPath>
          <linearGradient id={`${uid}-gb`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4c8dff" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#4c8dff" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id={`${uid}-gr`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ff5b6e" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#ff5b6e" stopOpacity="0.05" />
          </linearGradient>
          <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x={PAD_X} y={graphTop} width={SVG_W - PAD_X * 2} height={graphBot - graphTop} rx={8} fill="var(--timeline-chart-surface)" />

        <path d={areaD} fill={`url(#${uid}-gb)`} clipPath={`url(#${uid}-bc)`} />
        <path d={areaD} fill={`url(#${uid}-gr)`} clipPath={`url(#${uid}-rc)`} />

        {/* y축 그리드 — 0 기준선만 그리고, 나머지 값은 라벨만 표시해 잔선을 없앤다 */}
        {gridValues.map((d) => {
          const y = dy(d);
          return (
            <g key={`gy${d}`}>
              {d === 0 && (
                <line x1={PAD_X} y1={y} x2={SVG_W - PAD_X} y2={y}
                  stroke="var(--timeline-chart-muted)" strokeWidth={1.6} />
              )}
              <text x={PAD_X - 4} y={y + 3} textAnchor="end" fontSize={7}
                fill={d > 0 ? "#4c8dff" : d < 0 ? "#ff5b6e" : "var(--timeline-chart-muted)"} fontWeight="600">
                {formatDiffLabel(d)}
              </text>
            </g>
          );
        })}

        <path d={lineD} fill="none" stroke="#4c8dff" strokeWidth={3.2} clipPath={`url(#${uid}-bc)`} filter={`url(#${uid}-glow)`} />
        <path d={lineD} fill="none" stroke="#ff5b6e" strokeWidth={3.2} clipPath={`url(#${uid}-rc)`} filter={`url(#${uid}-glow)`} />

        <text x={PAD_X + 6} y={graphTop + blueH / 2 + 3} textAnchor="start" fontSize={8} fontWeight="700" fill="#60a5fa" fillOpacity={0.7}>{blueTeamName}</text>
        <text x={PAD_X + 6} y={centerY + CTR_GAP + redH / 2 + 3} textAnchor="start" fontSize={8} fontWeight="700" fill="#f87171" fillOpacity={0.7}>{redTeamName}</text>

        {mins.map((m) => {
          const x = tx(m * 60 * 1000);
          return <line key={`g${m}`} x1={x} y1={graphTop} x2={x} y2={graphBot}
            stroke="var(--timeline-chart-grid)" strokeWidth={0.7} strokeDasharray="2 4" />;
        })}

        <line x1={PAD_X} y1={axisY} x2={SVG_W - PAD_X} y2={axisY} stroke="var(--timeline-chart-grid)" strokeWidth={0.8} />
        {mins.map((m) => {
          const x = tx(m * 60 * 1000);
          return (
            <g key={m}>
              <line x1={x} y1={axisY} x2={x} y2={axisY + 3} stroke="var(--timeline-chart-muted)" strokeWidth={0.8} />
              <text x={x} y={axisY + 11} textAnchor="middle" fontSize={7} fill="var(--timeline-chart-muted)">{m}&apos;</text>
            </g>
          );
        })}

        {/* 블루 클러스터 */}
        {blueClusters.map((c) => {
          const x = tx(c.ms);
          const cy = blueCY(c.row);
          return (
            <g key={`b-${c.id}`} style={{ color: "#93c5fd" }}>
              <ClusterIcon cx={x} cy={cy} cluster={c}
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
              <ClusterIcon cx={x} cy={cy} cluster={c}
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

      <div className="flex flex-wrap gap-x-3 gap-y-1 px-5 pb-4 pt-2 text-xs text-muted">
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
