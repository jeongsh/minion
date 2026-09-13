"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Chart,
  Interaction,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Filler,
  Tooltip,
} from "chart.js";
import type { MatchTimelineFrame, TimelineEvent } from "@/lib/data/lck";
import type { Player } from "@/lib/types";
import { OBJECTIVE_ICONS } from "@/lib/objectives";

Chart.register(LineController, LineElement, PointElement, LinearScale, Filler, Tooltip);

// 그래프 캔버스 전체가 아니라, 실제로 색칠된 영역(라인과 중앙선 사이) 위에 마우스가 있을 때만
// 호버/툴팁이 뜨도록 커스텀 interaction 모드를 하나 등록한다. 데이터는 (dy(diff) - centerY)라서
// "0 = 중앙선"이다.
const FILL_AREA_MODE = "fillArea" as const;
if (!(Interaction.modes as unknown as Record<string, unknown>)[FILL_AREA_MODE]) {
  (Interaction.modes as unknown as Record<string, typeof Interaction.modes.index>)[FILL_AREA_MODE] = (chart, e, options) => {
    const data = chart.data.datasets[0]?.data as { x: number; y: number }[] | undefined;
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;
    if (!data || data.length < 2 || !xScale || !yScale || e.x == null || e.y == null) return [];

    let idx = -1;
    for (let i = 0; i < data.length - 1; i++) {
      const x1 = xScale.getPixelForValue(data[i].x);
      const x2 = xScale.getPixelForValue(data[i + 1].x);
      if (e.x >= x1 && e.x <= x2) { idx = i; break; }
    }
    if (idx === -1) return [];

    const x1 = xScale.getPixelForValue(data[idx].x);
    const x2 = xScale.getPixelForValue(data[idx + 1].x);
    const y1 = yScale.getPixelForValue(data[idx].y);
    const y2 = yScale.getPixelForValue(data[idx + 1].y);
    const t = x2 === x1 ? 0 : (e.x - x1) / (x2 - x1);
    const curvePx = y1 + (y2 - y1) * t;
    const originPx = yScale.getPixelForValue(0);
    const within = curvePx <= originPx ? (e.y >= curvePx && e.y <= originPx) : (e.y <= curvePx && e.y >= originPx);
    if (!within) return [];

    return Interaction.modes.index(chart, e, options);
  };
}

const DESKTOP_SVG_W = 800;
const TABLET_SVG_W = 680;
const MOBILE_SVG_W = 440;
const PAD_X    = 42;
const TOUCH_SIZE = 20;
const ITEM_SLT = 18;   // px per row
const TOP_MAR  = 16;
const BOT_MAR  = 26;
const MIN_HALF = 82;
const CTR_GAP  = 10;
const CARD_RX  = 16;   // 카드 모서리 반경(라운드 코너 밖으로 축선이 튀어나오지 않게 인셋 계산에도 사용)

function toX(ms: number, duration: number, svgW: number): number {
  return PAD_X + (ms / 1000 / duration) * (svgW - PAD_X);
}

