import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ListFilter from 'lucide-react-native/icons/list-filter';
import Search from 'lucide-react-native/icons/search';
import X from 'lucide-react-native/icons/x';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { TeamLogo } from '@/components/data/team-logo';
import { ErrorState } from '@/components/feedback-states';
import { MinionScreen } from '@/components/minion-screen';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { mobileApiOrigin, resolveApiAssetUrl, type MobileNewsDto, type MobileNewsItem } from '@/lib/api-client';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function newsHref(team: string, query: string, page = 1) {
  const params = new URLSearchParams();
  if (team) params.set('team', team);
  if (query) params.set('q', query);
  if (page > 1) params.set('page', String(page));
  const suffix = params.toString();
  return suffix ? `/news?${suffix}` : '/news';
}

export function NewsScreen() {
  const params = useLocalSearchParams<{ page?: string | string[]; q?: string | string[]; team?: string | string[] }>();
  const selectedTeam = first(params.team);
  const query = first(params.q).trim();
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);
  const apiParams = new URLSearchParams({ page: String(page) });
  if (selectedTeam) apiParams.set('team', selectedTeam);
  if (query) apiParams.set('q', query);
  const path = `/api/mobile/v1/news?${apiParams.toString()}`;
  const { data, error, loading, refresh } = useCachedQuery<MobileNewsDto>(path);

  if (loading && !data) return <MinionScreen contentStyle={styles.screen}><NewsLoadingSkeleton /></MinionScreen>;
  if (error && !data) return <MinionScreen contentStyle={styles.screen}><ErrorState onRetry={refresh} title={error} /></MinionScreen>;
  if (!data) return <MinionScreen contentStyle={styles.screen}><ErrorState onRetry={refresh} title="뉴스를 불러오지 못했습니다." /></MinionScreen>;

  return <NewsContent data={data} />;
}

