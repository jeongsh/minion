import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Circle, Defs, G, Line, LinearGradient, Path, Stop, Svg, Text as SvgText } from 'react-native-svg';

import { tournamentTokens } from '@/constants/tournament-theme';
import { OBJECTIVE_ICON_PATHS } from '@/constants/objective-icons';
import { TEAM_BLUE, TEAM_RED } from '@/constants/team-colors';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobilePlayerSummary, MobileTimelineEvent, MobileTimelineFrame } from '@/lib/api-client';
import { ObjectiveIcon } from './objective-icon';

const SVG_W = 440;
const PAD_X = 42;
const ITEM_SZ = 10;
const ITEM_SLT = 18;
const KILL_R = 3.5;
const TOP_MAR = 16;
const BOT_MAR = 26;
const MIN_HALF = 82;
const CTR_GAP = 10;
const BADGE_R = 4;

function toX(ms: number, duration: number) {
  return PAD_X + (ms / 1000 / duration) * (SVG_W - PAD_X * 2);
}

type ObjInfo = { label: string; color: string; iconPath?: string };

function getEventKind(event: MobileTimelineEvent): string {
  if (event.eventType === 'CHAMPION_KILL') return 'kill';
  if (event.eventType === 'BUILDING_KILL') return 'tower';
  const mt = (event.monsterType ?? '').toUpperCase();
  if (mt.includes('BARON')) return 'baron';
  if (mt.includes('ELDER')) return 'elder';
  if (mt.includes('RIFTHERALD') || mt === 'RIFTHERALD') return 'herald';
  if (mt.includes('HORDE')) return 'voidgrub';
  if (mt.includes('INFERNAL') || mt.includes('FIRE')) return 'dragon_fire';
  if (mt.includes('OCEAN') || mt.includes('WATER')) return 'dragon_ocean';
  if (mt.includes('CLOUD') || mt.includes('AIR')) return 'dragon_cloud';
  if (mt.includes('MOUNTAIN') || mt.includes('EARTH')) return 'dragon_mountain';
  if (mt.includes('HEXTECH')) return 'dragon_hextech';
  if (mt.includes('CHEMTECH')) return 'dragon_chemtech';
  return 'dragon';
}

function getObjInfo(event: MobileTimelineEvent): ObjInfo {
  if (event.eventType === 'BUILDING_KILL') return { color: '#fb923c', iconPath: OBJECTIVE_ICON_PATHS.tower, label: '포탑' };
  const mt = (event.monsterType ?? '').toUpperCase();
  if (mt.includes('BARON')) return { color: '#c084fc', iconPath: OBJECTIVE_ICON_PATHS.baron, label: '바론' };
  if (mt.includes('ELDER')) return { color: '#f97316', iconPath: OBJECTIVE_ICON_PATHS.elder, label: '장로' };
  if (mt.includes('RIFTHERALD') || mt === 'RIFTHERALD') return { color: '#22d3ee', iconPath: OBJECTIVE_ICON_PATHS.herald, label: '전령' };
  if (mt.includes('HORDE')) return { color: '#86efac', iconPath: OBJECTIVE_ICON_PATHS.voidGrub, label: '공허충' };
  if (mt.includes('INFERNAL') || mt.includes('FIRE')) return { color: '#ef4444', label: '화염' };
  if (mt.includes('OCEAN') || mt.includes('WATER')) return { color: '#60a5fa', label: '바다' };
  if (mt.includes('CLOUD') || mt.includes('AIR')) return { color: '#a3e635', label: '바람' };
  if (mt.includes('MOUNTAIN') || mt.includes('EARTH')) return { color: '#d97706', label: '대지' };
  if (mt.includes('HEXTECH')) return { color: '#818cf8', label: '마공' };
  if (mt.includes('CHEMTECH')) return { color: '#84cc16', label: '화공' };
  return { color: '#facc15', iconPath: OBJECTIVE_ICON_PATHS.dragon, label: '드래곤' };
}