function useTimelineSvgWidth() {
  const [svgW, setSvgW] = useState(DESKTOP_SVG_W);

  useEffect(() => {
    const update = () => {
      if (window.matchMedia("(max-width: 639px)").matches) {
        setSvgW(MOBILE_SVG_W);
      } else if (window.matchMedia("(max-width: 1023px)").matches) {
        setSvgW(TABLET_SVG_W);
      } else {
        setSvgW(DESKTOP_SVG_W);
      }
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return svgW;
}

type ChartPoint = { x: number; y: number };

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

// 몬스터 종류별 정식 한글 명칭(LoL 한국 클라이언트 기준).
const MONSTER_KR: Record<string, string> = {
  baron:           "내셔 남작",
  elder:           "장로 드래곤",
  herald:          "협곡의 전령",
  voidgrub:        "공허 유충",
  dragon_fire:     "화염 드래곤",
  dragon_ocean:    "바다 드래곤",
  dragon_cloud:    "바람 드래곤",
  dragon_mountain: "대지 드래곤",
  dragon_hextech:  "마법공학 드래곤",
  dragon_chemtech: "화학공학 드래곤",
  dragon:          "드래곤",
};

// 포탑 위치(라인)의 한글 표기.
const LANE_KR: Record<string, string> = { TOP: "탑", MID: "미드", MIDDLE: "미드", BOT: "봇", BOTTOM: "봇" };

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
    const name = MONSTER_KR[getEventKind(e)] ?? "몬스터";
    return `${t}  ${name}${p ? `  (${p})` : ""}`;
  }
  const laneRaw = e.laneType?.replace("_LANE", "") ?? "";
  const lane = LANE_KR[laneRaw.toUpperCase()] ?? laneRaw;
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

// ── 클러스터 배치 ────────────────────────────────────────────────

type PlacedCluster = Cluster & { row: number };

// ── 아이콘 렌더러 ─────────────────────────────────────────────────

// ── 헤더 요약 ────────────────────────────────────────────────────

function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type TeamStats = { kills: number; towers: number; dragons: number; heralds: number; barons: number };

// 팀별 오브젝트 요약 스트립(킬 · 타워 · 용 · 전령 · 바론). 0 개여도 양쪽 정렬이 맞도록 항상 표시한다.
function StatStrip({ stats, accent }: { stats: TeamStats; accent: "blue" | "red" }) {
  const dot = accent === "blue" ? "bg-team-blue" : "bg-team-red";
  const items: { node: ReactNode; count: number; key: string }[] = [
    { node: <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />, count: stats.kills, key: "k" },
    /* eslint-disable @next/next/no-img-element */
    { node: <img src={OBJECTIVE_ICONS.tower}  alt="타워" className="h-3.5 w-3.5 object-contain" />, count: stats.towers,  key: "t" },
    { node: <img src={OBJECTIVE_ICONS.dragon} alt="용"   className="h-3.5 w-3.5 object-contain" />, count: stats.dragons, key: "d" },
    { node: <img src={OBJECTIVE_ICONS.herald} alt="전령" className="h-3.5 w-3.5 object-contain" />, count: stats.heralds, key: "h" },
    { node: <img src={OBJECTIVE_ICONS.baron}  alt="바론" className="h-3.5 w-3.5 object-contain" />, count: stats.barons,  key: "b" },
    /* eslint-enable @next/next/no-img-element */
  ];
  return (
    <span className="flex items-center gap-1.5 text-[13px] font-medium tabular-nums text-muted sm:gap-2">
      {items.map(({ node, count, key }) => (
        <span key={key} className="flex items-center gap-0.5">
          {node}
          <span>{count}</span>
        </span>
      ))}
    </span>
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
  winnerTeamId,
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
  winnerTeamId?: string | null;
}) {
  const [tooltip, setTooltip] = useState<{ id: string; lines: string[] } | null>(null);
  const [showObjectives, setShowObjectives] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const svgW = useTimelineSvgWidth();
  const rootRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(MOBILE_SVG_W);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  const scale = containerWidth / svgW;
  const slot = TOUCH_SIZE / scale;
  const markerX = (ms: number) => Math.min(containerWidth - TOUCH_SIZE / 2, Math.max(TOUCH_SIZE / 2, toX(ms, duration, svgW) * scale)) / scale;
  const duration = durationSeconds ?? Math.ceil((events.at(-1)?.timestampMs ?? 0) / 1000);
  const tx = (ms: number) => toX(ms, duration, svgW);

  const uniqueEvents = Array.from(new Map(events.map((e) => [e.id, e])).values());
  const killEvents = uniqueEvents.filter((e) => e.eventType === "CHAMPION_KILL").sort((a, b) => a.timestampMs - b.timestampMs);
  const objEvents  = uniqueEvents.filter((e) => e.eventType !== "CHAMPION_KILL" && !(e.buildingType ?? "").includes("INHIBITOR")).sort((a, b) => a.timestampMs - b.timestampMs);

  const blueKills = killEvents.filter((e) => e.teamId === blueTeamId).length;
  const redKills  = killEvents.filter((e) => e.teamId === redTeamId).length;
  const goldDiff  = blueGold != null && redGold != null ? blueGold - redGold : null;
  const goldFmt   = (g: number) => `${g >= 0 ? "+" : ""}${(g / 1000).toFixed(1)}K`;

  // 그래프 마커로 표시할 오브젝트: 용(장로 포함)·바론·공허유충·전령만. 킬과 타워는 마커에서 제외한다.
  const markerEvents = objEvents.filter((e) => getEventKind(e) !== "tower");

  // 헤더 요약용 팀별 오브젝트 집계(킬/타워 포함). 용은 장로 포함 모든 드래곤을 합산한다.
  const countObjectives = (teamId: string) => {
    const c = { kills: 0, towers: 0, dragons: 0, heralds: 0, barons: 0, grubs: 0 };
    c.kills = teamId === blueTeamId ? blueKills : redKills;
    for (const e of objEvents) {
      if (e.teamId !== teamId) continue;
      const k = getEventKind(e);
      if (k === "tower") c.towers++;
      else if (k === "baron") c.barons++;
      else if (k === "herald") c.heralds++;
      else if (k === "voidgrub") c.grubs++;
      else if (k === "elder" || k.startsWith("dragon")) c.dragons++;
    }
    return c;
  };
  const blueStats = countObjectives(blueTeamId);
  const redStats  = countObjectives(redTeamId);

  const placeClusters = (teamId: string): PlacedCluster[] => {
    const rowEnds: number[] = [];
    return clusterTeamEvents(markerEvents.filter((e) => e.teamId === teamId), 60_000, players).map((c) => {
      const x = markerX(c.ms);
      let row = rowEnds.findIndex((end) => x - end >= slot);
      if (row < 0) row = rowEnds.length;
      rowEnds[row] = x;
      return { ...c, row };
    });
  };
  const blueClusters = placeClusters(blueTeamId);
  const redClusters = placeClusters(redTeamId);
  const blueRows = Math.max(0, ...blueClusters.map((c) => c.row + 1));
  const redRows = Math.max(0, ...redClusters.map((c) => c.row + 1));

  // 단일 행이므로 아이콘이 차지하는 최소 높이는 한 줄분이다.
  const blueIconMin = ITEM_SLT;
  const redIconMin  = ITEM_SLT;

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

  // 블루/레드 각자의 최댓값에 맞춰 독립적으로 스케일링한다(이기고 있는 쪽 격차가 크면 그쪽에
  // 더 많은 세로 공간을 준다). 골드 단위일 땐 무조건 1000 골드 단위로 올림해서 딱 떨어지는
  // 눈금으로 만든다(예: 5.8K → 6K, 13.2K → 14K).
  // 위/아래 눈금을 동일한 최댓값으로 맞춘다(상단이 9K면 하단도 9K). 양쪽 리드 중 큰 값을
  // 기준으로 올림해서 대칭 스케일을 쓰면 격차가 더 극명하게 보이고 정돈된 느낌이 난다.
  const roundScale = (v: number) => (unit === "kills" ? Math.max(5, v) : Math.max(1000, Math.ceil(v / 1000) * 1000));
  const scaleMax = roundScale(Math.max(maxBlueLead, maxRedLead));
  const blueScaleMax = scaleMax;
  const redScaleMax  = scaleMax;

  // 전체 높이는 고정하고, 그 안에서 블루/레드 비중을 각자 최댓값 비율대로 나눈다. 아이콘이
  // 겹치면 안 되므로 각자의 진짜 최소 높이(blueIconMin/redIconMin) 밑으로는 줄이지 않는다.
  const totalH = Math.max(blueIconMin, MIN_HALF) + Math.max(redIconMin, MIN_HALF);
  const blueRatio = totalH > 0 ? blueScaleMax / (blueScaleMax + redScaleMax) : 0.5;
  let blueH = totalH * blueRatio;
  let redH  = totalH - blueH;
  if (blueH < blueIconMin) { blueH = blueIconMin; redH = totalH - blueH; }
  if (redH < redIconMin)   { redH = redIconMin;   blueH = totalH - redH; }

  const graphTop = TOP_MAR + (showObjectives ? blueRows * slot : 0);
  const centerY  = graphTop + blueH + CTR_GAP;
  const graphBot = centerY  + CTR_GAP + redH;
  const axisY    = graphBot + (showObjectives ? redRows * slot : 0);
  const svgH     = axisY + BOT_MAR;

  // 가까운 오브젝트는 20px 터치 영역이 겹치지 않도록 별도 행에 배치한다.
  const blueCY = (row: number) => graphTop - (row + 0.5) * slot;
  const redCY  = (row: number) => graphBot + (row + 0.5) * slot;

  const ampBlue = blueH * 0.92;
  const ampRed  = redH  * 0.92;
  const dy = (d: number) =>
    d >= 0 ? centerY - (d / blueScaleMax) * ampBlue : centerY + (-d / redScaleMax) * ampRed;

  // chart.js의 단일 선형 스케일은 블루/레드가 서로 다른 기울기(비대칭 스케일링)를 가지는
  // dy()를 정확히 재현할 수 없다(스케일 하나엔 기울기가 하나뿐). 그래서 축 근사값을 맞추려고
  // 하는 대신, 애초에 dy()로 미리 변환한 픽셀 좌표를 그대로 넣어서 SVG 그리드선과 100%
  // 동일한 위치에 그려지도록 한다(툴팁에는 실제 값을 별도로 다시 계산해서 보여준다).
  // centerY만큼 미리 빼서 "0 = 중앙선"이 되게 하면, chart.js 기본 fill:'origin'(값 0 기준
  // 채우기)을 그대로 쓸 수 있어 라인과 채우기가 항상 완전히 일치한다(직접 그리던 방식은
  // 베지어 곡선을 손으로 재현하다 보니 미세하게 어긋나는 지점이 생겼었음).
  const chartPoints: ChartPoint[] = hasGoldFrames
    ? [...goldPoints, ...(goldPoints.at(-1)!.seconds < duration ? [{ seconds: duration, diff: goldPoints.at(-1)!.diff }] : [])].map((p) => ({ x: toX(p.seconds * 1000, duration, svgW), y: dy(p.diff) - centerY }))
    : (() => {
        const sampleStep = Math.max(5, duration / 140);
        const points: ChartPoint[] = [];
        for (let seconds = 0; seconds < duration; seconds += sampleStep) {
          points.push({ x: toX(seconds * 1000, duration, svgW), y: dy(displayDiffAt(seconds)) - centerY });
        }
        points.push({ x: svgW, y: dy(displayDiffAt(duration)) - centerY });
        return points;
      })();

  const mins: number[] = [];
  for (let m = 5; m * 60 < duration; m += 5) mins.push(m);

  // y축은 각 방향(블루/레드)마다 최댓값과 그 중간값 두 개만 보여줘서 잔눈금 없이 깔끔하게 표시한다.
  const midOf = (max: number) => (unit === "kills" ? Math.round(max / 2) : max / 2);
  const gridValues: number[] = [0, midOf(blueScaleMax), blueScaleMax, -midOf(redScaleMax), -redScaleMax];
  const formatDiffLabel = (d: number) => {
    if (d === 0) return "0";
    if (unit === "kills") return `${Math.abs(d)}`;
    const k = Math.abs(d) / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
  };

  // 라인/영역만 chart.js가 그리고, 축 라벨·그리드·킬/오브젝트 아이콘은 기존처럼 SVG로 그려서 위에 겹친다.
  // chartPoints 등은 events/frames/duration 등 props에서 결정론적으로 파생되므로, 매 렌더마다
  // 새로 생기는 배열 레퍼런스 대신 실제 입력 props만 의존성으로 둬서 불필요한 재생성을 막는다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || chartPoints.length === 0) return;

    // 라인/영역 색은 CSS 변수(--team-blue/--team-red)에서 읽어와 라이트·다크 테마에 맞춘다.
    const styles = getComputedStyle(canvas);
    const blueLine = styles.getPropertyValue("--team-blue").trim() || "#4c8dff";
    const redLine  = styles.getPropertyValue("--team-red").trim()  || "#ff5b6e";
    const rgba = (hex: string, a: number) => {
      const h = hex.replace("#", "");
      const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
      const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    };

    // chartPoints는 dy()로 변환한 픽셀 좌표에서 centerY(중앙선)를 뺀 값이라 "0 = 중앙선"이다.
    // 그래서 chart.js 기본 fill:'origin'(값 0 기준 채우기)을 그대로 쓸 수 있고, 라인과 채우기가
    // 항상 완전히 같은 곡선을 기준으로 그려져 어긋나는 지점이 생기지 않는다. 색은 단색 대신
    // 위(블루)에서 아래(레드)로 이어지는 세로 그라데이션으로 채운다.
    chartRef.current?.destroy();
    chartRef.current = new Chart(canvas, {
      type: "line",
      data: {
        datasets: [
          {
            data: chartPoints,
            fill: "origin",
            borderWidth: 1.8,
            pointRadius: 0,
            tension: 0.28,
            clip: 0,
            segment: {
              borderColor: (ctx) => ((ctx.p0.parsed.y ?? 0) + (ctx.p1.parsed.y ?? 0)) / 2 <= 0 ? blueLine : redLine,
            },
            backgroundColor: (ctx) => {
              const { chart } = ctx;
              const area = chart.chartArea;
              if (!area) return rgba(blueLine, 0.2);
              const centerFrac = (centerY - graphTop) / (graphBot - graphTop);
              const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
              gradient.addColorStop(0, rgba(blueLine, 0.32));
              gradient.addColorStop(centerFrac, rgba(blueLine, 0.04));
              gradient.addColorStop(centerFrac, rgba(redLine, 0.04));
              gradient.addColorStop(1, rgba(redLine, 0.32));
              return gradient;
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: { padding: 0 },
        // chart.js 타입이 내장 모드 이름만 허용해서, 위에서 등록한 커스텀 모드 이름은 캐스팅이 필요하다.
        interaction: { mode: FILL_AREA_MODE as unknown as "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: FILL_AREA_MODE as unknown as "index",
            intersect: false,
            callbacks: {
              title: (items) => {
                const xPx = items[0]?.parsed.x ?? PAD_X;
                const seconds = ((xPx - PAD_X) / (svgW - PAD_X)) * duration;
                const m = Math.floor(seconds / 60);
                const s = Math.floor(seconds % 60);
                return `${m}:${String(s).padStart(2, "0")}`;
              },
              label: (items) => {
                const xPx = items.parsed.x ?? PAD_X;
                const seconds = ((xPx - PAD_X) / (svgW - PAD_X)) * duration;
                const v = displayDiffAt(seconds);
                const leader = v > 0 ? blueTeamName : v < 0 ? redTeamName : "동점";
                const abs = Math.abs(v);
                const magnitude = unit === "kills" ? `${abs}` : `${Number.isInteger(abs / 1000) ? abs / 1000 : (abs / 1000).toFixed(1)}K`;
                return `${leader} ${magnitude}`;
              },
            },
          },
        },
        scales: {
          x: { type: "linear", min: PAD_X, max: svgW, display: false },
          y: { type: "linear", min: graphTop - centerY, max: graphBot - centerY, reverse: true, display: false },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chartPoints/centerY/graphTop/graphBot는 아래 props에서 결정론적으로 파생됨
  }, [events, frames, durationSeconds, blueTeamId, redTeamId, svgW, containerWidth, showObjectives]);

  if (!events.length) {
    return <div className="flex items-center justify-center py-6 text-[15px] text-muted">타임라인 데이터 없음</div>;
  }

  return (
    <div ref={rootRef} className="game-timeline-chart relative w-full select-none">
      <div className="relative w-full">
        {/* 배경 레이어: 카드 배경, y축 그리드/라벨, 팀명, 시간 눈금 */}
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="block w-full">
          <rect x={PAD_X} y={graphTop} width={svgW - PAD_X} height={graphBot - graphTop} rx={CARD_RX} fill="transparent" />

          {gridValues.map((d) => {
            const y = dy(d);
            return (
              <g key={`gy${d}`}>
                <line x1={PAD_X} y1={y} x2={svgW} y2={y}
                  stroke="var(--timeline-chart-grid)" strokeWidth={d === 0 ? 1.2 : 0.7} />
                <text x={PAD_X - 4} y={y + 3} textAnchor="end" fontSize={13 / scale}
                  fill={d > 0 ? "var(--team-blue)" : d < 0 ? "var(--team-red)" : "var(--timeline-chart-muted)"} fontWeight="500">
                  {formatDiffLabel(d)}
                </text>
              </g>
            );
          })}

          <text x={PAD_X + 6} y={graphTop + 11} textAnchor="start" fontSize={13 / scale} fontWeight="500" fill="var(--team-blue)">{blueTeamName}</text>
          <text x={PAD_X + 6} y={graphBot - 6} textAnchor="start" fontSize={13 / scale} fontWeight="500" fill="var(--team-red)">{redTeamName}</text>

          {mins.map((m) => {
            const x = tx(m * 60 * 1000);
            return (
              <text key={m} x={x} y={axisY + 20} textAnchor="middle" fontSize={13 / scale} fill="var(--timeline-chart-muted)">{m}&apos;</text>
            );
          })}
        </svg>

        {/* 중간 레이어: chart.js가 그리는 골드/킬 차이 라인+영역.
            chart.js는 responsive:true일 때 캔버스 크기를 "부모 요소" 기준으로 자기가 다시 계산해서
            강제로 채워버리므로, 위치/크기/둥근모서리는 별도 wrapper div에 주고 canvas는 그 안에서
            100%/100%로만 채우게 한다(그래야 chart.js가 부모=wrapper 크기에 맞춰 정확히 리사이즈됨). */}
        <div
          className="absolute overflow-hidden"
          style={{
            left: `${(PAD_X / svgW) * 100}%`,
            top: `${(graphTop / svgH) * 100}%`,
            width: `${((svgW - PAD_X) / svgW) * 100}%`,
            height: `${((graphBot - graphTop) / svgH) * 100}%`,
            borderRadius: `${(CARD_RX / svgW) * 100}%`,
          }}
        >
          <canvas ref={canvasRef} className="block h-full w-full" />
        </div>

        {/* 전경 레이어: 킬/오브젝트 클러스터 아이콘 (호버 툴팁 포함).
            svg 전체를 pointer-events:none으로 비워서, 아이콘이 없는 투명한 부분은 마우스 이벤트가
            아래 chart.js 캔버스로 그대로 통과해 그래프 자체 호버 툴팁도 같이 동작하게 한다. */}
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="absolute inset-0 block h-full w-full"
          style={{ pointerEvents: "none" }}
        >
          {showObjectives && [
            { clusters: blueClusters, cy: blueCY, side: "blue" },
            { clusters: redClusters, cy: redCY, side: "red" },
          ].flatMap(({ clusters, cy, side }) => clusters.map((c) => (
            <g key={`${side}-${c.id}`} className={side === "blue" ? "text-team-blue" : "text-team-red"}>
              <line x1={markerX(c.ms)} y1={cy(c.row)} x2={tx(c.ms)} y2={dy(displayDiffAt(c.ms / 1000))} stroke="currentColor" strokeOpacity={0.6} strokeWidth={0.9} strokeDasharray="1.5 2" />
              <circle cx={tx(c.ms)} cy={dy(displayDiffAt(c.ms / 1000))} r={1.8} fill="currentColor" />
            </g>
          )))}
        </svg>
        {showObjectives && [
          { clusters: blueClusters, cy: blueCY, side: "blue" },
          { clusters: redClusters, cy: redCY, side: "red" },
        ].flatMap(({ clusters, cy, side }) => clusters.map((c) => {
          const id = `${side}-${c.id}`;
          const selected = tooltip?.id === id;
          return (
            <button
              key={id} type="button" aria-label={c.tooltipLines.join(", ")} aria-pressed={selected}
              onClick={() => setTooltip({ id, lines: c.tooltipLines })}
              onMouseEnter={() => { if (window.matchMedia("(hover: hover)").matches) setTooltip({ id, lines: c.tooltipLines }); }}
              onFocus={() => setTooltip({ id, lines: c.tooltipLines })}
              className={`absolute flex h-5 w-5 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 ${side === "blue" ? "text-team-blue" : "text-team-red"}`}
              style={{ left: markerX(c.ms) * scale - TOUCH_SIZE / 2, top: cy(c.row) * scale - TOUCH_SIZE / 2 }}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full border-current bg-background ${selected ? "border-2" : "border"}`}>
                {c.info?.iconUrl && <span aria-hidden="true" className="h-3.5 w-3.5 bg-current" style={{ maskImage: `url(${c.info.iconUrl})`, maskSize: "contain", maskRepeat: "no-repeat", maskPosition: "center" }} />}
              </span>
              {c.count > 1 && <span className={`absolute -right-1 -top-1 flex h-2.5 min-w-2.5 items-center justify-center rounded-full px-px text-[7px] font-medium leading-[10px] text-white ${side === "blue" ? "bg-team-blue" : "bg-team-red"}`}>{c.count}</span>}
            </button>
          );
        }))}
      </div>
      {showObjectives && tooltip && (
        <div aria-live="polite" className="mx-3 mb-2 space-y-1 rounded border border-border bg-background px-2.5 py-2 text-sm font-medium leading-5 break-words">
          {tooltip.lines.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-4 pb-3 pt-1 text-[13px] text-muted sm:gap-x-3 sm:text-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3">
          {showObjectives && [
            { src: OBJECTIVE_ICONS.elder,    label: "장로" },
            { src: OBJECTIVE_ICONS.baron,    label: "바론" },
            { src: OBJECTIVE_ICONS.herald,   label: "전령" },
            { src: OBJECTIVE_ICONS.voidGrub, label: "공허 유충" },
          ].map(({ src, label }) => (
            <span key={label} className="flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-4 w-4 object-contain leading-none sm:h-5 sm:w-5" />
              {label}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { setShowObjectives((v) => !v); setTooltip(null); }}
          className="min-h-11 shrink-0 rounded-full border border-border px-2.5 py-1 text-[13px] font-medium text-muted hover:bg-surface-muted sm:text-[13px]"
        >
          {showObjectives ? "오브젝트 숨기기" : "오브젝트 보기"}
        </button>
      </div>
    </div>
  );
}
