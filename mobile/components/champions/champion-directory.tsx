import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import Search from 'lucide-react-native/icons/search';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ErrorState } from '@/components/feedback-states';
import { MinionScreen } from '@/components/minion-screen';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileChampionPosition, type MobileChampionsDto } from '@/lib/api-client';

const POSITION_OPTIONS: { value: MobileChampionPosition | 'all'; label: string }[] = [
  { value: 'all', label: '전체' }, { value: 'TOP', label: 'TOP' }, { value: 'JGL', label: 'JGL' },
  { value: 'MID', label: 'MID' }, { value: 'BOT', label: 'BOT' }, { value: 'SUP', label: 'SUP' },
];
const SORT_OPTIONS: { value: MobileChampionsDto['selected']['sort']; label: string }[] = [
  { value: 'presence', label: '픽밴률순' }, { value: 'picks', label: '픽순' }, { value: 'bans', label: '밴순' },
  { value: 'winRate', label: '승률순' }, { value: 'name', label: '이름순' },
];

function qs(values: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value && value !== 'all' && !(key === 'sort' && value === 'presence')) params.set(key, value);
  });
  const query = params.toString();
  return `/api/mobile/v1/champions${query ? `?${query}` : ''}`;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Choice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <Pressable onPress={onPress} style={[styles.choice, { backgroundColor: active ? theme.ink : theme.card }]}>
      <Text style={{ color: active ? theme.surface : theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>{label}</Text>
    </Pressable>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={styles.filterSection}>
      <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>{label}</Text>
      <View style={styles.choiceGrid}>{children}</View>
    </View>
  );
}

function DirectorySkeleton() {
  const { theme } = useMinionTheme();
  return (
    <View style={styles.page}>
      <View style={styles.topRow}><View style={[styles.skeletonCount, { backgroundColor: theme.surfaceMuted }]} /><View style={[styles.skeletonFilter, { backgroundColor: theme.surfaceMuted }]} /></View>
      <View style={styles.toolbar}><View style={[styles.skeletonToolbar, { backgroundColor: theme.surfaceMuted, flex: 1 }]} /><View style={[styles.skeletonToolbar, { backgroundColor: theme.surfaceMuted, width: 128 }]} /></View>
      <View style={styles.grid}>{Array.from({ length: 20 }, (_, index) => <View key={index} style={styles.skeletonItem}><View style={[styles.face, { backgroundColor: theme.surfaceMuted }]} /><View style={[styles.skeletonName, { backgroundColor: theme.surfaceMuted }]} /></View>)}</View>
    </View>
  );
}