const MONSTER_KR: Record<string, string> = {
  baron: '내셔 남작',
  dragon: '드래곤',
  dragon_chemtech: '화학공학 드래곤',
  dragon_cloud: '바람 드래곤',
  dragon_fire: '화염 드래곤',
  dragon_hextech: '마법공학 드래곤',
  dragon_mountain: '대지 드래곤',
  dragon_ocean: '바다 드래곤',
  elder: '장로 드래곤',
  herald: '협곡의 전령',
  voidgrub: '공허 유충',
};
const LANE_KR: Record<string, string> = { BOT: '봇', BOTTOM: '봇', MID: '미드', MIDDLE: '미드', TOP: '탑' };

function makeTooltip(event: MobileTimelineEvent, players: MobilePlayerSummary[]): string {
  const min = Math.floor(event.timestampMs / 60000);
  const sec = Math.floor((event.timestampMs % 60000) / 1000);
  const t = `${min}:${String(sec).padStart(2, '0')}`;
  if (event.eventType === 'CHAMPION_KILL') {
    const killer = players.find((p) => p.id === event.killerPlayerId)?.name ?? '?';
    const victim = players.find((p) => p.id === event.victimPlayerId)?.name ?? '?';
    const assists = event.assistPlayerIds.map((id) => players.find((p) => p.id === id)?.name ?? '?').join(', ');
    return assists ? `${t}  ${killer} → ${victim}  (${assists})` : `${t}  ${killer} → ${victim}`;
  }
  if (event.eventType === 'ELITE_MONSTER_KILL') {
    const p = players.find((item) => item.id === event.killerPlayerId)?.name;
    const name = MONSTER_KR[getEventKind(event)] ?? '몬스터';
    return `${t}  ${name}${p ? `  (${p})` : ''}`;
  }
  const laneRaw = event.laneType?.replace('_LANE', '') ?? '';
  const lane = LANE_KR[laneRaw.toUpperCase()] ?? laneRaw;
  return `${t}  ${lane} 포탑`;
}

type Cluster = { id: string; kind: string; count: number; ms: number; info: ObjInfo | null; tooltipLines: string[] };

function clusterTeamEvents(teamEvents: MobileTimelineEvent[], windowMs: number, players: MobilePlayerSummary[]): Cluster[] {
  const byKind = new Map<string, MobileTimelineEvent[]>();
  for (const event of teamEvents) {
    const kind = getEventKind(event);
    if (!byKind.has(kind)) byKind.set(kind, []);
    byKind.get(kind)!.push(event);
  }
  const clusters: Cluster[] = [];
  for (const [kind, events] of byKind) {
    const sorted = [...events].sort((a, b) => a.timestampMs - b.timestampMs);
    let i = 0;
    while (i < sorted.length) {
      const start = sorted[i].timestampMs;
      const group = [sorted[i]];
      let j = i + 1;
      while (j < sorted.length && sorted[j].timestampMs - start < windowMs) {
        group.push(sorted[j]);
        j += 1;
      }
      clusters.push({
        count: group.length,
        id: `${kind}-${start}`,
        info: kind === 'kill' ? null : getObjInfo(group[0]),
        kind,
        ms: start,
        tooltipLines: group.map((event) => makeTooltip(event, players)),
      });
      i = j;
    }
  }
  return clusters.sort((a, b) => a.ms - b.ms);
}

type Point = { x: number; y: number };

