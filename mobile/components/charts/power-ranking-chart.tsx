import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { useMinionTheme } from '@/hooks/use-minion-theme';

export function PowerRankingChart({ series, error }: { series: { label: string; color: string; history: { date: string; rank: number }[] }[]; error?: boolean }) {
  const { fonts, theme } = useMinionTheme();
  const [width, setWidth] = useState(0);
  const points = series.flatMap((item) => item.history);
  const dates = [...new Set(points.map((point) => Date.parse(point.date)))].sort((a, b) => a - b);
  const start = dates[0], end = dates.at(-1);
  const maxRank = Math.max(5, Math.ceil(Math.max(...points.map((point) => point.rank)) / 5) * 5);
  const x = (date: string | number) => end === start ? (width + 16) / 2 : 32 + (new Date(date).getTime() - start) / (end! - start) * (width - 48);
  const y = (rank: number) => 18 + (rank - 1) / (maxRank - 1) * 228;
  const tickStep = Math.max(5, Math.ceil(maxRank / 25) * 5);
  const ticks = [1, ...Array.from({ length: Math.floor(maxRank / tickStep) }, (_, i) => (i + 1) * tickStep)];
  const formatDate = (date: string | number) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).format(new Date(date));
  const visibleDates = dates.filter((_, i) => i === 0 || i === dates.length - 1 || (width >= 360 && i === Math.floor(dates.length / 2)));
  return <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height: 280, minWidth: 0, alignItems: 'center', justifyContent: 'center' }}>
    {!points.length ? <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 16, lineHeight: 24 }}>{error ? '파워랭킹을 불러오지 못했습니다.' : '파워랭킹 기록 없음'}</Text> : width > 0 ? <Svg width={width} height={280} viewBox={`0 0 ${width} 280`} accessibilityRole="image" accessibilityLabel={`발표일별 두 팀의 세계 파워랭킹 추이. ${series.map((item) => `${item.label}: ${item.history.map((point) => `${formatDate(point.date)} ${point.rank}위`).join(', ')}`).join('. ')}`}>
      {ticks.map((rank) => <G key={rank}><Line x1={32} x2={width - 16} y1={y(rank)} y2={y(rank)} stroke={theme.border} /><SvgText x={24} y={y(rank) + 4} textAnchor="end" fill={theme.muted} fontFamily={fonts.regular.fontFamily} fontSize={13}>{rank}</SvgText></G>)}
      {visibleDates.map((date, i) => <SvgText key={date} x={x(date)} y={274} textAnchor={i === 0 ? 'start' : i === visibleDates.length - 1 ? 'end' : 'middle'} fill={theme.muted} fontFamily={fonts.regular.fontFamily} fontSize={13}>{formatDate(date)}</SvgText>)}
      {series.map((item, i) => <G key={item.label}><Polyline points={item.history.map((point) => `${x(point.date)},${y(point.rank)}`).join(' ')} stroke={item.color} strokeWidth={2} strokeDasharray={i ? '5 4' : undefined} fill="none" strokeLinejoin="round" strokeLinecap="round" />{item.history.map((point) => <Circle key={point.date} cx={x(point.date)} cy={y(point.rank)} r={3} fill={item.color} />)}</G>)}
    </Svg> : null}
  </View>;
}
