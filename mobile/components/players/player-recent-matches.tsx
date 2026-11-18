import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { fetchMobileQuery, resolveApiAssetUrl, type MobilePlayerRecentMatch, type MobilePlayerRecentSet } from '@/lib/api-client';

function compactDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function AssetImage({ border = false, round = 4, url }: { border?: boolean; round?: number; url: string | null }) {
  const { theme } = useMinionTheme();
  const resolved = resolveApiAssetUrl(url);
  return (
    <View style={[styles.asset, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, borderRadius: round }, border && styles.assetBorder]}>
      {resolved ? <Image contentFit="cover" source={{ uri: resolved }} style={StyleSheet.absoluteFill} /> : null}
    </View>
  );
}

function Loadout({ line }: { line: MobilePlayerRecentSet }) {
  const { fonts, theme } = useMinionTheme();
  const championUrl = line.loadout.champion.image?.url ?? null;
  return (
    <View style={styles.loadout}>
      <View style={styles.iconCluster}>
        <View style={[styles.champion, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
          {championUrl ? <Image contentFit="cover" source={{ uri: resolveApiAssetUrl(championUrl) ?? championUrl }} style={StyleSheet.absoluteFill} /> : null}
          {line.championLevel ? (
            <View style={[styles.levelBadge, { backgroundColor: theme.surface }]}>
              <Text style={{ color: theme.ink, ...fonts.medium, fontSize: 12, lineHeight: 16 }}>{line.championLevel}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.spellRuneCluster}>
          <View>
            {line.loadout.spellImages.map((asset, index) => <AssetImage border key={`spell-${index}`} url={asset?.url ?? null} />)}
          </View>
          <View>
            {line.loadout.runeImages.map((asset, index) => (
              <View key={`rune-${index}`} style={[styles.asset, styles.rune, { backgroundColor: '#0d1117', borderRadius: 10 }]}>
                {asset?.url ? <Image contentFit="contain" source={{ uri: resolveApiAssetUrl(asset.url) ?? asset.url }} style={index === 1 ? styles.runeTree : StyleSheet.absoluteFill} /> : null}
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.loadoutCopy}>
        <Text numberOfLines={1} style={{ color: theme.text, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>{line.setNumber}세트</Text>
        <Text numberOfLines={1} style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 19.5 }}>{line.loadout.champion.name}</Text>
      </View>
    </View>
  );
}

function ItemGrid({ line }: { line: MobilePlayerRecentSet }) {
  const items = [...line.loadout.itemImages, line.loadout.trinketImage, line.loadout.roleBoundItemImage];
  return (
    <View style={styles.itemGrid}>
      {[items.slice(0, 4), items.slice(4, 8)].map((row, rowIndex) => (
        <View key={rowIndex} style={styles.itemRow}>
          {row.map((item, index) => <AssetImage border key={`${rowIndex}-${index}`} url={item?.url ?? null} />)}
        </View>
      ))}
    </View>
  );
}

function MatchSetTable({ match }: { match: MobilePlayerRecentMatch }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={[styles.table, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <View style={[styles.tableHeader, { backgroundColor: theme.card }]}>
        <Text numberOfLines={1} style={[styles.date, { color: theme.ink, ...fonts.medium }]}>{compactDate(match.startsAt)}</Text>
        <Text style={[styles.headerCell, { color: theme.muted, ...fonts.medium }]}>KDA</Text>
        <Text style={[styles.headerItems, { color: theme.muted, ...fonts.medium }]}>아이템</Text>
      </View>
      {match.sets.length === 0 ? (
        <View style={styles.emptyRows}>
          <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 14 }}>이 매치에 연결된 선수 세트 기록이 없습니다.</Text>
        </View>
      ) : match.sets.map((line, index) => (
        <View key={line.id} style={[styles.tableRow, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <Loadout line={line} />
          <View style={styles.kda}>
            <Text numberOfLines={1} style={{ color: theme.ink, ...fonts.medium, fontSize: 12, lineHeight: 16 }}>{line.kills} / {line.deaths} / {line.assists}</Text>
            <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 12, lineHeight: 16, marginTop: 2 }}>{line.kda.toFixed(2)}</Text>
          </View>
          <ItemGrid line={line} />
        </View>
      ))}
    </View>
  );
}

function MatchHistoryModal({ playerSlug, segment, onClose, open }: { playerSlug: string; segment: string; onClose: () => void; open: boolean }) {
  const { fonts, theme } = useMinionTheme();
  const [matches, setMatches] = useState<MobilePlayerRecentMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursor = useRef<{ createdAt: string; id: string } | null>(null);
  const versionRef = useRef(0);
  const loadingRef = useRef(false);
  const metrics = useRef({ contentHeight: 0, offsetY: 0, viewportHeight: 0 });
  const loadNext = useCallback(async (append = true) => {
    if (append && (loadingRef.current || !cursor.current)) return;
    const version = ++versionRef.current;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ segment });
      if (append && cursor.current) params.set('cursor', JSON.stringify(cursor.current));
      const path = `/api/mobile/v1/players/${encodeURIComponent(playerSlug)}/history?${params}`;
      const next = await fetchMobileQuery<{ matches: MobilePlayerRecentMatch[]; nextCursor: typeof cursor.current }>(path, path, true, false);
      if (version !== versionRef.current) return;
      setMatches(current => append ? [...new Map([...current, ...next.matches].map(match => [match.id, match])).values()] : next.matches);
      cursor.current = next.nextCursor;
      setHasMore(Boolean(next.nextCursor));
    } catch (caught) {
      if (version === versionRef.current) setError(caught instanceof Error ? caught.message : '경기 기록을 불러오지 못했습니다.');
    } finally {
      if (version === versionRef.current) { loadingRef.current = false; setLoading(false); }
    }
  }, [playerSlug, segment]);
  useEffect(() => {
    if (open) void loadNext(false);
    // Invalidate requests that finish after this modal closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { versionRef.current++; loadingRef.current = false; };
  }, [open, loadNext]);

  const loadIfNearEnd = useCallback(() => {
    const { contentHeight, offsetY, viewportHeight } = metrics.current;
    if (!open || contentHeight <= 0 || viewportHeight <= 0) return;
    if (offsetY + viewportHeight >= contentHeight - 120) loadNext();
  }, [loadNext, open]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    metrics.current = { contentHeight: contentSize.height, offsetY: contentOffset.y, viewportHeight: layoutMeasurement.height };
    loadIfNearEnd();
  };

  return (
    <BottomSheet
      contentStyle={styles.modalContent}
      maxHeight="92%"
      onClose={onClose}
      open={open}
      panelStyle={styles.modalPanel}
      scrollable
      scrollViewProps={{
        onContentSizeChange: (_width, height) => { metrics.current.contentHeight = height; loadIfNearEnd(); },
        onLayout: (event) => { metrics.current.viewportHeight = event.nativeEvent.layout.height; loadIfNearEnd(); },
        onScroll: handleScroll,
        scrollEventThrottle: 16,
      }}
      title="최근 경기 기록">
      {loading && matches.length === 0 ? <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>불러오는 중</Text> : matches.length === 0 ? (
        <View style={[styles.modalEmpty, { backgroundColor: theme.card }]}>
          <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 14 }}>경기 기록이 없습니다.</Text>
        </View>
      ) : matches.map((match) => <MatchSetTable key={match.id} match={match} />)}
      {error ? <Pressable onPress={() => void loadNext(Boolean(cursor.current))}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>{error} 다시 시도</Text></Pressable> : null}
      {hasMore ? (
        <View style={styles.loadMore}>
          <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>{loading ? '불러오는 중' : '아래로 스크롤해 더 보기'}</Text>
        </View>
      ) : null}
    </BottomSheet>
  );
}

