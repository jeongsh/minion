import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { Text, type TextStyle, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { TeamLogo } from '@/components/data/team-logo';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileTeamSummary } from '@/lib/api-client';
import type { MobileMatchPreviewCharts } from '../../../packages/contracts/src/mobile-v1';
import { ACCURACY_MIN_GRADED, ACCURACY_MIN_SEGMENT, accuracyRate } from '../../../packages/contracts/src/preview-accuracy';

import { CHAMPION_MAP_HEIGHT, CHAMPION_MAP_ROW_HEIGHT, placePreviewChampions } from '../../../packages/contracts/src/preview-chart-layout';

export type Charts = MobileMatchPreviewCharts;
export function Copy({ children, size = 13, strong = false, black = false, muted = false, tabular = false, numberOfLines, style }: PropsWithChildren<{ size?: number; strong?: boolean; black?: boolean; muted?: boolean; tabular?: boolean; numberOfLines?: number; style?: TextStyle }>) {
  const { fonts, theme } = useMinionTheme();
  return <Text numberOfLines={numberOfLines} style={[{ color: muted ? theme.muted : theme.ink, ...(black ? fonts.black : strong ? fonts.bold : fonts.medium), fontSize: size, fontVariant: tabular ? ['tabular-nums'] : undefined, includeFontPadding: false, lineHeight: size === 13 ? 20 : size === 15 ? 22.5 : size === 16 ? 24 : size === 18 ? 28 : size === 24 ? 32 : 20 }, style]}>{children}</Text>;
}

export function Card({ title, caption, legend, paired = false, contentGap = 16, children }: PropsWithChildren<{ title?: string; caption?: ReactNode; legend?: ReactNode; paired?: boolean; contentGap?: number }>) {
  const { width } = useWindowDimensions();
  const { colorScheme, theme } = useMinionTheme();
  const inRow = paired && width >= 768;
  return <View style={{ minWidth: 0, flexGrow: inRow ? 1 : 0, flexShrink: 0, flexBasis: inRow ? 0 : 'auto', borderWidth: 1, borderColor: theme.border, borderRadius: 12, backgroundColor: colorScheme === 'dark' ? theme.surfaceMuted : theme.surface, padding: width >= 640 ? 20 : 16 }}>
    {title ? <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}><View style={{ flex: 1, minWidth: 0 }}><Copy size={18} strong>{title}</Copy>{caption ? <View style={{ marginTop: 2 }}>{typeof caption === 'string' ? <Copy muted>{caption}</Copy> : caption}</View> : null}</View>{legend ? <View style={{ paddingTop: 4 }}>{legend}</View> : null}</View> : null}
    <View style={{ marginTop: title ? contentGap : 0, flexGrow: inRow ? 1 : 0, flexShrink: 0, minWidth: 0, justifyContent: 'center' }}>{children}</View>
  </View>;
}

export function Legend({ names, colors, line = false }: { names: string[]; colors: string[]; line?: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>{names.map((name, i) => <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{line ? <View style={{ width: 16, borderTopWidth: 2, borderColor: colors[i], borderStyle: i ? 'dashed' : 'solid' }} /> : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[i] }} />}<Copy muted>{name}</Copy></View>)}</View>;
}

export function Bar({ percent, color }: { percent: number; color: string }) {
  return <View style={{ height: 10, borderRadius: 999, width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: color }} />;
}

export function Gauge({ names, colors, probability }: { names: string[]; colors: string[]; probability: number }) {
  const { fonts, theme } = useMinionTheme();
  const length = Math.PI * 80;
  const favored = probability >= 50 ? 0 : 1;
  return <Svg width={200} height={116} viewBox="0 0 200 116" style={{ alignSelf: 'center' }} accessibilityRole="image" accessibilityLabel={`AI 예상 승률 ${names[0]} ${probability}%, ${names[1]} ${100 - probability}%`}>
    <Path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke={colors[1]} strokeWidth={16} />
    <Path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke={colors[0]} strokeWidth={16} strokeDasharray={[length, length]} strokeDashoffset={length * (1 - probability / 100)} />
    <SvgText x={100} y={84} textAnchor="middle" fill={theme.ink} fontFamily={fonts.black.fontFamily} fontWeight={fonts.black.fontWeight} fontSize={28} fontFeatureSettings="'tnum'">{favored ? 100 - probability : probability}%</SvgText>
    <SvgText x={100} y={108} textAnchor="middle" fill={theme.muted} fontFamily={fonts.medium.fontFamily} fontWeight={fonts.medium.fontWeight} fontSize={13}>{names[favored]} 승리 확률</SvgText>
  </Svg>;
}

