import ChevronDown from 'lucide-react-native/icons/chevron-down';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import { mobileApiOrigin, resolveApiAssetUrl, type MobilePlayerChampionRow } from '@/lib/api-client';

const INITIAL_ROWS = 5;

function percentValue(value: number | null) {
  return value == null || Number.isNaN(value) ? '-' : `${Math.round(value)}%`;
}

function statValue(value: number | null, decimals = 1) {
  return value == null || Number.isNaN(value) ? '-' : value.toFixed(decimals);
}

function compactNumberValue(value: number | null) {
  if (value == null || Number.isNaN(value)) return '-';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString('ko-KR');
}

const COLUMNS = [
  { key: 'champion', label: '챔피언', width: '16%' },
  { key: 'sets', label: '세트', width: '10%' },
  { key: 'winRate', label: '승률', width: '11%' },
  { key: 'kda', label: 'KDA', width: '11%' },
  { key: 'damage', label: '대미지', width: '16%' },
  { key: 'dpm', label: 'DPM', width: '12%' },
  { key: 'csm', label: 'CSM', width: '12%' },
  { key: 'pog', label: 'POG', width: '12%' },
] as const;

export function PlayerChampionUsageTable({ accent, rows }: { accent: string; rows: MobilePlayerChampionRow[] }) {
  const { fonts, theme } = useMinionTheme();
  const [visibleCount, setVisibleCount] = useState(INITIAL_ROWS);
  const visibleRows = rows.slice(0, visibleCount);
  const hasMore = visibleCount < rows.length;

  if (rows.length === 0) {
    return (
      <View style={[styles.empty, { borderColor: theme.border }]}>
        <Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 14 }}>표시할 데이터가 없습니다.</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={[styles.frame, { borderColor: theme.border }]}>
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          {COLUMNS.map((column) => (
            <Text
              key={column.key}
              numberOfLines={1}
              style={[styles.headerText, { color: theme.muted, fontFamily: fonts.medium, width: column.width }]}>
              {column.label}
            </Text>
          ))}
        </View>
        {visibleRows.map((row, index) => {
          const imageUrl = resolveApiAssetUrl(row.image?.url);
          return (
            <View
              key={row.id ?? `${row.name}-${index}`}
              style={[styles.row, { backgroundColor: theme.surface }, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <Pressable
                accessibilityLabel={`${row.name} 챔피언 통계`}
                accessibilityRole="link"
                disabled={!row.slug}
                onPress={() => row.slug ? void Linking.openURL(`${mobileApiOrigin}/champions/${encodeURIComponent(row.slug)}`) : undefined}
                style={[styles.cell, { width: '16%' }]}>
                <View style={[styles.championImage, { backgroundColor: theme.surfaceMuted }]}>
                  {imageUrl ? <Image contentFit="cover" source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} /> : null}
                </View>
              </Pressable>
              <Text style={[styles.valueCell, { color: theme.ink, fontFamily: fonts.medium, width: '10%' }]}>{row.setCount}</Text>
              <Text style={[styles.valueCell, { color: accent, fontFamily: fonts.medium, width: '11%' }]}>{percentValue(row.winRate)}</Text>
              <Text style={[styles.valueCell, { color: theme.ink, fontFamily: fonts.medium, width: '11%' }]}>{statValue(row.kda, 2)}</Text>
              <Text style={[styles.valueCell, { color: theme.text, fontFamily: fonts.medium, width: '16%' }]}>{compactNumberValue(row.averageDamage)}</Text>
              <Text style={[styles.valueCell, { color: theme.text, fontFamily: fonts.medium, width: '12%' }]}>{statValue(row.dpm)}</Text>
              <Text style={[styles.valueCell, { color: theme.text, fontFamily: fonts.medium, width: '12%' }]}>{statValue(row.csm)}</Text>
              <Text style={[styles.valueCell, { color: theme.text, fontFamily: fonts.medium, width: '12%' }]}>{row.fanPogCount}</Text>
            </View>
          );
        })}
      </View>
      {hasMore ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setVisibleCount(rows.length)}
          style={({ pressed }) => [styles.moreButton, { backgroundColor: pressed ? theme.cardHover : theme.card }]}>
          <Text style={{ color: theme.ink, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 }}>전체보기</Text>
          <ChevronDown color={theme.ink} size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { alignItems: 'center', justifyContent: 'center' },
  championImage: { borderRadius: 6, height: 28, overflow: 'hidden', width: 28 },
  empty: { alignItems: 'center', borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 80 },
  frame: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  header: { alignItems: 'center', flexDirection: 'row', height: 40 },
  headerText: { fontSize: 13, lineHeight: 17, paddingHorizontal: 1, textAlign: 'center' },
  moreButton: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 6, height: 40, justifyContent: 'center', marginTop: 12 },
  row: { alignItems: 'center', flexDirection: 'row', height: 44.5 },
  valueCell: { fontSize: 12, lineHeight: 18, paddingHorizontal: 1, textAlign: 'center' },
});