export function PlayerRecentMatches({ matches, playerSlug, segment }: { matches: MobilePlayerRecentMatch[]; playerSlug: string; segment: string }) {
  const { fonts, theme } = useMinionTheme();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={{ color: theme.ink, ...fonts.display, fontSize: 16, lineHeight: 22 }}>최근 경기</Text>
        <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={[styles.recordsButton, { backgroundColor: theme.ink }]}>
          <Text style={{ color: theme.surface, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>전체 기록 보기</Text>
        </Pressable>
      </View>
      {matches.length === 0 ? (
        <View style={[styles.noRecent, { borderColor: theme.border }]}>
          <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 14 }}>최근 경기 데이터가 없습니다.</Text>
        </View>
      ) : <MatchSetTable match={matches[0]} />}
      <MatchHistoryModal playerSlug={playerSlug} segment={segment} onClose={() => setOpen(false)} open={open} />
    </View>
  );
}

const styles = StyleSheet.create({
  asset: { height: 20, overflow: 'hidden', width: 20 },
  assetBorder: { borderWidth: 1 },
  champion: { borderRadius: 6, borderWidth: 1, height: 40, overflow: 'hidden', width: 40 },
  date: { flex: 1, fontSize: 14, lineHeight: 20 },
  emptyRows: { paddingVertical: 16 },
  headerCell: { fontSize: 13, lineHeight: 18, textAlign: 'center', width: 56 },
  headerItems: { fontSize: 13, lineHeight: 18, textAlign: 'center', width: 84 },
  iconCluster: { alignItems: 'center', flexDirection: 'row', gap: 2 },
  itemGrid: { gap: 2, width: 84 },
  itemRow: { flexDirection: 'row', gap: 1 },
  kda: { alignItems: 'center', width: 56 },
  levelBadge: { borderTopLeftRadius: 4, bottom: 0, paddingHorizontal: 2, position: 'absolute', right: 0 },
  loadMore: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  loadout: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, minWidth: 0 },
  loadoutCopy: { flex: 1, minWidth: 0 },
  modalContent: { gap: 12, },
  modalEmpty: { borderRadius: 12, padding: 20 },
  modalPanel: { height: '92%' },
  noRecent: { borderRadius: 16, borderWidth: 1, padding: 24 },
  recordsButton: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  rune: { alignItems: 'center', justifyContent: 'center' },
  runeTree: { height: '72%', width: '72%' },
  sectionHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  spellRuneCluster: { flexDirection: 'row' },
  table: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  tableHeader: { alignItems: 'center', flexDirection: 'row', gap: 8, height: 40, paddingHorizontal: 10 },
  tableRow: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 58.67, paddingHorizontal: 10, paddingVertical: 8 },
});
