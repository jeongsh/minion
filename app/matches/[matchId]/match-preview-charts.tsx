import type { CSSProperties } from "react";
import { championImage } from "@/lib/champions";
import { TeamLogo } from "@/components/ui/team-logo";
import type { Champion, PlayerPosition, Team } from "@/lib/types";
import type { BriefingLane, BriefingTeamVisuals, ChampionPriority, LeagueSetRecord } from "@/lib/match-preview-visuals";
import { LANE_POSITIONS, regionLeague } from "@/lib/match-preview-visuals";
import { ACCURACY_MIN_GRADED, ACCURACY_MIN_SEGMENT, accuracyRate, type AccuracyBucket, type MatchPreviewAccuracy } from "@/lib/match-preview-accuracy";
import { ChartReveal } from "./match-preview-reveal";
import { ChampionPriorityPlot } from "./match-preview-champion-map";
import { CHART_CARD_SURFACE } from "@/components/charts/chart-card";
export { ChartCard } from "@/components/charts/chart-card";

// 같은 페이지 승부예측 바(prediction-match-bar)와 동일한 카드 표면: 라이트는 흰
// 표면 + 테두리로 흰 배경에서 또렷하게, 다크는 한 단계 밝은 표면으로 뜬다.
export const CARD_SURFACE = CHART_CARD_SURFACE;

// 프리뷰의 모든 가로 막대는 같은 두께와 트랙을 쓴다.
const BAR = "h-2.5 rounded-full";
const TRACK = "var(--ui-card-bg)";
const NEUTRAL_FILL = "color-mix(in srgb, var(--ui-muted) 45%, transparent)";
export const META = "text-[13px] font-medium leading-5 text-[var(--ui-muted)]";
const VALUE = "text-sm font-medium tabular-nums text-[var(--ui-ink)]";
const ACCURACY_FILL = "var(--palette-green-butter-main)";

const POSITION_LABELS: Record<PlayerPosition, string> = { TOP: "탑", JGL: "정글", MID: "미드", BOT: "원딜", SUP: "서폿" };

type Style = CSSProperties & Record<`--${string}`, string | number>;

function Bar({ percent, color, origin = "left", index = 0, className = "" }: {
  percent: number; color: string; origin?: "left" | "right"; index?: number; className?: string;
}) {
  return (
    <span data-bar className={`block shrink-0 ${BAR} ${className}`}
      style={{ width: `${Math.max(0, Math.min(100, percent))}%`, background: color, "--bar-origin": `${origin} center`, "--i": index } as Style} />
  );
}

export function Legend({ names, colors, variant = "dot" }: { names: string[]; colors: string[]; variant?: "dot" | "line" }) {
  return (
    <span className="flex shrink-0 items-center gap-3">
      {names.map((name, index) => (
        <span key={index} className={`inline-flex items-center gap-1.5 ${META}`}>
          {variant === "line"
            ? <i aria-hidden className={`w-4 border-t-2 ${index ? "border-dashed" : "border-solid"}`} style={{ borderColor: colors[index] }} />
            : <i aria-hidden className="h-2 w-2 rounded-full" style={{ background: colors[index] }} />}
          {name}
        </span>
      ))}
    </span>
  );
}

/** 반원 게이지. 왼쪽 호가 teamA, 오른쪽 호가 teamB이고 가운데에 우세 팀 승률을 쓴다. */
export function WinProbabilityGauge({ names, colors, probabilityA }: { names: string[]; colors: string[]; probabilityA: number }) {
  const length = Math.PI * 80;
  const favored = probabilityA >= 50 ? 0 : 1;
  const favoredProbability = favored === 0 ? probabilityA : 100 - probabilityA;
  return (
    <ChartReveal className="w-full">
      <svg viewBox="0 0 200 116" className="mx-auto block w-full max-w-[200px]" role="img" aria-label={`AI 예상 승률 ${names[0]} ${probabilityA}%, ${names[1]} ${100 - probabilityA}%`}>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke={colors[1]} strokeWidth="16" />
        <path data-arc d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke={colors[0]} strokeWidth="16" strokeDasharray={`${length} ${length}`}
          style={{ "--arc-length": length, "--arc-offset": length * (1 - probabilityA / 100) } as Style} />
        <text x="100" y="84" textAnchor="middle" className="fill-[var(--ui-ink)] text-[28px] font-black tabular-nums">{favoredProbability}%</text>
        <text x="100" y="108" textAnchor="middle" className="fill-[var(--ui-muted)] text-[13px] font-medium">{names[favored]} 승리 확률</text>
      </svg>
    </ChartReveal>
  );
}