const POSITIONS = [['TOP', '탑'], ['JGL', '정글'], ['MID', '미드'], ['BOT', '원딜'], ['SUP', '서폿']] as const;
const signed = (value: number) => `${Math.round(value) > 0 ? '+' : ''}${Math.round(value).toLocaleString('ko-KR')}`;

export function LaneGold({ teams, colors }: { teams: Charts['teams']; colors: string[] }) {
  const { theme } = useMinionTheme();
  const max = Math.max(300, ...teams.flatMap((team) => team.lanes.map((lane) => Math.abs(lane.goldDiffAt15 ?? 0))));
  return <View style={{ gap: 14 }} accessibilityLabel="라인별 평균 15분 골드 격차">{POSITIONS.map(([position, label]) => <View key={position} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 }}>
    {[0, 1].map((i) => {
      const value = teams[i]?.lanes.find((lane) => lane.position === position)?.goldDiffAt15 ?? null;
      const text = <Copy size={14} style={{ flexShrink: 0, fontVariant: ['tabular-nums'], color: theme.text }}>{value == null ? '-' : signed(value)}</Copy>;
      const bar = value == null ? null : <Bar percent={Math.max(4, Math.abs(value) / max * 50)} color={value > 0 ? colors[i] : `${theme.muted}73`} />;
      return <View key={i} style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: i ? 'flex-start' : 'flex-end' }}>{i ? <>{bar}{text}</> : <>{text}{bar}</>}</View>;
    }).flatMap((side, i) => i ? [<Copy key="position" muted style={{ width: 40, textAlign: 'center' }}>{label}</Copy>, side] : [side])}
  </View>)}</View>;
}