/** Chart.js splineCurve와 동일한 카디널 스플라인 접선 계산으로 매끄러운 곡선을 근사한다. */
function splinePath(points: Point[], tension: number) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const controls = points.map((point, i) => {
    const prev = points[Math.max(i - 1, 0)];
    const next = points[Math.min(i + 1, points.length - 1)];
    const d01 = Math.hypot(point.x - prev.x, point.y - prev.y);
    const d12 = Math.hypot(next.x - point.x, next.y - point.y);
    const total = d01 + d12;
    const s01 = total > 0 ? d01 / total : 0;
    const s12 = total > 0 ? d12 / total : 0;
    const fa = tension * s01;
    const fb = tension * s12;
    return {
      next: { x: point.x + fb * (next.x - prev.x), y: point.y + fb * (next.y - prev.y) },
      prev: { x: point.x - fa * (next.x - prev.x), y: point.y - fa * (next.y - prev.y) },
    };
  });
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const cp1 = controls[i].next;
    const cp2 = controls[i + 1].prev;
    d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${points[i + 1].x} ${points[i + 1].y}`;
  }
  return d;
}

/** y=0(팀 경계선) 교차 지점마다 끊어 블루/레드 구간별로 선 색을 나눈다. */
function splitAtZeroCrossing(points: Point[]) {
  const runs: Point[][] = [];
  let current: Point[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    if (current.length === 0) {
      current.push(point);
      continue;
    }
    const prev = current[current.length - 1];
    if ((prev.y <= 0) !== (point.y <= 0) && prev.y !== point.y) {
      const t = -prev.y / (point.y - prev.y);
      const crossing = { x: prev.x + t * (point.x - prev.x), y: 0 };
      current.push(crossing);
      runs.push(current);
      current = [crossing, point];
    } else {
      current.push(point);
    }
  }
  if (current.length > 0) runs.push(current);
  return runs;
}

export function GameTimelineChart({
  blueTeamId,
  blueTeamName,
  durationSeconds,
  events,
  frames,
  players,
  redTeamId,
  redTeamName,
}: {
  blueTeamId: string;
  blueTeamName: string;
  durationSeconds: number | null;
  events: MobileTimelineEvent[];
  frames: MobileTimelineFrame[];
  players: MobilePlayerSummary[];
  redTeamId: string;
  redTeamName: string;
}) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  const [containerWidth, setContainerWidth] = useState(SVG_W);
  const [showObjectives, setShowObjectives] = useState(true);
  const [tooltip, setTooltip] = useState<{ lines: string[]; xPct: number; yPct: number } | null>(null);
  const gridColor = colorScheme === 'dark' ? '#2a2f38' : '#e3e8f0';
  const mutedColor = colorScheme === 'dark' ? '#8a93a3' : '#8a93a3';
  const surfaceColor = colorScheme === 'dark' ? '#1a1d23' : '#f4f6fb';

  const layout = useMemo(() => {
    const duration = durationSeconds ?? Math.ceil((events.at(-1)?.timestampMs ?? 0) / 1000);
    if (duration <= 0 || events.length === 0) return null;

    const uniqueEvents = Array.from(new Map(events.map((e) => [e.id, e])).values());
    const killEvents = uniqueEvents.filter((e) => e.eventType === 'CHAMPION_KILL').sort((a, b) => a.timestampMs - b.timestampMs);
    const objEvents = uniqueEvents.filter((e) => e.eventType !== 'CHAMPION_KILL' && !(e.buildingType ?? '').includes('INHIBITOR')).sort((a, b) => a.timestampMs - b.timestampMs);
    const markerEvents = objEvents.filter((e) => getEventKind(e) !== 'tower');

    const blueClusters = clusterTeamEvents(markerEvents.filter((e) => e.teamId === blueTeamId), 60_000, players);
    const redClusters = clusterTeamEvents(markerEvents.filter((e) => e.teamId === redTeamId), 60_000, players);

    const goldPoints = frames
      .filter((f) => f.goldDiff !== null || (f.blueTotalGold !== null && f.redTotalGold !== null))
      .map((f) => ({ diff: f.goldDiff ?? (f.blueTotalGold as number) - (f.redTotalGold as number), seconds: f.timestampMs / 1000 }))
      .sort((a, b) => a.seconds - b.seconds);
    const hasGoldFrames = goldPoints.length >= 2;
    const unit: 'gold' | 'kills' = hasGoldFrames ? 'gold' : 'kills';

    let maxBlueLead = 0;
    let maxRedLead = 0;
    let displayDiffAt: (seconds: number) => number;

    if (hasGoldFrames) {
      maxBlueLead = Math.max(0, ...goldPoints.map((p) => p.diff));
      maxRedLead = Math.max(0, ...goldPoints.map((p) => -p.diff));
      displayDiffAt = (seconds: number) => {
        if (seconds <= goldPoints[0].seconds) return goldPoints[0].diff;
        const last = goldPoints[goldPoints.length - 1];
        if (seconds >= last.seconds) return last.diff;
        for (let i = 0; i < goldPoints.length - 1; i += 1) {
          const a = goldPoints[i];
          const b = goldPoints[i + 1];
          if (seconds >= a.seconds && seconds <= b.seconds) {
            const t = (seconds - a.seconds) / (b.seconds - a.seconds);
            return a.diff + (b.diff - a.diff) * t;
          }
        }
        return 0;
      };
    } else {
      let tmpDiff = 0;
      for (const e of killEvents) {
        tmpDiff += e.teamId === blueTeamId ? 1 : -1;
        maxBlueLead = Math.max(maxBlueLead, tmpDiff);
        maxRedLead = Math.max(maxRedLead, -tmpDiff);
      }
      const transitionSeconds = Math.min(90, Math.max(45, duration / 5));
      const eventTransitions = killEvents.map((event) => {
        const eventSeconds = event.timestampMs / 1000;
        const start = Math.max(0, Math.min(eventSeconds - transitionSeconds / 2, duration - transitionSeconds));
        return { delta: event.teamId === blueTeamId ? 1 : -1, end: Math.min(duration, start + transitionSeconds), start };
      });
      const smoothStep = (value: number) => {
        const clamped = Math.min(1, Math.max(0, value));
        return clamped * clamped * (3 - 2 * clamped);
      };
      displayDiffAt = (seconds: number) =>
        eventTransitions.reduce((sum, transition) => {
          const progress = transition.end === transition.start ? 1 : (seconds - transition.start) / (transition.end - transition.start);
          return sum + transition.delta * smoothStep(progress);
        }, 0);
    }

    const roundScale = (v: number) => (unit === 'kills' ? Math.max(5, v) : Math.max(1000, Math.ceil(v / 1000) * 1000));
    const scaleMax = roundScale(Math.max(maxBlueLead, maxRedLead));
    const blueScaleMax = scaleMax;
    const redScaleMax = scaleMax;

    const blueIconMin = ITEM_SLT;
    const redIconMin = ITEM_SLT;
    const totalH = Math.max(blueIconMin, MIN_HALF) + Math.max(redIconMin, MIN_HALF);
    const blueRatio = totalH > 0 ? blueScaleMax / (blueScaleMax + redScaleMax) : 0.5;
    let blueH = totalH * blueRatio;
    let redH = totalH - blueH;
    if (blueH < blueIconMin) {
      blueH = blueIconMin;
      redH = totalH - blueH;
    }
    if (redH < redIconMin) {
      redH = redIconMin;
      blueH = totalH - redH;
    }

    const graphTop = TOP_MAR;
    const centerY = graphTop + blueH + CTR_GAP;
    const graphBot = centerY + CTR_GAP + redH;
    const axisY = graphBot;
    const svgH = axisY + BOT_MAR;

    const ampBlue = blueH * 0.92;
    const ampRed = redH * 0.92;
    const dy = (d: number) => (d >= 0 ? centerY - (d / blueScaleMax) * ampBlue : centerY + (-d / redScaleMax) * ampRed);

    const chartPoints: Point[] = hasGoldFrames
      ? goldPoints.map((p) => ({ x: toX(p.seconds * 1000, duration), y: dy(p.diff) - centerY }))
      : (() => {
          const sampleStep = Math.max(5, duration / 140);
          const points: Point[] = [];
          for (let seconds = 0; seconds < duration; seconds += sampleStep) {
            points.push({ x: toX(seconds * 1000, duration), y: dy(displayDiffAt(seconds)) - centerY });
          }
          points.push({ x: SVG_W - PAD_X, y: dy(displayDiffAt(duration)) - centerY });
          return points;
        })();

    const mins: number[] = [];
    for (let m = 5; m * 60 < duration; m += 5) mins.push(m);

    const midOf = (max: number) => (unit === 'kills' ? Math.round(max / 2) : max / 2);
    const gridValues = [0, midOf(blueScaleMax), blueScaleMax, -midOf(redScaleMax), -redScaleMax];
    const formatDiffLabel = (d: number) => {
      if (d === 0) return '0';
      if (unit === 'kills') return `${Math.abs(d)}`;
      const k = Math.abs(d) / 1000;
      return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
    };

    return {
      areaPathD: `${splinePath(chartPoints.map((p) => ({ x: p.x, y: p.y + centerY })), 0.28)} L ${SVG_W - PAD_X} ${centerY} L ${PAD_X} ${centerY} Z`,
      axisY,
      blueCY: graphTop + ITEM_SZ / 2,
      blueClusters,
      centerFrac: (centerY - graphTop) / (graphBot - graphTop),
      centerY,
      dy,
      displayDiffAt,
      duration,
      formatDiffLabel,
      graphBot,
      graphTop,
      gridValues,
      mins,
      redCY: graphBot - ITEM_SZ / 2,
      redClusters,
      strokeRuns: splitAtZeroCrossing(chartPoints.map((p) => ({ x: p.x, y: p.y + centerY }))),
      svgH,
    };
  }, [blueTeamId, durationSeconds, events, frames, players, redTeamId]);

  const onLayoutRoot = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - containerWidth) > 0.5) setContainerWidth(width);
  };

  if (!events.length || !layout) {
    return (
      <View style={styles.emptyBox}>
        <Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 14 }}>타임라인 데이터 없음</Text>
      </View>
    );
  }

  const scale = containerWidth / SVG_W;
  const renderedHeight = layout.svgH * scale;

  return (
    <View onLayout={onLayoutRoot} style={styles.root}>
      <View style={{ height: renderedHeight, width: '100%' }}>
        <Svg height={renderedHeight} viewBox={`0 0 ${SVG_W} ${layout.svgH}`} width="100%">
          <Defs>
            <LinearGradient id="timelineFill" x1="0" x2="0" y1="0" y2="1">
              <Stop offset={0} stopColor={TEAM_BLUE} stopOpacity={0.32} />
              <Stop offset={Math.max(0, Math.min(1, layout.centerFrac))} stopColor={TEAM_BLUE} stopOpacity={0.04} />
              <Stop offset={Math.max(0, Math.min(1, layout.centerFrac))} stopColor={TEAM_RED} stopOpacity={0.04} />
              <Stop offset={1} stopColor={TEAM_RED} stopOpacity={0.32} />
            </LinearGradient>
          </Defs>

          {layout.gridValues.map((d) => {
            const y = layout.dy(d);
            return (
              <G key={`grid-${d}`}>
                <Line stroke={gridColor} strokeWidth={d === 0 ? 1.2 : 0.7} x1={PAD_X} x2={SVG_W - PAD_X} y1={y} y2={y} />
                <SvgText fill={d > 0 ? TEAM_BLUE : d < 0 ? TEAM_RED : mutedColor} fontSize={9} fontWeight="600" textAnchor="end" x={PAD_X - 4} y={y + 3}>
                  {layout.formatDiffLabel(d)}
                </SvgText>
              </G>
            );
          })}

          <SvgText fill={TEAM_BLUE} fontSize={9} fontWeight="500" x={PAD_X + 6} y={layout.graphTop + 11}>{blueTeamName}</SvgText>
          <SvgText fill={TEAM_RED} fontSize={9} fontWeight="500" x={PAD_X + 6} y={layout.graphBot - 6}>{redTeamName}</SvgText>

          {layout.mins.map((m) => (
            <SvgText fill={mutedColor} fontSize={9} key={m} textAnchor="middle" x={toX(m * 60 * 1000, layout.duration)} y={layout.axisY + 20}>
              {m}&apos;
            </SvgText>
          ))}

          <Path d={layout.areaPathD} fill="url(#timelineFill)" />
          {layout.strokeRuns.map((run, index) => (
            <Path d={splinePath(run, 0.28)} fill="none" key={index} stroke={run[0].y <= 0 ? TEAM_BLUE : TEAM_RED} strokeWidth={1.8} />
          ))}

          {showObjectives ? (
            <>
              {layout.blueClusters.map((cluster) => (
                <ClusterIcon
                  cluster={cluster}
                  color={TEAM_BLUE}
                  curveY={layout.dy(layout.displayDiffAt(cluster.ms / 1000))}
                  cx={toX(cluster.ms, layout.duration)}
                  cy={layout.blueCY}
                  key={`b-${cluster.id}`}
                  onPress={() => setTooltip({ lines: cluster.tooltipLines, xPct: (toX(cluster.ms, layout.duration) / SVG_W) * 100, yPct: (layout.blueCY / layout.svgH) * 100 })}
                  surfaceColor={surfaceColor}
                />
              ))}
              {layout.redClusters.map((cluster) => (
                <ClusterIcon
                  cluster={cluster}
                  color={TEAM_RED}
                  curveY={layout.dy(layout.displayDiffAt(cluster.ms / 1000))}
                  cx={toX(cluster.ms, layout.duration)}
                  cy={layout.redCY}
                  key={`r-${cluster.id}`}
                  onPress={() => setTooltip({ lines: cluster.tooltipLines, xPct: (toX(cluster.ms, layout.duration) / SVG_W) * 100, yPct: (layout.redCY / layout.svgH) * 100 })}
                  surfaceColor={surfaceColor}
                />
              ))}
            </>
          ) : null}
        </Svg>

        {showObjectives && tooltip ? (
          <View pointerEvents="none" style={[styles.tooltip, { backgroundColor: theme.surface, borderColor: theme.border, left: `${Math.min(Math.max(tooltip.xPct, 5), 85)}%`, top: `${tooltip.yPct}%` }]}>
            {tooltip.lines.map((line, i) => (
              <Text key={i} style={{ color: theme.text, fontFamily: fonts.medium, fontSize: 12 }}>{line}</Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItems}>
          {showObjectives
            ? [
                { label: '장로', path: OBJECTIVE_ICON_PATHS.elder },
                { label: '바론', path: OBJECTIVE_ICON_PATHS.baron },
                { label: '전령', path: OBJECTIVE_ICON_PATHS.herald },
                { label: '공허 유충', path: OBJECTIVE_ICON_PATHS.voidGrub },
              ].map((item) => (
                <View key={item.label} style={styles.legendItem}>
                  <ObjectiveIcon path={item.path} size={16} />
                  <Text style={{ color: tournamentTokens[colorScheme].muted, fontFamily: fonts.medium, fontSize: 11 }}>{item.label}</Text>
                </View>
              ))
            : null}
        </View>
        <Pressable onPress={() => setShowObjectives((v) => !v)} style={[styles.toggleButton, { borderColor: theme.border }]}>
          <Text style={{ color: tournamentTokens[colorScheme].muted, fontFamily: fonts.medium, fontSize: 11 }}>{showObjectives ? '오브젝트 숨기기' : '오브젝트 보기'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ClusterIcon({ cluster, color, cx, cy, curveY, onPress, surfaceColor }: { cluster: Cluster; color: string; cx: number; cy: number; curveY: number; onPress: () => void; surfaceColor: string }) {
  const half = ITEM_SZ / 2;
  const { info, count } = cluster;
  const below = curveY > cy;
  const lineStart = below ? cy + half : cy - half;
  const showConnector = Math.abs(curveY - lineStart) > 2;

  return (
    <G onPress={onPress}>
      {showConnector ? (
        <>
          <Line stroke={color} strokeDasharray="1.5 2" strokeOpacity={0.6} strokeWidth={0.9} x1={cx} x2={cx} y1={lineStart} y2={curveY} />
          <Circle cx={cx} cy={curveY} fill={color} r={1.8} />
        </>
      ) : null}
      {!info ? (
        <>
          <Circle cx={cx} cy={cy} fill={color} r={count > 1 ? KILL_R + 1.5 : KILL_R} stroke={surfaceColor} strokeWidth={1.2} />
          {count > 1 ? <SvgText fill="#0f172a" fontSize={5.5} fontWeight="500" textAnchor="middle" x={cx} y={cy + 2.5}>{count}</SvgText> : null}
        </>
      ) : (
        <>
          <Circle cx={cx} cy={cy} fill={info.color} r={half} />
          <SvgText fill="#fff" fontSize={5} fontWeight="500" textAnchor="middle" x={cx} y={cy + 2.2}>{info.label}</SvgText>
          {count > 1 ? (
            <>
              <Circle cx={cx + half} cy={cy - half} fill={color} r={BADGE_R} stroke={surfaceColor} strokeWidth={1} />
              <SvgText fill="#fff" fontSize={5} fontWeight="500" textAnchor="middle" x={cx + half} y={cy - half + 2.6}>{count}</SvgText>
            </>
          ) : null}
        </>
      )}
    </G>
  );
}

const styles = StyleSheet.create({
  emptyBox: { alignItems: 'center', paddingVertical: 24 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  legendItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  root: { width: '100%' },
  toggleButton: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  tooltip: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, position: 'absolute' },
});
