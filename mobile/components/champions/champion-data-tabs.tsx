import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  return <View style={styles.sectionTitle}><Text style={{ color: theme.ink, ...fonts.display, fontSize: 16, lineHeight: 22 }}>{children}</Text>{caption ? <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20, marginTop: 4 }}>{caption}</Text> : null}</View>;
}

function Empty({ children }: { children: string }) {
  const { fonts, theme } = useMinionTheme();
  return <View style={styles.empty}><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 14, lineHeight: 22 }}>{children}</Text></View>;
}

function Value({ value, muted = false }: { value: string; muted?: boolean }) {
  const { fonts, theme } = useMinionTheme();
  return <Text numberOfLines={1} style={{ color: muted ? theme.muted : theme.ink, ...fonts.medium, fontSize: muted ? 13 : 14, lineHeight: 20, textAlign: 'right' }}>{value}</Text>;
}

export function MatchupView({ rows }: { rows: MobileChampionDetailDto['matchups'] }) {
  const { fonts, theme } = useMinionTheme();
  return <View><SectionTitle>상대 전적</SectionTitle>{rows.length ? <View style={[styles.table, { backgroundColor: theme.surface }]}><View style={[styles.header, { backgroundColor: theme.card }]}><Text style={[styles.headerGrow, { color: theme.muted, ...fonts.medium }]}>상대</Text><Text style={[styles.headerValue, { color: theme.muted, ...fonts.medium }]}>경기</Text><Text style={[styles.headerValue, { color: theme.muted, ...fonts.medium }]}>승률</Text></View>{rows.map((row) => <View key={row.champion?.id ?? 'unknown'} style={[styles.row, { borderBottomColor: theme.border }]}><View style={styles.identity}><ChampionFace champion={row.champion} /><Text numberOfLines={1} style={{ color: theme.ink, flex: 1, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>{row.champion?.name ?? '-'}</Text></View><Value value={String(row.games)} /><Value value={percent(row.winRate)} /></View>)}</View> : <Empty>선택한 범위에 상대 전적이 없습니다.</Empty>}</View>;
}

export function DuoView({ rows }: { rows: MobileChampionDetailDto['duos'] }) {
  const { fonts, theme } = useMinionTheme();
  return <View><SectionTitle>바텀 조합</SectionTitle>{rows.length ? <View style={[styles.table, { backgroundColor: theme.surface }]}>{rows.map((row) => <View key={row.champion?.id ?? 'unknown'} style={[styles.row, { borderBottomColor: theme.border }]}><View style={styles.identity}><ChampionFace champion={row.champion} /><View style={styles.identityCopy}><Text numberOfLines={1} style={{ color: theme.ink, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>{row.champion?.name ?? '-'}</Text><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 18 }}>{row.wins}승 · {row.losses}패</Text></View></View><Value value={`${row.games}세트`} muted /><Value value={percent(row.winRate)} /></View>)}</View> : <Empty>선택한 범위에 바텀 조합이 없습니다.</Empty>}</View>;
}

export function ProView({ rows }: { rows: MobileChampionDetailDto['pros'] }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  return <View><SectionTitle>선수</SectionTitle>{rows.length ? <View style={[styles.table, { backgroundColor: theme.surface }]}>{rows.map((row, index) => <Pressable disabled={!row.player} key={row.player?.id ?? index} onPress={() => row.player && router.push(`/players/${row.player.slug}`)} style={({ pressed }) => [styles.row, { borderBottomColor: theme.border, backgroundColor: pressed ? theme.cardHover : 'transparent' }]}><View style={styles.identity}><PlayerFace player={row.player} /><View style={styles.identityCopy}><Text numberOfLines={1} style={{ color: theme.ink, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>{row.player?.name ?? '-'}</Text><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 18 }}>{row.team?.shortName ?? 'FA'} · KDA {number(row.kda, 2)}</Text></View></View><Value value={`${row.games}세트`} muted /><Value value={percent(row.winRate)} /></Pressable>)}</View> : <Empty>선택한 범위에 선수 기록이 없습니다.</Empty>}</View>;
}

export function GamesView({ rows }: { rows: MobileChampionDetailDto['games'] }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  return (
    <View><SectionTitle>경기</SectionTitle>{rows.length ? <View style={[styles.table, { backgroundColor: theme.surface }]}>
      <View style={[styles.gameHeader, { backgroundColor: theme.card }]}><Text style={[styles.resultHead, { color: theme.muted, ...fonts.medium }]}>결과</Text><Text style={[styles.gamePlayerHead, { color: theme.muted, ...fonts.medium }]}>선수</Text><Text style={[styles.kdaHead, { color: theme.muted, ...fonts.medium }]}>KDA</Text><Text style={[styles.itemHead, { color: theme.muted, ...fonts.medium }]}>아이템</Text></View>
      {rows.map((game) => <Pressable accessibilityRole="link" key={`${game.setId}:${game.player?.id}`} onPress={() => router.push(`/matches/${encodeURIComponent(game.matchId)}?tab=data&set=${encodeURIComponent(game.setId)}` as never)} style={({ pressed }) => [styles.gameRow, { borderBottomColor: theme.border, backgroundColor: pressed ? theme.cardHover : 'transparent' }]}>
        <View style={[styles.result, { backgroundColor: game.result === 'W' ? '#10b981' : '#f43f5e' }]}><Text style={{ color: '#ffffff', ...fonts.medium, fontSize: 12, lineHeight: 24 }}>{game.result}</Text></View>
        <View style={styles.gameIdentity}><PlayerFace player={game.player} size={32} /><View style={styles.identityCopy}><Text numberOfLines={1} style={{ color: theme.ink, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>{game.player?.name ?? '-'}</Text><Text numberOfLines={1} style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 18 }}>{game.tournament} · vs {game.opponentChampion?.name ?? '-'}</Text></View></View>
        <View style={styles.kda}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 13, lineHeight: 18 }}>{game.kills}/{game.deaths}/{game.assists}</Text><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 12, lineHeight: 16 }}>{number(game.kda, 2)}</Text></View>
        <View style={styles.items}>{game.items.slice(0, 6).map((item, index) => <Image key={`${item.id}-${index}`} contentFit="cover" source={{ uri: resolveApiAssetUrl(item.image?.url) ?? item.image?.url ?? '' }} style={styles.item} />)}</View>
        <ChevronRight color={theme.muted} size={15} />
      </Pressable>)}
    </View> : <Empty>선택한 범위에 경기 기록이 없습니다.</Empty>}</View>
  );
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