export function ChampionDirectory() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ position?: string; sort?: string; q?: string; season?: string; tournament?: string; patch?: string }>();
  const { width } = useWindowDimensions();
  const { fonts, theme } = useMinionTheme();
  const initialPosition = POSITION_OPTIONS.some((option) => option.value === first(routeParams.position)) ? first(routeParams.position) as MobileChampionPosition : 'all';
  const initialSort = SORT_OPTIONS.some((option) => option.value === first(routeParams.sort)) ? first(routeParams.sort) as MobileChampionsDto['selected']['sort'] : 'presence';
  const [position, setPosition] = useState<MobileChampionPosition | 'all'>(initialPosition);
  const [sort, setSort] = useState<MobileChampionsDto['selected']['sort']>(initialSort);
  const [query, setQuery] = useState(first(routeParams.q) ?? '');
  const [committedQuery, setCommittedQuery] = useState(first(routeParams.q) ?? '');
  const [season, setSeason] = useState(first(routeParams.season) ?? '');
  const [tournament, setTournament] = useState(first(routeParams.tournament) ?? 'all');
  const [patch, setPatch] = useState(first(routeParams.patch) ?? 'all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  useEffect(() => {
    const timeout = setTimeout(() => setCommittedQuery(query.trim()), 250);
    return () => clearTimeout(timeout);
  }, [query]);
  const path = useMemo(() => qs({ position, sort, q: committedQuery, season, tournament, patch }), [committedQuery, patch, position, season, sort, tournament]);
  const { data, error, loading, refresh } = useCachedQuery<MobileChampionsDto>(path);
  useEffect(() => {
    if (!season && data?.scope.season) setSeason(String(data.scope.season));
  }, [data?.scope.season, season]);

  if (loading && !data) return <MinionScreen><DirectorySkeleton /></MinionScreen>;
  if (error && !data) return <MinionScreen><ErrorState onRetry={refresh} title={error} /></MinionScreen>;

  const columns = width >= 360 ? 5 : 4;
  const contentWidth = Math.max(0, width - 32);
  const cellWidth = Math.floor((contentWidth - (columns - 1) * 8) / columns);
  const sortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label ?? '픽밴률순';
  const scope = data?.scope;
  const detailQuery = qs({ season, tournament, patch }).replace('/api/mobile/v1/champions', '');

  return (
    <MinionScreen>
      <View style={styles.page}>
        <View style={styles.topRow}>
          <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>{data?.items.length ?? 0}개</Text>
          <Pressable onPress={() => setFilterOpen(true)} style={[styles.filterButton, { borderColor: theme.border }]}>
            <SlidersHorizontal color={theme.ink} size={17} />
            <Text style={{ color: theme.ink, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>필터</Text>
          </Pressable>
        </View>
        <View style={styles.toolbar}>
          <View style={[styles.search, { backgroundColor: theme.card }]}>
            <Search color={theme.muted} size={17} />
            <TextInput accessibilityLabel="챔피언 검색" onChangeText={setQuery} placeholder="챔피언 검색" placeholderTextColor={theme.muted} returnKeyType="search" style={[styles.searchInput, { color: theme.ink, ...fonts.regular }]} value={query} />
          </View>
          <Pressable accessibilityLabel="정렬 선택" onPress={() => setSortOpen(true)} style={[styles.sortButton, { backgroundColor: theme.card }]}>
            <Text numberOfLines={1} style={{ color: theme.ink, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>{sortLabel}</Text>
            <ChevronDown color={theme.muted} size={16} />
          </Pressable>
        </View>
        {data?.items.length ? (
          <View accessibilityLabel="챔피언 목록" style={styles.grid}>
            {data.items.map((champion) => (
              <Pressable accessibilityRole="link" key={champion.id} onPress={() => router.push(`/champions/${champion.slug}${detailQuery}` as never)} style={({ pressed }) => [styles.champion, { width: cellWidth, backgroundColor: pressed ? theme.cardHover : 'transparent' }]}>
                {champion.image?.url ? <Image accessibilityLabel={champion.name} contentFit="cover" source={{ uri: resolveApiAssetUrl(champion.image.url) ?? champion.image.url }} style={styles.face} transition={100} /> : <View style={[styles.face, { backgroundColor: theme.card }]} />}
                <Text numberOfLines={1} style={{ color: theme.ink, ...fonts.medium, fontSize: 13, lineHeight: 18, maxWidth: cellWidth }}>{champion.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.empty}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 16, lineHeight: 24 }}>챔피언을 찾지 못했습니다.</Text><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 14, lineHeight: 22, marginTop: 4 }}>필터나 검색어를 바꿔보세요.</Text></View>
        )}
      </View>
      <BottomSheet contentStyle={styles.sheet} onClose={() => setFilterOpen(false)} open={filterOpen} scrollable title="챔피언 필터">
        <FilterSection label="포지션">{POSITION_OPTIONS.map((option) => <Choice active={position === option.value} key={option.value} label={option.label} onPress={() => setPosition(option.value)} />)}</FilterSection>
        {scope ? <>
          <FilterSection label="시즌">{scope.seasons.map((value) => <Choice active={season === String(value)} key={value} label={String(value)} onPress={() => setSeason(String(value))} />)}</FilterSection>
          <FilterSection label="대회"><Choice active={tournament === 'all'} label="전체" onPress={() => setTournament('all')} />{scope.tournaments.map((option) => <Choice active={tournament === option.value} key={option.value} label={option.label} onPress={() => setTournament(option.value)} />)}</FilterSection>
          <FilterSection label="패치"><Choice active={patch === 'all'} label="전체" onPress={() => setPatch('all')} />{scope.patches.map((value) => <Choice active={patch === value} key={value} label={value} onPress={() => setPatch(value)} />)}</FilterSection>
        </> : null}
        <Pressable onPress={() => setFilterOpen(false)} style={[styles.apply, { backgroundColor: theme.ink }]}><Text style={{ color: theme.surface, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>적용</Text></Pressable>
      </BottomSheet>
      <BottomSheet contentStyle={styles.sheet} onClose={() => setSortOpen(false)} open={sortOpen} title="정렬">
        <View style={styles.sortList}>{SORT_OPTIONS.map((option) => <Pressable key={option.value} onPress={() => { setSort(option.value); setSortOpen(false); }} style={[styles.sortOption, { backgroundColor: sort === option.value ? theme.card : 'transparent' }]}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 14, lineHeight: 21 }}>{option.label}</Text></Pressable>)}</View>
      </BottomSheet>
    </MinionScreen>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 8 },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 44 },
  filterButton: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 7, minHeight: 44, paddingHorizontal: 12 },
  toolbar: { flexDirection: 'row', gap: 8, marginBottom: 16, marginTop: 8 },
  search: { alignItems: 'center', borderRadius: 12, flex: 1, flexDirection: 'row', gap: 9, height: 40, minWidth: 0, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 14, height: 40, lineHeight: 20, minWidth: 0, padding: 0 },
  sortButton: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 6, height: 40, justifyContent: 'space-between', paddingHorizontal: 11, width: 128 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  champion: { alignItems: 'center', borderRadius: 12, gap: 4, paddingBottom: 5, paddingTop: 4 },
  face: { borderRadius: 8, height: 48, width: 48 },
  empty: { alignItems: 'center', justifyContent: 'center', minHeight: 256, paddingHorizontal: 20 },
  sheet: { gap: 20, padding: 16 },
  filterSection: { gap: 8 },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', minHeight: 40, minWidth: '30%', paddingHorizontal: 12 },
  apply: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', minHeight: 44 },
  sortList: { gap: 4 },
  sortOption: { borderRadius: 10, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  skeletonCount: { borderRadius: 4, height: 14, width: 40 },
  skeletonFilter: { borderRadius: 12, height: 44, width: 76 },
  skeletonToolbar: { borderRadius: 12, height: 40 },
  skeletonItem: { alignItems: 'center', gap: 5, paddingVertical: 4, width: '18%' },
  skeletonName: { borderRadius: 4, height: 12, width: 46 },
});