function NewsContent({ data }: { data: MobileNewsDto }) {
  const router = useRouter();
  const { fonts, showToast, theme } = useMinionTheme();
  const [draft, setDraft] = useState(data.query);
  const [filterOpen, setFilterOpen] = useState(false);
  const [scrollRequest, setScrollRequest] = useState<{ animated: boolean; y: number } | null>(null);
  const selectedTeamData = data.teams.find((team) => team.slug === data.teamSlug);

  useEffect(() => setDraft(data.query), [data.query]);

  const navigate = (team: string, query: string, page = 1, scrollTop = false) => {
    router.replace(newsHref(team, query, page) as never);
    if (scrollTop) setScrollRequest({ animated: false, y: 0 });
  };
  const submitSearch = () => navigate(data.teamSlug ?? '', draft.trim());
  const title = data.query ? '검색 결과' : selectedTeamData ? `${selectedTeamData.shortName} 뉴스` : '최신 뉴스';

  return (
    <>
    <MinionScreen contentStyle={styles.screen} scrollRequest={scrollRequest}>
      <View accessibilityLabel="뉴스 필터" style={[styles.filter, { backgroundColor: theme.card }]}>
        <View style={styles.toolbar}>
          <Pressable accessibilityLabel="뉴스 팀 선택" accessibilityRole="button" accessibilityState={{ expanded: filterOpen }} onPress={() => setFilterOpen(true)} style={[styles.filterTrigger, { backgroundColor: theme.surface, borderColor: filterOpen ? theme.ink : theme.border }]}>
            <View style={styles.filterTriggerIdentity}>
              {selectedTeamData ? <TeamLogo plain size={20} team={selectedTeamData} themeAware /> : <ListFilter color={theme.muted} size={17} />}
              <Text numberOfLines={1} style={{ color: theme.text, flexShrink: 1, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{selectedTeamData?.shortName ?? '전체 팀'}</Text>
            </View>
            <ChevronDown color={theme.muted} size={15} />
          </Pressable>
          <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Search color={theme.muted} pointerEvents="none" size={16} style={styles.searchIcon} />
            <TextInput
              accessibilityLabel="뉴스 검색"
              onChangeText={setDraft}
              onSubmitEditing={submitSearch}
              placeholder="팀, 선수, 기사 제목 검색"
              placeholderTextColor={theme.muted}
              returnKeyType="search"
              style={[styles.searchInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.ink, ...fonts.medium }]}
              value={draft}
            />
          </View>
          <Pressable accessibilityRole="button" onPress={submitSearch} style={({ pressed }) => [styles.searchButton, { backgroundColor: theme.ink, opacity: pressed ? 0.82 : 1 }]}><Text style={{ color: theme.surface, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>검색</Text></Pressable>
          {data.query ? <Pressable accessibilityLabel="검색어 지우기" accessibilityRole="link" onPress={() => navigate(data.teamSlug ?? '', '')} style={[styles.clearButton, { borderColor: theme.border }]}><X color={theme.muted} size={17} /></Pressable> : null}
          </View>
        </View>
      </View>

      <View accessibilityLabel={title}>
        <View style={styles.latestRow}>
          <View style={styles.latestIdentity}><Text accessibilityRole="header" aria-level={2} style={[styles.latestTitle, { color: theme.ink, ...fonts.display }]}>{title}</Text><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>현재 {data.items.length}건</Text></View>
          {data.teamSlug || data.query ? <Pressable onPress={() => navigate('', '')} style={styles.reset}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>필터 초기화</Text></Pressable> : null}
        </View>

        {data.items.length ? <View>{data.items.map((article, index) => <View key={article.id} style={[styles.newsItem, index < data.items.length - 1 ? { borderBottomColor: theme.divider, borderBottomWidth: 1 } : null, index === 0 && styles.firstNewsItem, index === data.items.length - 1 && styles.lastNewsItem]}><NewsRow article={article} onOpenError={() => showToast('기사 원문을 열지 못했습니다.', 'error')} /></View>)}</View> : <NewsEmpty />}
      </View>

      {data.totalPages > 1 ? <Pagination onChange={(nextPage) => navigate(data.teamSlug ?? '', data.query, nextPage, true)} page={data.page} totalPages={data.totalPages} /> : null}
      <Text style={[styles.footnote, { color: theme.muted, ...fonts.regular }]}>{data.isFallback ? '뉴스를 불러오지 못해 임시 데이터를 표시하고 있습니다.' : '기사 제목을 선택하면 해당 언론사의 원문으로 이동합니다.'}</Text>
    </MinionScreen>
    <BottomSheet onClose={() => setFilterOpen(false)} open={filterOpen} title="팀 필터">
      <ScrollView accessibilityLabel="뉴스 팀" contentContainerStyle={styles.filterOptions} showsVerticalScrollIndicator={false}>
        <FilterOption active={!data.teamSlug} detail="LCK 전체 뉴스" label="전체 팀" onPress={() => { setFilterOpen(false); navigate('', data.query); }} />
        {data.teams.map((team) => <FilterOption active={team.slug === data.teamSlug} detail={team.name} key={team.id} label={team.shortName} onPress={() => { setFilterOpen(false); navigate(team.slug, data.query); }} team={team} />)}
      </ScrollView>
    </BottomSheet>
    </>
  );
}

function FilterOption({ active, detail, label, onPress, team }: { active: boolean; detail: string; label: string; onPress: () => void; team?: MobileNewsDto['teams'][number] }) {
  const { fonts, theme } = useMinionTheme();
  return <Pressable accessibilityRole="menuitem" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.filterOption, active || pressed ? { backgroundColor: theme.surfaceMuted } : null]}>{team ? <TeamLogo plain size={28} team={team} themeAware /> : <View style={[styles.allTeamsIcon, { backgroundColor: theme.surfaceMuted }]}><ListFilter color={theme.muted} size={17} /></View>}<View style={styles.filterOptionCopy}><Text numberOfLines={1} style={{ color: theme.ink, ...fonts.medium, fontSize: 14, lineHeight: 21 }}>{label}</Text><Text numberOfLines={1} style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 19.5 }}>{detail}</Text></View>{active ? <Check color={theme.ink} size={17} /> : null}</Pressable>;
}

