import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DataTable, type DataTableColumn } from '@/components/data-table';
import { useState } from 'react';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileChampionDetailDto, type MobileChampionSummary, type MobilePlayerSummary } from '@/lib/api-client';

function percent(value: number | null | undefined, digits = 1) {
  return value == null ? '-' : `${value.toFixed(digits)}%`;
}

function number(value: number | null | undefined, digits = 0) {
  return value == null ? '-' : value.toFixed(digits);
}

function ChampionFace({ champion, size = 32 }: { champion: MobileChampionSummary | null; size?: number }) {
  const { fonts, theme } = useMinionTheme();
  const uri = resolveApiAssetUrl(champion?.image?.url) ?? champion?.image?.url;
  return uri ? <Image contentFit="cover" source={{ uri }} style={{ borderRadius: 7, height: size, width: size }} /> : <View style={{ alignItems: 'center', backgroundColor: theme.card, borderRadius: 7, height: size, justifyContent: 'center', width: size }}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>{champion?.name.slice(0, 1) ?? '-'}</Text></View>;
}

function PlayerFace({ player, size = 32 }: { player: MobilePlayerSummary | null; size?: number }) {
  const { fonts, theme } = useMinionTheme();
  const uri = resolveApiAssetUrl(player?.profileImage?.url) ?? player?.profileImage?.url;
  return uri ? <Image contentFit="cover" contentPosition="top" source={{ uri }} style={{ backgroundColor: theme.card, borderRadius: size / 2, height: size, width: size }} /> : <View style={{ alignItems: 'center', backgroundColor: theme.card, borderRadius: size / 2, height: size, justifyContent: 'center', width: size }}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>{player?.name.slice(0, 2) ?? '-'}</Text></View>;
}

function SectionTitle({ caption, children }: { caption?: string; children: string }) {
  const { fonts, theme } = useMinionTheme();
  return <View style={styles.sectionTitle}><Text style={{ color: theme.ink, ...fonts.display, fontSize: 20, lineHeight: 28 }}>{children}</Text>{caption ? <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20, marginTop: 4 }}>{caption}</Text> : null}</View>;
}

function Empty({ children }: { children: string }) {
  const { fonts, theme } = useMinionTheme();
  return <View style={styles.empty}><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 14, lineHeight: 22 }}>{children}</Text></View>;
}

function Stat({ value }: { value: string }) {
  const { fonts, theme } = useMinionTheme();
  return <Text style={{ color: theme.ink, ...fonts.regular, fontSize: 14, lineHeight: 20 }}>{value}</Text>;
}