const minute = (value: number) => `${Math.floor(value)}:${String(Math.round(value % 1 * 60)).padStart(2, '0')}`;
export function FirstDragon({ names, colors, teams }: { names: string[]; colors: string[]; teams: Charts['teams'] }) {
  const { colorScheme, theme } = useMinionTheme();
  const position = (value: number) => (Math.min(16, Math.max(4, value)) - 4) / 12 * 100;
  return <View style={{ gap: 12 }}>{teams.map((team, row) => {
    const buckets = new Map<number, number>();
    const average = team.dragonMinutes.length ? team.dragonMinutes.reduce((a, b) => a + b, 0) / team.dragonMinutes.length : null;
    return <View key={row} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Copy size={14} style={{ width: 44 }} >{names[row]}</Copy><View style={{ flex: 1, height: 40 }} accessibilityLabel={`${names[row]} 첫 드래곤 ${team.dragonMinutes.map(minute).join(', ') || '기록 없음'}`}><View style={{ position: 'absolute', top: 20, left: 0, right: 0, height: 1, backgroundColor: theme.border }} />{team.dragonMinutes.map((value, i) => {
      const bucket = Math.round(value * 2), stack = buckets.get(bucket) ?? 0;
      buckets.set(bucket, stack + 1);
      const offset = stack === 0 ? 0 : (stack % 2 ? -1 : 1) * Math.ceil(stack / 2) * 9;
      return <View key={i} style={{ position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colorScheme === 'dark' ? theme.surfaceMuted : theme.surface, backgroundColor: colors[row], top: 20 + offset - 7, left: `${position(value)}%`, transform: [{ translateX: -7 }] }} />;
    })}</View><Copy size={14} style={{ width: 44, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{average == null ? '-' : minute(average)}</Copy></View>;
  })}<View style={{ flexDirection: 'row', gap: 12 }}><View style={{ width: 44 }} /><View style={{ flex: 1, height: 20 }}>{[5, 10, 15].map((tick) => <View key={tick} style={{ position: 'absolute', left: `${position(tick)}%`, width: 40, transform: [{ translateX: -20 }] }}><Copy muted style={{ textAlign: 'center' }}>{tick}분</Copy></View>)}</View><Copy muted style={{ width: 44, textAlign: 'right' }}>평균</Copy></View></View>;
}

export function SideRates({ names, teams, logos }: { names: string[]; teams: Charts['teams']; logos: (MobileTeamSummary | null)[] }) {
  const { theme } = useMinionTheme();
  return <View>{teams.map((team, row) => <View key={row} style={{ gap: 10, paddingTop: row ? 14 : 0, paddingBottom: row === teams.length - 1 ? 0 : 14, borderTopWidth: row ? 1 : 0, borderColor: theme.border }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><TeamLogo team={logos[row]} size={20} plain themeAware /><Copy size={15} strong>{names[row]}</Copy></View>{(['blue', 'red'] as const).map((side) => {
    const record = team[side], rate = record.games ? Math.round(record.wins / record.games * 100) : null;
    return <View key={side} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Copy muted style={{ width: 36 }}>{side === 'blue' ? '블루' : '레드'}</Copy><View style={{ flex: 1, height: 10, borderRadius: 999, backgroundColor: theme.card }}>{rate == null ? null : <Bar percent={rate} color={side === 'blue' ? '#2262f8' : '#ff2f44'} />}</View><Copy size={14} tabular style={{ width: 40, textAlign: 'right' }}>{rate == null ? '-' : `${rate}%`}</Copy><Copy muted style={{ width: 44, textAlign: 'right' }}>{record.games}세트</Copy></View>;
  })}</View>)}</View>;
}

export function ChampionMap({ names, colors, items }: { names: string[]; colors: string[]; items: Charts['champions'] }) {
  const { theme } = useMinionTheme();
  const totals = items.map((item) => item.picksA + item.picksB), min = Math.min(...totals), max = Math.max(...totals);
  const [width, setWidth] = useState(0);
  const placed = placePreviewChampions(items, width);
  return <View><View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height: CHAMPION_MAP_HEIGHT }}><View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: theme.border }} />{placed.map((item) => {
    const share = item.picksB / (item.picksA + item.picksB), ring = share < 0.4 ? colors[0] : share > 0.6 ? colors[1] : theme.ink;
    const size = max === min ? 44 : Math.round(28 + (Math.sqrt(item.picksA + item.picksB) - Math.sqrt(min)) / (Math.sqrt(max) - Math.sqrt(min)) * 32);
    return <View key={item.championId} accessibilityLabel={`${item.name} ${names[0]} ${item.picksA}회 ${names[1]} ${item.picksB}회`} style={{ position: 'absolute', left: `${item.x}%`, top: item.lane * CHAMPION_MAP_ROW_HEIGHT, width: 72, transform: [{ translateX: -36 }], alignItems: 'center', gap: 4 }}><View style={{ height: 60, justifyContent: 'center' }}><View style={{ width: size + 4, height: size + 4, borderRadius: (size + 4) / 2, borderWidth: 2, borderColor: ring, overflow: 'hidden', backgroundColor: theme.card }}><Image contentFit="cover" source={{ uri: item.imageUrl }} style={{ width: size, height: size }} /></View></View><Copy numberOfLines={1} style={{ width: 72, textAlign: 'center', lineHeight: 16 }}>{item.name}</Copy></View>;
  })}</View><View style={{ marginTop: 8, flexDirection: 'row' }}><Copy muted style={{ flex: 1 }}>{names[0]} 선호</Copy><Copy muted style={{ flex: 1, textAlign: 'center' }}>공통</Copy><Copy muted style={{ flex: 1, textAlign: 'right' }}>{names[1]} 선호</Copy></View></View>;
}

