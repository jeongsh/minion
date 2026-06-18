"use client";

import { useId, useState } from "react";
import type { TimelineEvent } from "@/lib/data/lck";
import type { Player } from "@/lib/types";

// ── layout constants ────────────────────────────────────────────
const SVG_W = 800;
const PAD_X = 40;
const OBJ_BLUE_Y = 13; // blue objectives row (top)
const CHART_TOP = 26; // chart area start
const CHART_H = 70;
const CENTER_Y = CHART_TOP + CHART_H / 2; // 61
const CHART_HALF = CHART_H / 2 - 5; // 30
const AXIS_Y = CHART_TOP + CHART_H; // 96
const OBJ_RED_Y = 109; // red objectives row (bottom)
const SVG_H = 122;

// ── helpers ─────────────────────────────────────────────────────

function toX(ms: number, duration: number): number {
  return PAD_X + (ms / 1000 / duration) * (SVG_W - PAD_X * 2);
}

type ObjInfo = { label: string; color: string; isTower: boolean };

function getObjInfo(e: TimelineEvent): ObjInfo {
  if (e.eventType === "BUILDING_KILL") {
    if ((e.buildingType ?? "").includes("INHIBITOR")) return { label: "I", color: "#f472b6", isTower: false };
    return { label: "🏰", color: "#fb923c", isTower: true };
  }
  const mt = (e.monsterType ?? "").toUpperCase();
  if (mt.includes("BARON")) return { label: "B", color: "#c084fc", isTower: false };
  if (mt.includes("ELDER")) return { label: "E", color: "#f97316", isTower: false };
  if (mt.includes("RIFTHERALD") || mt === "RIFTHERALD") return { label: "H", color: "#22d3ee", isTower: false };
  if (mt.includes("HORDE")) return { label: "V", color: "#86efac", isTower: false };
  if (mt.includes("INFERNAL") || mt.includes("FIRE")) return { label: "D", color: "#ef4444", isTower: false };
  if (mt.includes("OCEAN") || mt.includes("WATER")) return { label: "D", color: "#60a5fa", isTower: false };
  if (mt.includes("CLOUD") || mt.includes("AIR")) return { label: "D", color: "#a3e635", isTower: false };
  if (mt.includes("MOUNTAIN") || mt.includes("EARTH")) return { label: "D", color: "#d97706", isTower: false };
  if (mt.includes("HEXTECH")) return { label: "D", color: "#818cf8", isTower: false };
  if (mt.includes("CHEMTECH")) return { label: "D", color: "#84cc16", isTower: false };
  return { label: "D", color: "#facc15", isTower: false };
}

function makeTooltip(e: TimelineEvent, players: Player[]): string {
  const min = Math.floor(e.timestampMs / 60000);
  const sec = Math.floor((e.timestampMs % 60000) / 1000);
  const t = `${min}:${String(sec).padStart(2, "0")}`;
  if (e.eventType === "CHAMPION_KILL") {
    const killer = players.find((p) => p.id === e.killerPlayerId)?.name ?? "?";
    const victim = players.find((p) => p.id === e.victimPlayerId)?.name ?? "?";
    const assists = e.assistPlayerIds
      .map((id) => players.find((p) => p.id === id)?.name ?? "?")
      .join(", ");
    return assists ? `${t}  ${killer} → ${victim}  (${assists})` : `${t}  ${killer} → ${victim}`;
  }
  if (e.eventType === "ELITE_MONSTER_KILL") {
    const p = players.find((p) => p.id === e.killerPlayerId)?.name;
    return `${t}  ${e.monsterType ?? "몬스터"}${p ? `  (${p})` : ""}`;
  }
  const lane = e.laneType?.replace("_LANE", "") ?? "";
  const btype = e.buildingType?.includes("INHIBITOR") ? "억제기" : "포탑";
  return `${t}  ${lane} ${btype}`;
}

// ── objective icon ───────────────────────────────────────────────

function ObjIcon({
  cx,
  cy,
  info,
  onHover,
}: {
  cx: number;
  cy: number;
  info: ObjInfo;
  onHover: () => void;
}) {
  if (info.isTower) {
    return (
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        fontSize={13}
        className="cursor-pointer"
        onMouseEnter={onHover}
      >
        {info.label}
      </text>
    );
  }
  return (
    <g className="cursor-pointer" onMouseEnter={onHover}>
      <circle cx={cx} cy={cy} r={7} fill={info.color} />
      <text x={cx} y={cy + 3} textAnchor="middle" fontSize={6} fill="#000" fontWeight="800">
        {info.label}
      </text>
    </g>
  );
}