function signed(value: number) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("ko-KR")}`;
}

function LaneSide({ lane, color, max, side, index, playerName }: {
  lane: BriefingLane | undefined; color: string; max: number; side: "left" | "right"; index: number; playerName: (id: string) => string;
}) {
  const value = lane?.goldDiffAt15 ?? null;
  const label = (
    <span className={`shrink-0 whitespace-nowrap ${side === "left" ? "text-right" : "text-left"}`}>
      <span className="hidden text-[15px] font-bold text-[var(--ui-ink)] sm:inline">{lane ? playerName(lane.playerId) : "-"}</span>
      <span className={`sm:ml-1.5 ${VALUE} text-[var(--ui-text)]`}>{value == null ? "-" : signed(value)}</span>
    </span>
  );
  const bar = value == null ? null : (
    <Bar percent={Math.max(4, Math.abs(value) / max * 50)} color={value > 0 ? color : NEUTRAL_FILL} origin={side === "left" ? "right" : "left"} index={index} />
  );
  return (
    <div className={`flex min-w-0 items-center gap-2 ${side === "left" ? "justify-end" : "justify-start"}`}>
      {side === "left" ? <>{label}{bar}</> : <>{bar}{label}</>}
    </div>
  );
}

/** 라인별 나비형 막대. 이름과 수치는 막대 바깥 끝에 붙는다. */
export function LaneGoldChart({ lanes, colors, playerName }: {
  lanes: BriefingLane[][];
  colors: string[];
  playerName: (id: string) => string;
}) {
  const max = Math.max(300, ...lanes.flat().map((lane) => Math.abs(lane.goldDiffAt15 ?? 0)));
  return (
    <div className="grid gap-3.5" role="list" aria-label="라인별 평균 15분 골드 격차">
      {LANE_POSITIONS.map((position, index) => {
        const [a, b] = lanes.map((items) => items.find((lane) => lane.position === position));
        return (
          <div key={position} role="listitem" className="grid grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] items-center gap-2">
            <LaneSide lane={a} color={colors[0]} max={max} side="left" index={index} playerName={playerName} />
            <span className={`text-center ${META}`}>{POSITION_LABELS[position]}</span>
            <LaneSide lane={b} color={colors[1]} max={max} side="right" index={index} playerName={playerName} />
          </div>
        );
      })}
    </div>
  );
}

function minuteLabel(value: number) {
  return `${Math.floor(value)}:${String(Math.round(value % 1 * 60)).padStart(2, "0")}`;
}

const DRAGON_MIN = 4;
const DRAGON_MAX = 16;

/** 팀별 첫 드래곤 처치 시각 점그림. 같은 시각대 점은 위아래로 번갈아 쌓는다. */
export function FirstDragonChart({ names, colors, minutes }: { names: string[]; colors: string[]; minutes: number[][] }) {
  const position = (value: number) => (Math.min(DRAGON_MAX, Math.max(DRAGON_MIN, value)) - DRAGON_MIN) / (DRAGON_MAX - DRAGON_MIN) * 100;
  return (
    <div className="grid gap-3">
      {minutes.map((values, row) => {
        const buckets = new Map<number, number>();
        const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
        return (
          <div key={row} className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3">
            <span className="truncate text-sm font-medium text-[var(--ui-ink)]">{names[row]}</span>
            <div className="relative h-10" role="img" aria-label={`${names[row]} 첫 드래곤 ${values.map(minuteLabel).join(", ") || "기록 없음"}`}>
              <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-[var(--ui-border)]" />
              {values.map((value, index) => {
                const bucket = Math.round(value * 2);
                const stack = buckets.get(bucket) ?? 0;
                buckets.set(bucket, stack + 1);
                const offset = stack === 0 ? 0 : (stack % 2 ? -1 : 1) * Math.ceil(stack / 2) * 9;
                return (
                  <span key={index} data-pop className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--ui-surface)] dark:ring-[var(--ui-surface-muted)]"
                    style={{ left: `${position(value)}%`, top: `calc(50% + ${offset}px)`, background: colors[row], "--i": index } as Style}
                    title={minuteLabel(value)} />
                );
              })}
            </div>
            <span className={`text-right ${VALUE}`}>{average == null ? "-" : minuteLabel(average)}</span>
          </div>
        );
      })}
      <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] gap-3">
        <span />
        <div className="relative h-5">
          {[5, 10, 15].map((tick) => (
            <span key={tick} className={`absolute -translate-x-1/2 whitespace-nowrap ${META}`} style={{ left: `${position(tick)}%` }}>{tick}분</span>
          ))}
        </div>
        <span className={`text-right ${META}`}>평균</span>
      </div>
    </div>
  );
}

const SIDES = [
  { key: "blue", label: "블루", color: "var(--team-blue)" },
  { key: "red", label: "레드", color: "var(--team-red)" },
] as const;

/** 팀별로 묶고 진영은 블루·레드 진영색으로 구분한다. 팀 사이는 구분선으로 나눈다. */
export function SideWinRates({ names, teams, logos }: { names: string[]; teams: BriefingTeamVisuals[]; logos: Array<Team | undefined> }) {
  return (
    <div className="grid divide-y divide-[var(--ui-border)]">
      {teams.map((team, row) => (
        <div key={team.teamId} className="grid gap-2.5 py-3.5 first:pt-0 last:pb-0">
          <div className="flex items-center gap-2">
            <TeamLogo team={logos[row]} size="h-5 w-5" plain themeAware />
            <span className="text-[15px] font-bold text-[var(--ui-ink)]">{names[row]}</span>
          </div>
          {SIDES.map((side, index) => {
            const record = team[side.key];
            const rate = record.games ? Math.round(record.wins / record.games * 100) : null;
            return (
              <div key={side.key} className="grid grid-cols-[36px_minmax(0,1fr)_40px_44px] items-center gap-3">
                <span className={META}>{side.label}</span>
                <span className={`flex ${BAR}`} style={{ background: TRACK }}>
                  {rate == null ? null : <Bar percent={rate} color={side.color} index={row * 2 + index} />}
                </span>
                <span className={`text-right ${VALUE}`}>{rate == null ? "-" : `${rate}%`}</span>
                <span className={`text-right ${META}`}>{record.games}세트</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function ChampionPriorityMap({ names, colors, items, champions }: {
  names: string[]; colors: string[]; items: ChampionPriority[]; champions: Champion[];
}) {
  return <ChampionPriorityPlot names={names} colors={colors} items={items.map((item) => {
    const champion = champions.find((entry) => entry.id === item.championId);
    return { ...item, name: champion?.name ?? "-", imageUrl: championImage(champion) };
  })} />;
}

export function LeagueRecordBar({ record, colors }: { record: LeagueSetRecord; colors: string[] }) {
  const total = record.winsA + record.winsB;
  const rateA = Math.round(record.winsA / total * 100);
  const leagues = [regionLeague(record.regionA), regionLeague(record.regionB)];
  return (
    <div className="grid gap-2.5">
      <div className="flex items-end justify-between gap-3">
        {[0, 1].map((index) => (
          <span key={index} className={`flex items-baseline gap-2 text-2xl font-black leading-8 text-[var(--ui-ink)] ${index ? "flex-row-reverse text-right" : ""}`}>
            <span>{leagues[index]}</span>
            <strong className="font-black tabular-nums">{index ? 100 - rateA : rateA}%</strong>
          </span>
        ))}
      </div>
      <div className={`flex overflow-hidden ${BAR}`} style={{ background: colors[1] }} role="img" aria-label={`${leagues[0]} ${record.winsA}세트, ${leagues[1]} ${record.winsB}세트`}>
        <span data-bar className="block h-full" style={{ width: `${rateA}%`, background: colors[0] }} />
      </div>
      <div className={`flex justify-between tabular-nums ${META}`}>
        <span>{record.winsA}세트 승리</span>
        <span>{record.winsB}세트 승리</span>
      </div>
    </div>
  );
}

function AccuracyRow({ label, bucket, index }: { label: string; bucket: AccuracyBucket; index: number }) {
  const rate = accuracyRate(bucket, ACCURACY_MIN_SEGMENT);
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)_64px] items-center gap-3">
      <span className="text-sm font-medium text-[var(--ui-text)]">{label}</span>
      <span className={`flex ${BAR}`} style={{ background: TRACK }}>
        {rate == null ? null : <Bar percent={rate} color={ACCURACY_FILL} index={index} />}
      </span>
      <span className="text-right">
        {rate == null
          ? <span className={META}>{bucket.graded}경기</span>
          : <span className={VALUE}>{rate}%</span>}
      </span>
    </div>
  );
}

export function AccuracySummary({ accuracy }: { accuracy: MatchPreviewAccuracy }) {
  const rate = accuracyRate(accuracy.all);
  const circumference = 2 * Math.PI * 40;
  const misses = accuracy.recent.filter((hit) => !hit).length;
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8">
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0" role="img" aria-label={rate == null ? "적중률 집계 중" : `적중률 ${rate}%`}>
            <circle cx="50" cy="50" r="40" fill="none" stroke={TRACK} strokeWidth="10" />
            {rate != null ? (
              <circle data-arc cx="50" cy="50" r="40" fill="none" stroke={ACCURACY_FILL} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${circumference} ${circumference}`} transform="rotate(-90 50 50)"
                style={{ "--arc-length": circumference, "--arc-offset": circumference * (1 - rate / 100) } as Style} />
            ) : null}
            <text x="50" y="57" textAnchor="middle" className="fill-[var(--ui-ink)] text-[20px] font-black tabular-nums">{rate == null ? "-" : `${rate}%`}</text>
          </svg>
          <div className="min-w-0">
            <strong className="block text-base font-bold text-[var(--ui-ink)]">{accuracy.season} 시즌</strong>
            <span className={`block tabular-nums ${META}`}>
              {rate == null ? `${ACCURACY_MIN_GRADED}경기부터 공개` : `${accuracy.all.graded}경기 중 ${accuracy.all.hits}경기 적중`}
            </span>
          </div>
        </div>
        <div className="grid gap-3">
          <AccuracyRow label="국내 대회" bucket={accuracy.domestic} index={0} />
          <AccuracyRow label="국제 대회" bucket={accuracy.international} index={1} />
          <AccuracyRow label="확신 70% 이상" bucket={accuracy.confident} index={2} />
        </div>
      </div>
      {accuracy.recent.length ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ui-border)] pt-4">
          <span className="text-sm font-medium text-[var(--ui-text)]">최근 {accuracy.recent.length}경기</span>
          <span className="flex gap-1.5" role="img" aria-label={accuracy.recent.toReversed().map((hit) => hit ? "적중" : "빗나감").join(" ")}>
            {accuracy.recent.toReversed().map((hit, index) => (
              <span key={index} data-pop className="h-4 w-4 rounded" style={{ background: hit ? ACCURACY_FILL : NEUTRAL_FILL, "--i": index } as Style} />
            ))}
          </span>
          <span className={`tabular-nums ${META}`}>{accuracy.recent.length - misses}적중 {misses}빗나감</span>
        </div>
      ) : null}
    </div>
  );
}
