import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Megaphone from 'lucide-react-native/icons/megaphone';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Search from 'lucide-react-native/icons/search';
import SquarePen from 'lucide-react-native/icons/square-pen';
import ThumbsUp from 'lucide-react-native/icons/thumbs-up';
import X from 'lucide-react-native/icons/x';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/bottom-sheet';
import { SHOW_MOBILE_AD_SLOTS } from '@/constants/mobile-ads';
import { getMinionTeam } from '@/constants/teams';
import { ErrorState } from '@/components/feedback-states';
import { KitschEmptyState } from '@/components/kitsch-empty-state';
import { MinionScreen } from '@/components/minion-screen';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileCommunityPostSummary, MobileCommunityPostsDto } from '@/lib/api-client';
import { resolveApiAssetUrl } from '@/lib/api-client';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { CommunityDirectoryNav } from './community-directory-nav';
import { boardLabel, boardsForScope, displayAuthor, formatCommunityDate, type CommunityScope } from './community-utils';

export function CommunityFeedScreen({ scope = 'hub' }: { scope?: CommunityScope }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ team?: string | string[] }>();
  const teamSlug = Array.isArray(params.team) ? params.team[0] : params.team;
  const insets = useSafeAreaInsets();
  const { fonts, theme } = useMinionTheme();
  const team = scope === 'team' ? getMinionTeam(teamSlug) : null;
  const accent = team?.primaryColor ?? theme.accent;
  const basePath = teamSlug && scope === 'team' ? `/fan/${teamSlug}/community` : '/community';
  const boards = boardsForScope(scope);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'all' | 'hot'>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (view === 'hot') params.set('view', 'hot');
    if (category) params.set('cat', category);
    if (committedQuery) params.set('q', committedQuery);
    if (scope === 'team' && teamSlug) params.set('team', teamSlug);
    const suffix = params.toString();
    return `/api/mobile/v1/community/posts${suffix ? `?${suffix}` : ''}`;
  }, [category, committedQuery, page, scope, teamSlug, view]);
  const { data, error, loading, refresh, refreshing } = useCachedQuery<MobileCommunityPostsDto>(path);

  const updateView = (next: 'all' | 'hot') => {
    setView(next);
    setPage(1);
  };
  const selectCategory = (next: string | null) => {
    setCategory(next);
    setPage(1);
    setCategoryOpen(false);
  };
  const submitSearch = () => {
    setCommittedQuery(query.trim());
    setPage(1);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.pageBackground }]}>
      <MinionScreen contentStyle={styles.fullBleed}>
        {SHOW_MOBILE_AD_SLOTS ? <View style={[styles.ad, { backgroundColor: theme.adSurface }]}>
          <Text style={[styles.adText, { color: theme.muted, ...fonts.medium }]}>ADVERTISEMENT</Text>
        </View> : null}
        <CommunityDirectoryNav accent={accent} scope={scope} teamSlug={teamSlug} />
        <View style={[styles.feed, { backgroundColor: theme.surface, borderBottomColor: theme.border, borderTopColor: theme.border }]}>
          <View style={[styles.toolbar, { borderBottomColor: theme.divider }]}>
            <View style={styles.toolbarRow}>
              <View accessibilityLabel="게시글 보기" accessibilityRole="tablist" style={[styles.segment, { backgroundColor: theme.surfaceMuted }]}>
                {(['all', 'hot'] as const).map((item) => {
                  const active = view === item;
                  return (
                    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} key={item} onPress={() => updateView(item)} style={[styles.segmentButton, active ? { backgroundColor: theme.surface } : null]}>
                      <Text style={{ color: active ? theme.ink : theme.muted, ...fonts.bold, fontSize: 13 }}>{item === 'all' ? '전체' : '인기글'}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable accessibilityLabel="말머리 선택" onPress={() => setCategoryOpen(true)} style={[styles.categoryButton, { borderColor: theme.border }]}>
                <Text style={{ color: theme.text, ...fonts.medium, fontSize: 13 }}>{category ? boardLabel(category) : '말머리'}</Text>
                <ChevronDown color={theme.muted} size={14} />
              </Pressable>
              <Pressable accessibilityLabel={searchOpen ? '검색 닫기' : '게시글 검색'} onPress={() => setSearchOpen((open) => !open)} style={[styles.searchToggle, { borderColor: theme.border }]}>
                {searchOpen ? <X color={theme.muted} size={17} /> : <Search color={theme.muted} size={17} />}
              </Pressable>
            </View>
            {searchOpen ? (
              <View style={styles.searchBlock}>
                <View style={[styles.searchInputWrap, { borderColor: theme.border }]}>
                  <TextInput
                    accessibilityLabel="게시글 검색"
                    maxLength={80}
                    onChangeText={setQuery}
                    onSubmitEditing={submitSearch}
                    placeholder="제목, 내용 검색"
                    placeholderTextColor={theme.muted}
                    returnKeyType="search"
                    style={[styles.searchInput, { color: theme.text, ...fonts.regular }]}
                    value={query}
                  />
                  <Pressable accessibilityLabel="검색" onPress={submitSearch} style={styles.searchSubmit}><Search color={theme.muted} size={16} /></Pressable>
                </View>
                {committedQuery ? (
                  <View style={styles.searchStatus}>
                    <Text numberOfLines={1} style={[styles.searchStatusText, { color: theme.muted, ...fonts.regular }]}>‘{committedQuery}’ 검색 결과 {(data?.totalCount ?? 0).toLocaleString('ko-KR')}개</Text>
                    <Pressable onPress={() => { setQuery(''); setCommittedQuery(''); setPage(1); }}><Text style={{ color: theme.text, ...fonts.bold, fontSize: 12, textDecorationLine: 'underline' }}>초기화</Text></Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}
            {refreshing ? <View style={styles.refreshLine}><ActivityIndicator color={accent} size="small" /></View> : null}
          </View>

          {loading && !data ? <CommunityFeedSkeleton /> : error && !data ? <ErrorState onRetry={refresh} title={error} /> : (
            <>
              <View accessibilityRole="list">
                {[...(data?.notices ?? []), ...(data?.items ?? [])].map((post, index, posts) => <PostRow accent={accent} key={`${post.isNotice ? 'notice' : 'post'}:${post.id}`} last={index === posts.length - 1} onPress={() => router.push(`${basePath}/post/${post.id}` as never)} post={post} scope={scope} />)}
                {(data?.items.length ?? 0) === 0 && (data?.notices.length ?? 0) === 0 ? (
                  <KitschEmptyState
                    animated
                    body="필터를 바꾸거나 첫 글을 톡 올려보세요."
                    plain
                    title="이 말머리엔 아직 조용해요"
                  />
                ) : null}
              </View>
              <View style={[styles.pagination, { borderTopColor: theme.divider }]}>
                <Pressable accessibilityLabel="이전 페이지" disabled={!data || data.page <= 1} onPress={() => setPage((value) => Math.max(1, value - 1))} style={styles.pageButton}><ChevronLeft color={!data || data.page <= 1 ? theme.border : theme.text} size={18} /></Pressable>
                <Text style={{ color: theme.text, ...fonts.bold, fontSize: 13 }}>{data?.page ?? 1}</Text>
                <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13 }}>/ {data?.totalPages ?? 1}</Text>
                <Pressable accessibilityLabel="다음 페이지" disabled={!data || data.page >= data.totalPages} onPress={() => setPage((value) => value + 1)} style={styles.pageButton}><ChevronRight color={!data || data.page >= data.totalPages ? theme.border : theme.text} size={18} /></Pressable>
              </View>
            </>
          )}
        </View>
      </MinionScreen>
      <Pressable accessibilityLabel="글쓰기" onPress={() => router.push(`${basePath}/new` as never)} style={[styles.compose, { backgroundColor: theme.ink, bottom: Math.max(insets.bottom, 6) + 68 }]}>
        <SquarePen color={theme.surface} size={20} strokeWidth={2} />
      </Pressable>

      <BottomSheet onClose={() => setCategoryOpen(false)} open={categoryOpen} title="말머리">
        <View style={styles.categoryList}>
          <CategoryOption active={!category} label="전체 말머리" onPress={() => selectCategory(null)} />
          {(data?.categories ?? boards).map((board) => <CategoryOption active={category === board.slug} key={board.slug} label={board.label} onPress={() => selectCategory(board.slug)} />)}
        </View>
      </BottomSheet>
    </View>
  );
}

function CategoryOption({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const { fonts, theme } = useMinionTheme();
  return <Pressable accessibilityRole="menuitem" onPress={onPress} style={[styles.categoryOption, active ? { backgroundColor: theme.surfaceMuted } : null]}><Text style={{ color: active ? theme.ink : theme.text, ...(active ? fonts.bold : fonts.medium), fontSize: 15 }}>{label}</Text></Pressable>;
}

function PostRow({ accent, last, post, onPress, scope }: { accent: string; last: boolean; post: MobileCommunityPostSummary; onPress: () => void; scope: CommunityScope }) {
  const { fonts, theme } = useMinionTheme();
  const title = post.isBlinded ? (post.blindedSource === 'ai' ? '정화봇이 숨긴 게시글입니다.' : '블라인드된 게시글입니다.') : post.title;
  return (
    <Pressable accessibilityLabel={`${title} 게시글 보기`} accessibilityRole="link" onPress={onPress} style={[styles.postRow, last ? styles.postRowLast : null, post.isNotice ? { backgroundColor: theme.surfaceMuted } : null, { borderBottomColor: theme.divider }]}>
      <View style={styles.postMain}>
        <View style={styles.titleRow}>
          {post.isNotice ? <View style={[styles.notice, { backgroundColor: theme.ink }]}><Megaphone color={theme.surface} size={10} /><Text style={{ color: theme.surface, ...fonts.medium, fontSize: 12, fontWeight: '500' }}>공지</Text></View> : <Text style={{ color: accent, ...fonts.medium, fontSize: 12, fontWeight: '500', lineHeight: 18 }}>{boardLabel(post.boardType, scope)}</Text>}
          {!post.isBlinded && post.isHot ? <View style={[styles.hot, { borderColor: accent }]}><Text style={{ color: accent, ...fonts.medium, fontSize: 12, fontWeight: '500' }}>인기</Text></View> : null}
          {post.isBlinded ? post.blindedSource === 'ai' ? <Image contentFit="contain" source={require('@/assets/characters/pen-warning-blocked-red.png')} style={styles.blindedCharacter} /> : <EyeOff color={theme.muted} size={13} /> : null}
          <Text numberOfLines={1} style={[styles.postTitle, { color: post.isBlinded ? theme.muted : theme.ink, ...fonts.medium }]}>{title}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text numberOfLines={1} style={[styles.author, { color: theme.text, ...fonts.medium }]}>{displayAuthor(post.author)}</Text>
          <Text style={[styles.meta, { color: theme.muted, ...fonts.regular }]}>{formatCommunityDate(post.createdAt)}</Text>
          <View style={styles.metaStat}><MessageCircle color={theme.muted} size={11} strokeWidth={1.8} /><Text style={[styles.meta, { color: theme.muted, ...fonts.regular }]}>{post.commentCount}</Text></View>
          <View style={styles.metaStat}><ThumbsUp color={theme.muted} size={11} strokeWidth={1.8} /><Text style={[styles.meta, { color: theme.muted, ...fonts.regular }]}>{post.likeCount}</Text></View>
        </View>
      </View>
      {!post.isBlinded && post.thumbnail?.url ? <Image contentFit="cover" source={{ uri: resolveApiAssetUrl(post.thumbnail.url) ?? post.thumbnail.url }} style={[styles.thumbnail, { backgroundColor: theme.surfaceMuted }]} transition={150} /> : null}
    </Pressable>
  );
}

function CommunityFeedSkeleton() {
  const { theme } = useMinionTheme();
  return <View>{Array.from({ length: 8 }, (_, index) => <View key={index} style={[styles.skeletonRow, { borderBottomColor: theme.divider }]}><View style={styles.skeletonText}><View style={[styles.skeletonLine, { backgroundColor: theme.surfaceMuted, width: `${58 + (index % 3) * 11}%` }]} /><View style={[styles.skeletonLineSmall, { backgroundColor: theme.surfaceMuted }]} /></View>{index % 3 === 0 ? <View style={[styles.thumbnail, { backgroundColor: theme.surfaceMuted }]} /> : null}</View>)}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fullBleed: { gap: 0, marginHorizontal: -16, marginTop: 0 },
  ad: { alignItems: 'center', height: 60, justifyContent: 'center' },
  adText: { fontSize: 11, letterSpacing: 2.2, lineHeight: 16.5 },
  blindedCharacter: { height: 18, width: 18 },
  feed: { borderBottomWidth: 1, borderTopWidth: 1, width: '100%' },
  toolbar: { borderBottomWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  toolbarRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  segment: { borderRadius: 8, flexDirection: 'row', height: 36, padding: 4 },
  segmentButton: { alignItems: 'center', borderRadius: 4, height: 28, justifyContent: 'center', paddingHorizontal: 12 },
  categoryButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 12, height: 36, justifyContent: 'space-between', paddingLeft: 12, paddingRight: 10, width: 112 },
  searchToggle: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 36, justifyContent: 'center', marginLeft: 'auto', width: 36 },
  searchBlock: { marginTop: 8 },
  searchInputWrap: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', height: 36 },
  searchInput: { flex: 1, fontSize: 14, height: 36, paddingHorizontal: 12, paddingVertical: 0 },
  searchSubmit: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  searchStatus: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 8 },
  searchStatusText: { flex: 1, fontSize: 12 },
  refreshLine: { height: 0, left: 0, position: 'absolute', right: 0, top: 2 },
  postRow: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', gap: 12, minHeight: 66, paddingHorizontal: 12, paddingVertical: 8 },
  postRowLast: { borderBottomWidth: 0, minHeight: 65 },
  postMain: { flex: 1, minWidth: 0 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 6, minWidth: 0 },
  postTitle: { flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 21 },
  notice: { alignItems: 'center', borderRadius: 999, flexDirection: 'row', gap: 4, paddingHorizontal: 7, paddingVertical: 3 },
  hot: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 2, overflow: 'hidden' },
  metaStat: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  author: { flexShrink: 1, fontSize: 12, fontWeight: '500', lineHeight: 18, maxWidth: 124 },
  meta: { fontSize: 12, lineHeight: 18 },
  thumbnail: { borderRadius: 8, height: 57, width: 76 },
  pagination: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', gap: 6, height: 57, justifyContent: 'center' },
  pageButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  compose: { alignItems: 'center', borderRadius: 24, height: 48, justifyContent: 'center', position: 'absolute', right: 16, width: 48, zIndex: 80 },
  categoryList: { gap: 2, paddingBottom: 8 },
  categoryOption: { borderRadius: 10, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  skeletonRow: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', gap: 12, height: 65, paddingHorizontal: 12 },
  skeletonText: { flex: 1, gap: 8 },
  skeletonLine: { borderRadius: 4, height: 14 },
  skeletonLineSmall: { borderRadius: 4, height: 11, width: '44%' },
});
