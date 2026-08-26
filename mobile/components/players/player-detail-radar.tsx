import Svg, { Line, Polygon, Text as SvgText, TSpan } from 'react-native-svg';
import { StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobilePlayerDetailAxis } from '@/lib/api-client';

function colorWithAlpha(color: string, alpha: number) {
  const clean = color.replace('#', '');
  if (/^[0-9a-f]{6}$/i.test(clean)) {
    const red = parseInt(clean.slice(0, 2), 16);
    const green = parseInt(clean.slice(2, 4), 16);
    const blue = parseInt(clean.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
  return color;
}

function statValue(value: number | null | undefined, decimals: number) {
  return value == null || Number.isNaN(value) ? '-' : value.toFixed(decimals);
}

export function PlayerDetailRadar({ accent, axes }: { accent: string; axes: MobilePlayerDetailAxis[] }) {
  const { fonts, theme } = useMinionTheme();
  const center = 130;
  const maxRadius = 90;
  const pointsFor = (values: number[]) => values.map((value, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
    const radius = (Math.max(0, Math.min(100, value)) / 100) * maxRadius;
    return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
  }).join(' ');
  const gridPolygons = [0.25, 0.5, 0.75, 1].map((scale) => axes.map((_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
    const radius = maxRadius * scale;
    return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
  }).join(' '));
  const averagePoints = axes.some((axis) => axis.averageScore != null)
    ? pointsFor(axes.map((axis) => axis.averageScore ?? 0))
    : null;

  return (
    <View style={styles.root}>
      <View style={styles.chartWrap}>
        <Svg accessibilityLabel="선수 지표 레이더 차트" height={280} viewBox="0 0 260 260" width={280}>
          {[...gridPolygons].reverse().map((points, index) => (
            <Polygon
              fill={index % 2 === 0 ? theme.surfaceMuted : theme.surface}
              key={points}
              points={points}
              stroke={theme.border}
              strokeWidth={1}
            />
          ))}
          {axes.map((_, index) => {
            const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
            return (
              <Line
                key={index}
                stroke={theme.border}
                strokeWidth={1}
                x1={center}
                x2={center + Math.cos(angle) * maxRadius}
                y1={center}
                y2={center + Math.sin(angle) * maxRadius}
              />
            );
          })}
          {averagePoints ? (
            <Polygon
              fill={colorWithAlpha(theme.muted, 0.18)}
              points={averagePoints}
              stroke={theme.muted}
              strokeWidth={2}
            />
          ) : null}
          <Polygon
            fill={colorWithAlpha(accent, 0.16)}
            points={pointsFor(axes.map((axis) => axis.score))}
            stroke={accent}
            strokeWidth={2}
          />
          {axes.map((axis, index) => {
            const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
            const x = center + Math.cos(angle) * (maxRadius + 20);
            const y = center + Math.sin(angle) * (maxRadius + 16);
            return (
              <SvgText
                fill={theme.ink}
                fontFamily={fonts.medium.fontFamily}
                fontWeight={fonts.medium.fontWeight}
                fontSize={13}
                key={axis.label}
                textAnchor="middle"
                x={x}
                y={y}>
                <TSpan x={x}>{axis.label}</TSpan>
                <TSpan dy={12} fill={theme.muted} x={x}>{Math.round(axis.score)}</TSpan>
              </SvgText>
            );
          })}
        </Svg>
      </View>

      <View style={styles.axisList}>
        {axes.map((axis) => (
          <View key={axis.label} style={styles.axisRow}>
            <Text style={[styles.axisLabel, { color: theme.ink, ...fonts.medium }]}>{axis.label}</Text>
            <View style={[styles.barTrack, { backgroundColor: theme.surfaceMuted }]}>
              <View style={[styles.barFill, { backgroundColor: accent, width: `${Math.max(0, Math.min(100, axis.score))}%` }]} />
            </View>
            <Text numberOfLines={1} style={[styles.axisValue, { color: theme.ink, ...fonts.medium }]}>
              {Math.round(axis.score)} <Text style={{ color: theme.muted, ...fonts.regular }}>({statValue(axis.raw, axis.decimals)})</Text>
            </Text>
            <Text numberOfLines={1} style={[styles.axisAverage, { color: theme.muted, ...fonts.regular }]}>
              {axis.averageScore == null
                ? '-'
                : `${Math.round(axis.averageScore)} (${statValue(axis.averageRaw, axis.decimals)})`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  axisAverage: { fontSize: 13, lineHeight: 19.5, textAlign: 'right', width: 72 },
  axisLabel: { fontSize: 13, lineHeight: 19.5, width: 42 },
  axisList: { gap: 12 },
  axisRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  axisValue: { fontSize: 13, lineHeight: 19.5, textAlign: 'right', width: 78 },
  barFill: { borderRadius: 999, height: '100%' },
  barTrack: { borderRadius: 999, flex: 1, height: 7, overflow: 'hidden' },
  chartWrap: { alignItems: 'center' },
  root: { gap: 24 },
});