function signed(value: number | null | undefined, digits = 0) {
  return value == null ? '-' : `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function ChampionIdentity({ champion }: { champion: MobileChampionSummary | null }) {
  const { fonts, theme } = useMinionTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}><ChampionFace champion={champion} size={36} /><Text numberOfLines={1} style={{ color: theme.ink, ...fonts.bold, fontSize: 16, lineHeight: 24, flexShrink: 1 }}>{champion?.name ?? '알 수 없음'}</Text></View>;
}

export function MatchupView({ rows }: { rows: MobileChampionDetailDto['matchups'] }) {
  const columns: DataTableColumn<MobileChampionDetailDto['matchups'][number]>[] = [
    { key: 'champion', label: '상대 챔피언', width: 176, flex: true, render: (row) => <ChampionIdentity champion={row.champion} /> },
    { key: 'games', label: '경기', width: 64, render: (row) => <Stat value={String(row.games)} /> },
    { key: 'rate', label: '승률', width: 80, render: (row) => <Stat value={percent(row.winRate)} /> },
    { key: 'gold', label: '15분 골드', width: 100, render: (row) => <Stat value={signed(row.goldDiffAt15)} /> },
    { key: 'cs', label: '15분 CS', width: 92, render: (row) => <Stat value={signed(row.csDiffAt15, 1)} /> },
  ];
  return <View><SectionTitle>상대 전적</SectionTitle>{rows.length ? <DataTable columns={columns} rows={rows} getRowKey={(row) => row.champion?.id ?? 'unknown'} /> : <Empty>선택한 범위에 상대 기록이 없습니다.</Empty>}</View>;
}

function DuoDetails({ row }: { row: MobileChampionDetailDto['duos'][number] }) {
  const { fonts, theme } = useMinionTheme();
  return <View style={{ backgroundColor: theme.card, padding: 16, borderRadius: 12, marginBottom: 16, gap: 20 }}>
    <View><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 18, lineHeight: 24 }}>선수 조합</Text><View style={{ marginTop: 8 }}>{(row.playerPairs ?? []).slice(0, 5).map((pair, i) => <View key={i} style={[styles.detailRow, i > 0 && { borderTopWidth: 1, borderColor: theme.border }]}><PlayerFace player={pair.botPlayer} size={36} /><Text numberOfLines={1} style={{ color: theme.ink, ...fonts.bold, flex: 1, fontSize: 16, lineHeight: 24 }}>{pair.botPlayer?.name ?? '-'} + {pair.supPlayer?.name ?? '-'}</Text><View style={{ alignItems: 'flex-end' }}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>{percent(pair.winRate)}</Text><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20 }}>{pair.games}경기</Text></View></View>)}</View></View>
    <View><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 18, lineHeight: 24 }}>상대 조합</Text><View style={{ marginTop: 8 }}>{(row.opponentDuos ?? []).slice(0, 5).map((pair, i) => <View key={i} style={[styles.detailRow, i > 0 && { borderTopWidth: 1, borderColor: theme.border }]}><View style={{ flexDirection: 'row' }}><ChampionFace champion={pair.botChampion} size={36} /><View style={{ marginLeft: -8 }}><ChampionFace champion={pair.supChampion} size={36} /></View></View><Text numberOfLines={1} style={{ color: theme.ink, ...fonts.bold, flex: 1, fontSize: 16, lineHeight: 24 }}>{pair.botChampion?.name ?? '-'} + {pair.supChampion?.name ?? '-'}</Text><View style={{ alignItems: 'flex-end' }}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>{percent(pair.winRate)}</Text><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20 }}>{pair.games}경기</Text></View></View>)}</View></View>
  </View>;
}

export function DuoView({ rows }: { rows: MobileChampionDetailDto['duos'] }) {
  const columns: DataTableColumn<MobileChampionDetailDto['duos'][number]>[] = [
    { key: 'partner', label: '파트너', width: 176, flex: true, render: (row) => <ChampionIdentity champion={row.champion} /> },
    { key: 'games', label: '경기', width: 64, render: (row) => <Stat value={String(row.games)} /> },
    { key: 'rate', label: '승률', width: 80, render: (row) => <Stat value={percent(row.winRate)} /> },
    { key: 'gold', label: '15분 골드', width: 100, render: (row) => <Stat value={signed(row.goldDiffAt15)} /> },
  ];
  return <View><SectionTitle caption="동시 출전 기준">바텀 조합</SectionTitle>{rows.length ? <DataTable columns={columns} rows={rows} getRowKey={(row) => row.champion?.id ?? 'unknown'} rowLabel={(row) => `${row.champion?.name ?? '파트너'} 조합 상세`} renderExpanded={(row) => <DuoDetails row={row} />} /> : <Empty>선택한 범위에 바텀 조합 기록이 없습니다.</Empty>}</View>;
}

export function ProView({ rows }: { rows: MobileChampionDetailDto['pros'] }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  const columns: DataTableColumn<MobileChampionDetailDto['pros'][number]>[] = [
    { key: 'player', label: '선수', width: 176, flex: true, render: (row) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><PlayerFace player={row.player} size={36} /><Pressable disabled={!row.player} accessibilityRole="link" onPress={() => row.player && router.push(`/players/${row.player.slug}`)}><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 16, lineHeight: 24 }}>{row.player?.name ?? '알 수 없음'}</Text></Pressable></View> },
    { key: 'games', label: '경기', width: 64, render: (row) => <Stat value={String(row.games)} /> },
    { key: 'rate', label: '승률', width: 80, render: (row) => <Stat value={percent(row.winRate)} /> },
    { key: 'kda', label: 'KDA', width: 80, render: (row) => <Stat value={number(row.kda, 2)} /> },
    { key: 'dpm', label: 'DPM', width: 80, render: (row) => <Stat value={number(row.dpm)} /> },
    { key: 'gold', label: '15분 골드', width: 100, render: (row) => <Stat value={signed(row.goldDiffAt15)} /> },
  ];
  return <View><SectionTitle>선수</SectionTitle>{rows.length ? <DataTable columns={columns} rows={rows} /> : <Empty>선택한 범위에 사용 기록이 없습니다.</Empty>}</View>;
}

export function GamesView({ rows }: { rows: MobileChampionDetailDto['games'] }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / 20));
  const activePage = Math.min(page, pageCount);
  const columns: DataTableColumn<MobileChampionDetailDto['games'][number]>[] = [
    { key: 'result', label: '결과', width: 56, render: (game) => <View style={{ width: 24, height: 24, borderRadius: 4, justifyContent: 'center', alignItems: 'center', backgroundColor: game.result === 'W' ? '#10b981' : '#f43f5e' }}><Text style={{ color: '#fff', ...fonts.medium, fontSize: 12, lineHeight: 24 }}>{game.result}</Text></View> },
    { key: 'player', label: '선수', width: 176, flex: true, render: (game) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 }}><PlayerFace player={game.player} size={36} /><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: theme.ink, ...fonts.bold, fontSize: 16, lineHeight: 24 }}>{game.player?.name ?? '-'}</Text><Text numberOfLines={1} style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20 }}>{game.tournament} vs {game.opponentChampion?.name ?? '-'}</Text></View></View> },
    { key: 'kda', label: 'KDA', width: 108, align: 'center', render: (game) => <View style={{ alignItems: 'center' }}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 15, lineHeight: 18 }}>{game.kills} / {game.deaths} / {game.assists}</Text><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 14, lineHeight: 18, marginTop: 2 }}>{number(game.kda, 2)}</Text></View> },
    { key: 'tournament', label: '대회', width: 100, render: (game) => <Text numberOfLines={1} style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>{game.tournament}</Text> },
    { key: 'opponent', label: '상대', width: 140, render: (game) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ChampionFace champion={game.opponentChampion} size={28} /><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 13 }}>{game.opponentChampion?.name ?? '-'}</Text></View> },
    { key: 'items', label: '아이템', width: 120, render: (game) => <View style={{ width: 102, flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>{(game.itemSlots ?? game.items.map((item) => item.image)).map((item, i) => <View key={i} style={{ width: 24, height: 24, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}>{item?.url ? <Image contentFit="cover" source={{ uri: resolveApiAssetUrl(item.url) ?? item.url }} style={{ width: 22, height: 22 }} /> : null}</View>)}</View> },
    { key: 'detail', label: '', width: 24, render: () => null },
  ];
  return <View><SectionTitle caption={`${rows.length.toLocaleString('ko-KR')}경기 최신순`}>경기</SectionTitle>{rows.length ? <DataTable columns={columns} rows={rows.slice((activePage - 1) * 20, activePage * 20)} getRowKey={(row) => `${row.setId}:${row.player?.id}`} rowLabel={(row) => `${row.player?.name ?? '선수'} 경기 상세`} onPressRow={(row) => { if (row.href) router.push(row.href as never); }} /> : <Empty>선택한 범위에 경기 기록이 없습니다.</Empty>}{pageCount > 1 ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12 }}><Pressable disabled={activePage === 1} accessibilityLabel="이전 페이지" onPress={() => setPage(activePage - 1)} style={{ padding: 12, opacity: activePage === 1 ? 0.3 : 1 }}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 14 }}>이전</Text></Pressable>{Array.from({ length: Math.min(5, pageCount) }, (_, i) => Math.max(1, Math.min(activePage - 2, pageCount - 4)) + i).map((value) => <Pressable key={value} accessibilityState={{ selected: value === activePage }} onPress={() => setPage(value)} style={{ minWidth: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: value === activePage ? theme.ink : undefined }}><Text style={{ color: value === activePage ? theme.surface : theme.muted, ...fonts.medium, fontSize: 14 }}>{value}</Text></Pressable>)}<Pressable disabled={activePage === pageCount} accessibilityLabel="다음 페이지" onPress={() => setPage(activePage + 1)} style={{ padding: 12, opacity: activePage === pageCount ? 0.3 : 1 }}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 14 }}>다음</Text></Pressable></View> : null}</View>;
}

function Distribution({ title, rows }: { title: string; rows: { key: string; count: number; rate: number }[] }) {
  const { fonts, theme } = useMinionTheme();
  const labels: Record<string, string> = { blue: '블루', red: '레드', pick1: '1차 픽', pick2: '2차 픽', ban1: '1차 밴', ban2: '2차 밴' };
  return <View style={[styles.statCard, { backgroundColor: theme.card }]}><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 15, lineHeight: 22 }}>{title}</Text><View style={styles.distributionList}>{rows.slice(0, 4).map((row, index) => <View key={row.key} style={[styles.distribution, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 14, lineHeight: 20, width: 72 }}>{labels[row.key] ?? row.key}</Text><View style={[styles.bar, { backgroundColor: theme.surface }]}><View style={[styles.fill, { backgroundColor: theme.accent, width: `${Math.min(row.rate, 100)}%` }]} /></View><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20, textAlign: 'right', width: 120 }}>{row.count}회 · {percent(row.rate, 0)}</Text></View>)}</View></View>;
}

export function StatsView({ stats, totalGames }: { stats: MobileChampionDetailDto['stats']; totalGames: number }) {
  const { fonts, theme } = useMinionTheme();
  const recordedGames = stats.patches.reduce((sum, row) => sum + row.games, 0);
  const maxPatchGames = Math.max(...stats.patches.map((row) => row.games), 1);
  const blueSide = stats.sides.find((side) => side.side === 'blue');
  const redSide = stats.sides.find((side) => side.side === 'red');
  const sideGames = (blueSide?.games ?? 0) + (redSide?.games ?? 0);
  const blueShare = sideGames ? ((blueSide?.games ?? 0) / sideGames) * 100 : 50;
  return (
    <View style={styles.statsPage}>
      <View>
        <SectionTitle caption={`${recordedGames}/${totalGames}경기`}>패치별 기록</SectionTitle>
        <View style={[styles.table, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
          {stats.patches.slice(-10).reverse().map((row) => (
            <View key={row.patch} style={[styles.patchRow, { borderBottomColor: theme.border }]}>
              <Text style={{ color: theme.ink, ...fonts.medium, fontSize: 14, lineHeight: 20, width: 61 }}>{row.patch}</Text>
              <View style={[styles.patchBar, { backgroundColor: theme.card }]}><View style={[styles.fill, { backgroundColor: theme.accent, width: `${Math.min((row.games / maxPatchGames) * 100, 100)}%` }]} /></View>
              <Text numberOfLines={1} style={{ color: theme.ink, ...fonts.medium, fontSize: 13, lineHeight: 20, textAlign: 'right', width: 76 }}>{percent(row.winRate)}</Text>
            </View>
          ))}
        </View>
      </View>
      <View>
        <SectionTitle>진영 · 드래프트</SectionTitle>
        <View style={styles.statStack}>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 15, lineHeight: 22 }}>진영 승률</Text><View style={styles.sideGrid}>{stats.sides.map((side) => <View key={side.side} style={styles.side}><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20 }}>{side.side === 'blue' ? '블루' : '레드'}</Text><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 18, lineHeight: 24 }}>{percent(side.winRate)}</Text><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 19 }}>{side.wins}승 · {side.losses}패 · {side.games}경기</Text></View>)}</View><View style={[styles.sideShare, { backgroundColor: theme.surface }]}><View style={{ backgroundColor: '#3b82f6', width: `${blueShare}%` }} /><View style={{ backgroundColor: '#f43f5e', width: `${100 - blueShare}%` }} /></View></View>
          <Distribution rows={stats.pickPhases} title="픽 단계" />
          <Distribution rows={stats.banPhases} title="밴 단계" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  table: { borderRadius: 8, overflow: 'hidden' },
  sectionTitle: { marginBottom: 12 },
  header: { alignItems: 'center', flexDirection: 'row', height: 36, paddingHorizontal: 12 },
  headerGrow: { flex: 1, fontSize: 13, lineHeight: 18 },
  headerValue: { fontSize: 13, lineHeight: 18, textAlign: 'right', width: 64 },
  row: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 8, minHeight: 56, paddingHorizontal: 12, paddingVertical: 8 },
  identity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 9, minWidth: 0 },
  identityCopy: { flex: 1, minWidth: 0 },
  empty: { alignItems: 'center', justifyContent: 'center', minHeight: 132, paddingHorizontal: 20 },
  gameHeader: { alignItems: 'center', flexDirection: 'row', height: 36, paddingHorizontal: 8 },
  resultHead: { fontSize: 13, lineHeight: 18, textAlign: 'center', width: 34 },
  gamePlayerHead: { flex: 1, fontSize: 13, lineHeight: 18, marginLeft: 8 },
  kdaHead: { fontSize: 13, lineHeight: 18, textAlign: 'center', width: 52 },
  itemHead: { fontSize: 13, lineHeight: 18, textAlign: 'right', width: 62 },
  gameRow: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 7, minHeight: 60, paddingHorizontal: 8, paddingVertical: 8 },
  result: { alignItems: 'center', borderRadius: 4, height: 24, justifyContent: 'center', width: 24 },
  gameIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 7, minWidth: 0 },
  kda: { alignItems: 'center', width: 48 },
  items: { flexDirection: 'row', flexWrap: 'wrap', gap: 1, justifyContent: 'flex-end', width: 62 },
  item: { borderRadius: 3, height: 17, width: 17 },
  statsPage: { gap: 28 },
  patchRow: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, minHeight: 48, paddingHorizontal: 16, paddingVertical: 8 },
  patchBar: { borderRadius: 3, flex: 1, height: 6, overflow: 'hidden' },
  statCard: { borderRadius: 8, padding: 16 },
  statStack: { gap: 12 },
  sideGrid: { flexDirection: 'row', gap: 20, marginTop: 16 },
  side: { flex: 1 },
  sideShare: { borderRadius: 4, flexDirection: 'row', height: 8, marginTop: 20, overflow: 'hidden' },
  distributionList: { marginTop: 8 },
  distribution: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 44, paddingVertical: 8 },
  bar: { borderRadius: 3, flex: 1, height: 6, overflow: 'hidden' },
  fill: { borderRadius: 3, height: 6 },
});
