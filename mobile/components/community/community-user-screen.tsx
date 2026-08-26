import { useLocalSearchParams, useRouter } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Eye from 'lucide-react-native/icons/eye';
import FileText from 'lucide-react-native/icons/file-text';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import MessageSquareText from 'lucide-react-native/icons/message-square-text';
import ThumbsUp from 'lucide-react-native/icons/thumbs-up';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorState } from '@/components/feedback-states';
import { KitschEmptyState } from '@/components/kitsch-empty-state';
import { MinionScreen } from '@/components/minion-screen';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileCommunityUserActivityPost, MobileCommunityUserDto } from '@/lib/api-client';
import { CommunityAuthor } from './community-author';
import { boardLabel, formatCommunityDate } from './community-utils';

const TIER_LABELS: Record<string, string> = { iron: '아이언', bronze: '브론즈', silver: '실버', gold: '골드', platinum: '플래티넘', emerald: '에메랄드', diamond: '다이아', master: '마스터', grandmaster: '그랜드마스터', challenger: '챌린저' };

export function CommunityUserScreen() {
  const { page: pageParam, tab: tabParam, userId } = useLocalSearchParams<{ page?: string; tab?: string; userId: string }>();
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  const tab = tabParam === 'comments' ? 'comments' : 'posts';
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const path = useMemo(() => `/api/mobile/v1/community/users/${encodeURIComponent(userId ?? '')}?tab=${tab}&page=${page}`, [page, tab, userId]);
  const { data, error, loading, refresh } = useCachedQuery<MobileCommunityUserDto>(path, { cache: false, enabled: Boolean(userId) });
  const navigate = (nextTab: 'posts' | 'comments', nextPage = 1) => router.replace(`/community/user/${userId}?tab=${nextTab}&page=${nextPage}` as never);
  const openPost = (post: MobileCommunityUserActivityPost) => router.push(`/community/post/${post.id}` as never);

  return (
    <View style={[styles.root, { backgroundColor: theme.pageBackground }]}>
      <MinionScreen contentStyle={styles.content}>
        <Text style={[styles.pageTitle, { color: theme.ink, ...fonts.display }]}>사용자 활동</Text>
        {loading && !data ? <UserActivitySkeleton /> : error && !data ? <ErrorState onRetry={refresh} title={error} /> : data ? <>
          <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.eyebrow, { color: theme.muted, ...fonts.medium }]}>COMMUNITY PROFILE</Text>
            <CommunityAuthor author={data.profile} onBlocked={() => router.replace('/community' as never)} variant="profile" />
            <View style={styles.profileMeta}><Text style={[styles.tier, { backgroundColor: theme.surfaceMuted, color: theme.text, ...fonts.medium }]}>{TIER_LABELS[data.profile.tier ?? 'bronze'] ?? '브론즈'}</Text><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>{new Date(data.profile.createdAt).toLocaleDateString('ko-KR')} 가입</Text></View>
            <View style={[styles.stats, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}><ProfileStat label="작성글" value={data.postCount} /><View style={[styles.statDivider, { backgroundColor: theme.border }]} /><ProfileStat label="작성 댓글" value={data.commentCount} /></View>
          </View>

          <View style={[styles.activityCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View accessibilityLabel="사용자 활동" accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: theme.surfaceMuted }]}>
              <ActivityTab active={tab === 'posts'} count={data.postCount} icon={<FileText color={tab === 'posts' ? theme.ink : theme.muted} size={16} />} label="작성글" onPress={() => navigate('posts')} />
              <ActivityTab active={tab === 'comments'} count={data.commentCount} icon={<MessageSquareText color={tab === 'comments' ? theme.ink : theme.muted} size={16} />} label="작성 댓글" onPress={() => navigate('comments')} />
            </View>
            <View style={[styles.activityHeading, { borderBottomColor: theme.border }]}><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 18 }}>{tab === 'posts' ? '작성글' : '작성 댓글'}</Text><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>최신순</Text></View>
            {tab === 'posts' ? data.posts.length ? <View>{data.posts.map((post) => <Pressable accessibilityRole="link" key={post.id} onPress={() => openPost(post)} style={[styles.activityRow, { borderBottomColor: theme.border }]}><View style={styles.postTitleRow}><Text style={{ color: theme.accent, ...fonts.medium, fontSize: 13 }}>{boardLabel(post.boardType)}</Text><Text numberOfLines={1} style={{ color: post.isBlinded ? theme.muted : theme.ink, flex: 1, ...fonts.bold, fontSize: 15 }}>{post.isBlinded ? '블라인드된 게시글입니다.' : post.title}</Text></View><View style={styles.postMeta}><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13 }}>{formatCommunityDate(post.createdAt)}</Text><Meta icon={<Eye color={theme.muted} size={13} />} value={post.viewCount} /><Meta icon={<MessageCircle color={theme.muted} size={13} />} value={post.commentCount} /><Meta icon={<ThumbsUp color={theme.muted} size={13} />} value={post.likeCount} /></View></Pressable>)}</View> : <EmptyActivity title="공개된 작성글이 없습니다" /> : data.comments.length ? <View>{data.comments.map((comment) => <Pressable accessibilityRole="link" key={comment.id} onPress={() => router.push(`/community/post/${comment.postId}` as never)} style={[styles.activityRow, { borderBottomColor: theme.border }]}><Text numberOfLines={1} style={{ color: theme.accent, ...fonts.medium, fontSize: 13 }}>{comment.postTitle}</Text><Text numberOfLines={2} style={{ color: comment.isBlinded ? theme.muted : theme.text, ...fonts.regular, fontSize: 16, lineHeight: 24, marginTop: 6 }}>{comment.isBlinded ? '블라인드된 댓글입니다.' : comment.content}</Text><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, marginTop: 8 }}>{formatCommunityDate(comment.createdAt)}</Text></Pressable>)}</View> : <EmptyActivity title="공개된 작성 댓글이 없습니다" />}
            {data.totalPages > 1 ? <View style={styles.pagination}><Pressable accessibilityLabel="이전 페이지" disabled={data.page <= 1} onPress={() => navigate(tab, data.page - 1)} style={styles.pageButton}><ChevronLeft color={data.page <= 1 ? theme.border : theme.text} size={18} /></Pressable><Text style={{ color: theme.text, ...fonts.medium, fontSize: 13 }}>{data.page} / {data.totalPages}</Text><Pressable accessibilityLabel="다음 페이지" disabled={data.page >= data.totalPages} onPress={() => navigate(tab, data.page + 1)} style={styles.pageButton}><ChevronRight color={data.page >= data.totalPages ? theme.border : theme.text} size={18} /></Pressable></View> : null}
          </View>
        </> : null}
      </MinionScreen>
    </View>
  );
}