export function LeagueRecord({ record, colors }: { record: NonNullable<Charts['leagueRecord']>; colors: string[] }) {
  const rate = Math.round(record.winsA / (record.winsA + record.winsB) * 100);
  return <View style={{ gap: 10 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>{record.leagues.map((league, i) => <View key={i} style={{ alignItems: i ? 'flex-end' : 'flex-start' }}><Copy muted>{league}</Copy><Copy size={24} black tabular>{i ? 100 - rate : rate}%</Copy></View>)}</View><View style={{ height: 10, backgroundColor: colors[1], borderRadius: 999, overflow: 'hidden' }}><Bar percent={rate} color={colors[0]} /></View><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Copy muted tabular>{record.winsA}세트 승리</Copy><Copy muted tabular>{record.winsB}세트 승리</Copy></View></View>;
}

export function Accuracy({ accuracy }: { accuracy: Charts['accuracy'] }) {
  const { width } = useWindowDimensions();
  const { fonts, theme } = useMinionTheme();
  const rate = accuracyRate(accuracy.all), length = 2 * Math.PI * 40, fill = '#00b85c';
  return <View style={{ gap: 20 }}><View style={{ flexDirection: width >= 640 ? 'row' : 'column', alignItems: width >= 640 ? 'center' : undefined, gap: width >= 640 ? 32 : 20 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}><Svg width={96} height={96} viewBox="0 0 100 100" accessibilityLabel={rate == null ? '적중률 집계 중' : `적중률 ${rate}%`}><Circle cx={50} cy={50} r={40} fill="none" stroke={theme.card} strokeWidth={10} />{rate == null ? null : <Circle cx={50} cy={50} r={40} fill="none" stroke={fill} strokeWidth={10} strokeLinecap="round" strokeDasharray={[length, length]} strokeDashoffset={length * (1 - rate / 100)} rotation={-90} origin="50,50" />}<SvgText x={50} y={57} textAnchor="middle" fill={theme.ink} fontFamily={fonts.black.fontFamily} fontWeight={fonts.black.fontWeight} fontSize={20} fontFeatureSettings="'tnum'">{rate == null ? '-' : `${rate}%`}</SvgText></Svg><View><Copy size={16} strong style={{ lineHeight: 24 }}>{accuracy.season} 시즌</Copy><Copy muted tabular>{rate == null ? `${ACCURACY_MIN_GRADED}경기부터 공개` : `${accuracy.all.graded}경기 중 ${accuracy.all.hits}경기 적중`}</Copy></View></View><View style={{ gap: 12, flex: width >= 640 ? 1 : undefined }}>{([['국내 대회', accuracy.domestic], ['국제 대회', accuracy.international], ['확신 70% 이상', accuracy.confident]] as const).map(([label, bucket]) => {
    const value = accuracyRate(bucket, ACCURACY_MIN_SEGMENT);
    return <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 24 }}><Copy size={14} style={{ width: 88, color: theme.text }}>{label}</Copy><View style={{ flex: 1, height: 10, borderRadius: 999, backgroundColor: theme.card }}>{value == null ? null : <Bar percent={value} color={fill} />}</View><Copy size={value == null ? 13 : 14} tabular={value != null} muted={value == null} style={{ width: 64, textAlign: 'right' }}>{value == null ? `${bucket.graded}경기` : `${value}%`}</Copy></View>;
  })}</View></View>{accuracy.recent.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderColor: theme.border, paddingTop: 16 }}><Copy size={14} style={{ color: theme.text }}>최근 {accuracy.recent.length}경기</Copy><View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={accuracy.recent.toReversed().map((hit) => hit ? '적중' : '빗나감').join(' ')}>{accuracy.recent.toReversed().map((hit, i) => <View key={i} style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: hit ? fill : `${theme.muted}73` }} />)}</View><Copy muted tabular>{accuracy.recent.filter(Boolean).length}적중 {accuracy.recent.filter((hit) => !hit).length}빗나감</Copy></View> : null}</View>;
}