// 썸네일은 목록 응답에서 제외되어 있어, 렌더 후 기사 원문 URL로 개별 해석한다.
function useResolvedThumbnail(article: MobileNewsItem) {
  const initial = article.thumbnail?.url ?? null;
  const [state, setState] = useState<{ path: string | null; pending: boolean }>(() => ({ path: initial, pending: !initial }));
  useEffect(() => {
    if (!state.pending) return;
    let active = true;
    const controller = new AbortController();
    fetch(`${mobileApiOrigin}/api/news/thumbnail/resolve?url=${encodeURIComponent(article.url)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { thumbnail: string | null } | null) => { if (active) setState({ path: body?.thumbnail ?? null, pending: false }); })
      .catch(() => { if (active) setState({ path: null, pending: false }); });
    return () => { active = false; controller.abort(); };
  }, [article.url, state.pending]);
  return state;
}

function NewsRow({ article, onOpenError }: { article: MobileNewsItem; onOpenError: () => void }) {
  const { fonts, theme } = useMinionTheme();
  const { path, pending } = useResolvedThumbnail(article);
  const [errored, setErrored] = useState(false);
  const thumbnail = resolveApiAssetUrl(path);
  const showThumbnail = !errored && (pending || Boolean(thumbnail));
  const open = async () => {
    try { await Linking.openURL(article.url); } catch { onOpenError(); }
  };
  return (
    <Pressable accessibilityLabel={`${article.title} ${article.source} ${formatNewsDate(article.publishedAt)}`} accessibilityRole="link" onPress={() => void open()} style={styles.newsRow}>
      {showThumbnail ? <View style={[styles.thumbnail, { backgroundColor: theme.card }]}>{thumbnail ? <Image contentFit="cover" onError={() => setErrored(true)} source={{ uri: thumbnail }} style={StyleSheet.absoluteFill} transition={120} /> : null}</View> : null}
      <View style={styles.newsCopy}>
        <Text accessibilityRole="header" aria-level={3} numberOfLines={2} style={[styles.newsTitle, { color: theme.ink, ...fonts.display }]}>{article.title}</Text>
        <View style={styles.newsMeta}><Text numberOfLines={1} style={[styles.newsSource, { color: theme.muted, ...fonts.medium }]}>{article.source}</Text><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>·</Text><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{formatNewsDate(article.publishedAt)}</Text></View>
      </View>
    </Pressable>
  );
}

function Pagination({ onChange, page, totalPages }: { onChange: (page: number) => void; page: number; totalPages: number }) {
  const { fonts, theme } = useMinionTheme();
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = useMemo(() => Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index), [start, totalPages]);
  return <View accessibilityLabel="페이지 이동" style={styles.pagination}><Pressable accessibilityRole="link" accessibilityState={{ disabled: page === 1 }} disabled={page === 1} onPress={() => onChange(page - 1)} style={[styles.sidePage, page === 1 && styles.disabled]}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 14 }}>이전</Text></Pressable>{pages.map((number) => { const active = number === page; return <Pressable accessibilityRole="link" accessibilityState={{ selected: active }} aria-current={active ? 'page' : undefined} key={number} onPress={() => onChange(number)} style={[styles.pageButton, active && { backgroundColor: theme.ink }]}><Text style={{ color: active ? theme.surface : theme.muted, ...fonts.medium, fontSize: 14 }}>{number}</Text></Pressable>; })}<Pressable accessibilityRole="link" accessibilityState={{ disabled: page === totalPages }} disabled={page === totalPages} onPress={() => onChange(page + 1)} style={[styles.sidePage, page === totalPages && styles.disabled]}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 14 }}>다음</Text></Pressable></View>;
}

function NewsEmpty() {
  const { fonts, theme } = useMinionTheme();
  return <View style={[styles.empty, { backgroundColor: theme.card }]}><Search color={theme.muted} size={28} /><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 16, lineHeight: 24, marginTop: 12 }}>조건에 맞는 뉴스가 없어요.</Text><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 16, lineHeight: 24, marginTop: 4 }}>다른 팀이나 검색어로 다시 찾아보세요.</Text></View>;
}

function NewsLoadingSkeleton() {
  const { theme } = useMinionTheme();
  const block = { backgroundColor: theme.surfaceMuted };
  return <View accessibilityLabel="뉴스를 불러오는 중"><View style={[styles.filter, { backgroundColor: theme.card }]}><View style={styles.toolbar}><View style={[styles.skeletonFilter, block]} /><View style={styles.searchRow}><View style={[styles.skeletonInput, block]} /><View style={[styles.skeletonSearch, block]} /></View></View></View><View style={styles.skeletonHeadingRow}><View style={[styles.skeletonHeading, block]} /><View style={[styles.skeletonCount, block]} /></View>{Array.from({ length: 7 }, (_, index) => <View key={index} style={[styles.skeletonNews, index < 6 ? { borderBottomColor: theme.divider, borderBottomWidth: 1 } : null]}><View style={[styles.skeletonThumb, block]} /><View style={styles.skeletonCopy}><View style={[styles.skeletonLine, block]} /><View style={[styles.skeletonLineShort, block]} /><View style={[styles.skeletonMeta, block]} /></View></View>)}</View>;
}

function formatNewsDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { day: 'numeric', hour: '2-digit', hour12: false, minute: '2-digit', month: 'long', timeZone: 'Asia/Seoul' }).format(new Date(value));
}

const styles = StyleSheet.create({
  allTeamsIcon: { alignItems: 'center', borderRadius: 14, height: 28, justifyContent: 'center', width: 28 },
  clearButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 32, justifyContent: 'center', width: 32 },
  disabled: { opacity: 0.3 },
  empty: { alignItems: 'center', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 48 },
  filter: { borderRadius: 8, marginBottom: 16, padding: 6 },
  filterOption: { alignItems: 'center', borderRadius: 10, flexDirection: 'row', gap: 10, minHeight: 48, paddingHorizontal: 10, paddingVertical: 6 },
  filterOptionCopy: { flex: 1, minWidth: 0 },
  filterOptions: { gap: 2, paddingBottom: 4 },
  filterTrigger: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 6, height: 32, justifyContent: 'space-between', minWidth: 104, paddingHorizontal: 8 },
  filterTriggerIdentity: { alignItems: 'center', flexDirection: 'row', gap: 8, minWidth: 0 },
  firstNewsItem: { paddingTop: 0 },
  footnote: { fontSize: 13, lineHeight: 20, marginTop: 24 },
  lastNewsItem: { paddingBottom: 0 },
  latestIdentity: { alignItems: 'baseline', flexDirection: 'row', gap: 8 },
  latestRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  latestTitle: { fontSize: 16, lineHeight: 21.6 },
  newsCopy: { flex: 1, minWidth: 0 },
  newsItem: { paddingVertical: 12 },
  newsMeta: { alignItems: 'center', flexDirection: 'row', gap: 6, paddingTop: 4 },
  newsRow: { alignItems: 'center', flexDirection: 'row', gap: 12, minWidth: 0 },
  newsSource: { flexShrink: 1, fontSize: 13, lineHeight: 19.5 },
  newsTitle: { fontSize: 14, letterSpacing: -0.28, lineHeight: 20.3 },
  pageButton: { alignItems: 'center', borderRadius: 8, height: 40, justifyContent: 'center', minWidth: 40, paddingHorizontal: 8 },
  pagination: { alignItems: 'center', flexDirection: 'row', gap: 4, justifyContent: 'center', marginTop: 24 },
  reset: { alignItems: 'center', minHeight: 40, justifyContent: 'center' },
  screen: { gap: 0, marginTop: 20, paddingBottom: 64 },
  searchButton: { alignItems: 'center', borderRadius: 8, height: 32, justifyContent: 'center', paddingHorizontal: 12 },
  searchIcon: { left: 12, position: 'absolute', top: 8, zIndex: 1 },
  searchInput: { borderRadius: 8, borderWidth: 1, fontSize: 13, height: 32, lineHeight: 19.5, paddingBottom: 0, paddingLeft: 36, paddingRight: 12, paddingTop: 0 },
  searchInputWrap: { flex: 1, minWidth: 0, position: 'relative' },
  searchRow: { flex: 1, flexDirection: 'row', gap: 6, minWidth: 0 },
  sidePage: { alignItems: 'center', height: 40, justifyContent: 'center', paddingHorizontal: 8 },
  skeletonCopy: { flex: 1, gap: 7, justifyContent: 'center' },
  skeletonCount: { borderRadius: 5, height: 13, width: 48 },
  skeletonFilter: { borderRadius: 8, height: 32, width: 104 },
  skeletonHeading: { borderRadius: 6, height: 22, width: 80 },
  skeletonHeadingRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 4 },
  skeletonInput: { borderRadius: 8, flex: 1, height: 32 },
  skeletonLine: { borderRadius: 5, height: 13, width: '94%' },
  skeletonLineShort: { borderRadius: 5, height: 13, width: '74%' },
  skeletonMeta: { borderRadius: 5, height: 12, width: '48%' },
  skeletonNews: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  skeletonSearch: { borderRadius: 8, height: 32, width: 54 },
  skeletonThumb: { borderRadius: 8, height: 58.5, width: 104 },
  thumbnail: { borderRadius: 8, height: 58.5, overflow: 'hidden', width: 104 },
  toolbar: { flexDirection: 'row', gap: 6, minWidth: 0 },
});