function ProfileStat({ label, value }: { label: string; value: number }) { const { fonts, theme } = useMinionTheme(); return <View style={styles.stat}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>{label}</Text><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 20, marginTop: 2 }}>{value}</Text></View>; }
function ActivityTab({ active, count, icon, label, onPress }: { active: boolean; count: number; icon: React.ReactNode; label: string; onPress: () => void }) { const { fonts, theme } = useMinionTheme(); return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.tab, active ? { backgroundColor: theme.surface } : null]}>{icon}<Text style={{ color: active ? theme.ink : theme.muted, ...fonts.medium, fontSize: 14 }}>{label}</Text><Text style={{ color: active ? theme.text : theme.muted, ...fonts.regular, fontSize: 13 }}>{count}</Text></Pressable>; }
function Meta({ icon, value }: { icon: React.ReactNode; value: number }) { const { fonts, theme } = useMinionTheme(); return <View style={styles.metaItem}>{icon}<Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13 }}>{value}</Text></View>; }
function EmptyActivity({ title }: { title: string }) { return <KitschEmptyState character="marker" compact plain title={title} />; }
function UserActivitySkeleton() { const { theme } = useMinionTheme(); return <View style={styles.skeleton}><View style={[styles.skeletonProfile, { backgroundColor: theme.surfaceMuted }]} /><View style={[styles.skeletonList, { backgroundColor: theme.surfaceMuted }]} /></View>; }

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 20, paddingBottom: 28, paddingTop: 24 },
  pageTitle: { fontSize: 28, lineHeight: 36, paddingHorizontal: 16 },
  profileCard: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 20 },
  eyebrow: { fontSize: 13, letterSpacing: 2.08, marginBottom: 12 },
  profileMeta: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 16 },
  tier: { borderRadius: 999, fontSize: 13, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 6 },
  stats: { borderRadius: 12, borderWidth: 1, flexDirection: 'row', marginTop: 20, overflow: 'hidden' },
  stat: { alignItems: 'center', flex: 1, paddingHorizontal: 16, paddingVertical: 14 },
  statDivider: { width: 1 },
  activityCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  tabs: { flexDirection: 'row', gap: 4, padding: 6 },
  tab: { alignItems: 'center', borderRadius: 8, flex: 1, flexDirection: 'row', gap: 8, height: 44, justifyContent: 'center', paddingHorizontal: 8 },
  activityHeading: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  activityRow: { borderBottomWidth: 1, paddingHorizontal: 16, paddingVertical: 16 },
  postTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  postMeta: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 8 },
  metaItem: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  pagination: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', padding: 10 },
  pageButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 48 },
  skeleton: { gap: 20 },
  skeletonProfile: { borderRadius: 14, height: 314 },
  skeletonList: { borderRadius: 14, height: 420 },
});