// ── component ────────────────────────────────────────────────────

export function GameTimeline({
  events,
  durationSeconds,
  blueTeamId,
  redTeamId,
  blueTeamName,
  redTeamName,
  players,
}: {
  events: TimelineEvent[];
  durationSeconds: number | null;
  blueTeamId: string;
  redTeamId: string;
  blueTeamName: string;
  redTeamName: string;
  players: Player[];
}) {
  const uid = useId().replace(/:/g, "");
  const [tooltip, setTooltip] = useState<{ text: string; xPct: number } | null>(null);

  if (!events.length) {
    return (
      <div className="flex items-center justify-center py-6 text-xs text-muted">
        타임라인 데이터 없음
      </div>
    );
  }

  const duration = durationSeconds ?? Math.ceil((events.at(-1)?.timestampMs ?? 0) / 1000);

  const killEvents = events
    .filter((e) => e.eventType === "CHAMPION_KILL")
    .sort((a, b) => a.timestampMs - b.timestampMs);

  const objEvents = events
    .filter((e) => e.eventType !== "CHAMPION_KILL")
    .sort((a, b) => a.timestampMs - b.timestampMs);

  // ── kill diff path ──────────────────────────────────────────
  let tempDiff = 0;
  let maxDiff = 5;
  for (const e of killEvents) {
    if (e.teamId === blueTeamId) tempDiff++;
    else tempDiff--;
    maxDiff = Math.max(maxDiff, Math.abs(tempDiff));
  }

  const dy = (d: number) => CENTER_Y - (d / maxDiff) * CHART_HALF;
  const tx = (ms: number) => toX(ms, duration);

  let diff = 0;
  const parts: string[] = [`M ${PAD_X} ${dy(0)}`];
  for (const e of killEvents) {
    const x = tx(e.timestampMs);
    parts.push(`L ${x} ${dy(diff)}`);
    if (e.teamId === blueTeamId) diff++;
    else diff--;
    parts.push(`L ${x} ${dy(diff)}`);
  }
  const endX = tx(duration * 1000);
  parts.push(`L ${endX} ${dy(diff)}`);

  const lineD = parts.join(" ");
  const areaD = `${lineD} L ${endX} ${CENTER_Y} L ${PAD_X} ${CENTER_Y} Z`;

  // ── minute marks ──────────────────────────────────────────────
  const minuteMarks: number[] = [];
  for (let m = 5; m * 60 < duration; m += 5) minuteMarks.push(m);

  // ── objective positions (offset duplicates per row) ───────────
  const blueCounter = new Map<number, number>();
  const redCounter = new Map<number, number>();
  function objX(ms: number, side: "blue" | "red"): number {
    const bucket = Math.floor(ms / 8000);
    const counter = side === "blue" ? blueCounter : redCounter;
    const n = counter.get(bucket) ?? 0;
    counter.set(bucket, n + 1);
    return tx(ms) + n * 12;
  }

  const blueObjs = objEvents.filter((e) => e.teamId === blueTeamId);
  const redObjs = objEvents.filter((e) => e.teamId === redTeamId);

  const yLabels = [
    { d: maxDiff, label: `+${maxDiff}` },
    { d: 0, label: "0" },
    { d: -maxDiff, label: `-${maxDiff}` },
  ];

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full"
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <clipPath id={`${uid}-blue`}>
            <rect x="0" y="0" width={SVG_W} height={CENTER_Y} />
          </clipPath>
          <clipPath id={`${uid}-red`}>
            <rect x="0" y={CENTER_Y} width={SVG_W} height={CHART_H + CHART_TOP} />
          </clipPath>
        </defs>

        {/* ── blue objectives row (top) ── */}
        <text x={PAD_X - 4} y={OBJ_BLUE_Y + 5} textAnchor="end" fontSize={8} fontWeight="700" fill="#60a5fa">
          {blueTeamName}
        </text>
        {blueObjs.map((e) => {
          const info = getObjInfo(e);
          const x = objX(e.timestampMs, "blue");
          return (
            <ObjIcon
              key={e.id}
              cx={x}
              cy={OBJ_BLUE_Y}
              info={info}
              onHover={() => setTooltip({ text: makeTooltip(e, players), xPct: (x / SVG_W) * 100 })}
            />
          );
        })}

        {/* ── chart background ── */}
        <rect x={PAD_X} y={CHART_TOP} width={SVG_W - PAD_X * 2} height={CHART_H} rx={3} fill="#0d1117" />

        {/* grid lines */}
        {[0.5, -0.5].map((f) => (
          <line key={f}
            x1={PAD_X} y1={CENTER_Y + f * CHART_HALF * 1.6}
            x2={SVG_W - PAD_X} y2={CENTER_Y + f * CHART_HALF * 1.6}
            stroke="#ffffff" strokeWidth={0.3} strokeOpacity={0.06} />
        ))}

        {/* blue fill */}
        <path d={areaD} fill="#3b82f6" fillOpacity={0.22} clipPath={`url(#${uid}-blue)`} />
        {/* red fill */}
        <path d={areaD} fill="#ef4444" fillOpacity={0.22} clipPath={`url(#${uid}-red)`} />

        {/* center dashed line */}
        <line x1={PAD_X} y1={CENTER_Y} x2={SVG_W - PAD_X} y2={CENTER_Y}
          stroke="#ffffff" strokeWidth={0.6} strokeOpacity={0.15} strokeDasharray="4 4" />

        {/* kill diff line */}
        <path d={lineD} fill="none" stroke="#ffffff" strokeWidth={1.2} strokeOpacity={0.7} />

        {/* y-axis labels */}
        {yLabels.map(({ d, label }) => (
          <text key={d} x={PAD_X - 4} y={dy(d) + 3}
            textAnchor="end" fontSize={7} fill="#555" fontWeight="500">
            {label}
          </text>
        ))}

        {/* time axis */}
        <line x1={PAD_X} y1={AXIS_Y} x2={SVG_W - PAD_X} y2={AXIS_Y} stroke="#333" strokeWidth={0.5} />

        {/* minute marks */}
        {minuteMarks.map((m) => {
          const x = tx(m * 60 * 1000);
          return (
            <g key={m}>
              <line x1={x} y1={AXIS_Y - 2} x2={x} y2={AXIS_Y + 2} stroke="#444" strokeWidth={0.5} />
              <text x={x} y={AXIS_Y - 4} textAnchor="middle" fontSize={7} fill="#444">{m}'</text>
            </g>
          );
        })}

        {/* kill hover targets */}
        {killEvents.map((e) => {
          const x = tx(e.timestampMs);
          return (
            <line key={e.id} x1={x} y1={CHART_TOP} x2={x} y2={AXIS_Y}
              stroke="transparent" strokeWidth={6}
              className="cursor-pointer"
              onMouseEnter={() => setTooltip({ text: makeTooltip(e, players), xPct: (x / SVG_W) * 100 })} />
          );
        })}

        {/* ── red objectives row (bottom) ── */}
        <text x={PAD_X - 4} y={OBJ_RED_Y + 5} textAnchor="end" fontSize={8} fontWeight="700" fill="#f87171">
          {redTeamName}
        </text>
        {redObjs.map((e) => {
          const info = getObjInfo(e);
          const x = objX(e.timestampMs, "red");
          return (
            <ObjIcon
              key={e.id}
              cx={x}
              cy={OBJ_RED_Y}
              info={info}
              onHover={() => setTooltip({ text: makeTooltip(e, players), xPct: (x / SVG_W) * 100 })}
            />
          );
        })}
      </svg>

      {/* tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded bg-background/95 px-2 py-1 text-xs shadow-md ring-1 ring-border"
          style={{ left: `${Math.min(Math.max(tooltip.xPct, 5), 65)}%` }}
        >
          {tooltip.text}
        </div>
      )}

      {/* legend */}
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 px-1 text-[10px] text-muted">
        {[
          { color: "#3b82f6", label: "블루 킬 우위" },
          { color: "#ef4444", label: "레드 킬 우위" },
          { color: "#facc15", label: "D 드래곤" },
          { color: "#c084fc", label: "B 바론" },
          { color: "#22d3ee", label: "H 전령" },
          { color: "#86efac", label: "V 공허충" },
          { color: "#f472b6", label: "I 억제기" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1">🏰 포탑</span>
      </div>
    </div>
  );
}
