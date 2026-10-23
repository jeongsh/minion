import { View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Polyline, Text as SvgText, TSpan } from 'react-native-svg';

import { useMinionTheme } from '@/hooks/use-minion-theme';

export type RadarSeries = { label: string; color: string; scores: (number | null)[]; values?: string[]; dashed?: boolean };

export function StatRadar({ axes, series, label, showComparisonValues = false }: { axes: readonly { label: string; title?: string }[]; series: RadarSeries[]; label: string; showComparisonValues?: boolean }) {
  const { fonts, theme } = useMinionTheme();
  const point = (index: number, value: number) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / axes.length;
    const radius = Math.max(0, Math.min(100, value)) / 100 * 90;
    return [140 + Math.cos(angle) * radius, 140 + Math.sin(angle) * radius];
  };
  const description = axes.map((axis, i) => `${axis.title ?? axis.label}: ${series.map((item) => `${item.label} ${item.values?.[i] ?? item.scores[i] ?? '기록 없음'}`).join(', ')}`).join('. ');
  return <View style={{ width: '100%', maxWidth: 280, height: 280, alignSelf: 'center' }}><Svg width="100%" height={280} viewBox="0 0 280 280" accessibilityRole="image" accessibilityLabel={`${label}. ${description}`}>
    {[1, 0.75, 0.5, 0.25].map((scale, i) => <Polygon key={scale} points={axes.map((_, j) => point(j, scale * 100).join(',')).join(' ')} fill={i % 2 === 0 ? theme.surfaceMuted : theme.surface} stroke={theme.border} />)}
    {axes.map((axis, i) => <Line key={axis.label} x1={140} y1={140} x2={point(i, 100)[0]} y2={point(i, 100)[1]} stroke={theme.border} />)}
    {[...series].reverse().map((item) => <G key={item.label}>
      {axes.every((_, i) => item.scores[i] != null) ? <Polygon points={axes.map((_, i) => point(i, item.scores[i]!).join(',')).join(' ')} fill={item.color} fillOpacity={0.16} stroke={item.color} strokeWidth={2} strokeDasharray={item.dashed ? '5 4' : undefined} /> : axes.map((axis, i) => { const next = (i + 1) % axes.length; return item.scores[i] == null || item.scores[next] == null ? null : <Polyline key={axis.label} points={`${point(i, item.scores[i]!).join(',')} ${point(next, item.scores[next]!).join(',')}`} stroke={item.color} strokeWidth={2} strokeDasharray={item.dashed ? '5 4' : undefined} fill="none" />; })}
      {axes.map((axis, i) => item.scores[i] == null ? null : <Circle key={axis.label} cx={point(i, item.scores[i]!)[0]} cy={point(i, item.scores[i]!)[1]} r={2.5} fill={item.color} />)}
    </G>)}
    {axes.map((axis, i) => { const angle = -Math.PI / 2 + i * Math.PI * 2 / axes.length; const x = 140 + Math.cos(angle) * 110; const y = 140 + Math.sin(angle) * 106; return <SvgText key={axis.label} x={x} y={y} textAnchor="middle" fill={theme.ink} fontSize={13} fontFamily={fonts.medium.fontFamily} fontWeight={fonts.medium.fontWeight}><TSpan x={x}>{axis.label}</TSpan><TSpan x={x} dy={17} fill={theme.muted}>{(showComparisonValues ? series : series.slice(0, 1)).map((item) => item.scores[i] == null ? '-' : Math.round(item.scores[i]!)).join('  ')}</TSpan></SvgText>; })}
  </Svg></View>;
}
