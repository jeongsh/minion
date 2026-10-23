import { StatRadar } from '@/components/charts/stat-radar';
import { StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobilePlayerDetailAxis } from '@/lib/api-client';

function statValue(value: number | null | undefined, decimals: number) {
  return value == null || Number.isNaN(value) ? '-' : value.toFixed(decimals);
}

export function PlayerDetailRadar({ accent, axes }: { accent: string; axes: MobilePlayerDetailAxis[] }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={styles.root}>
      <View style={styles.chartWrap}>
        <StatRadar axes={axes} label="선수 지표 레이더 차트" series={[
          { label: '선수', color: accent, scores: axes.map((axis) => axis.score), values: axes.map((axis) => statValue(axis.raw, axis.decimals)) },
          ...(axes.some((axis) => axis.averageScore != null) ? [{ label: '평균', color: theme.muted, scores: axes.map((axis) => axis.averageScore), values: axes.map((axis) => statValue(axis.averageRaw, axis.decimals)) }] : []),
        ]} />
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
