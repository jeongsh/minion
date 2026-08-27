import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import Flag from 'lucide-react-native/icons/flag';
import SendHorizontal from 'lucide-react-native/icons/send-horizontal';
import Smile from 'lucide-react-native/icons/face-slightly-smiling';
import ThumbsDown from 'lucide-react-native/icons/thumbs-down';
import ThumbsUp from 'lucide-react-native/icons/thumbs-up';
import X from 'lucide-react-native/icons/x';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextStyle, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/bottom-sheet';
import { KeyboardAwareView } from '@/components/keyboard-aware-view';
import { getMinionTeam } from '@/constants/teams';
import { ErrorState } from '@/components/feedback-states';
import { RankAvatar } from '@/components/rank-avatar';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileCommunityActionDto, MobileCommunityAuthor, MobileCommunityComment, MobileCommunityCommentMutationDto, MobileCommunityPostDetailDto, MobileCommunityReactionDto } from '@/lib/api-client';
import { mutateMobileApi } from '@/lib/api-client';
import { fanAccentText } from '@/lib/fan-colors';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useAuth } from '@/providers/auth-provider';
import { CommunityPostContent } from './community-post-content';
import { CommunityAuthor, GuestAvatar } from './community-author';
import { COMMENT_MAX_LENGTH, displayAuthor, formatCommunityDate, type CommunityScope } from './community-utils';

const EMOJIS = ['😀', '😂', '😍', '😮', '😢', '😡', '👍', '👏', '🔥', '🎉'];

export function CommunityPostScreen({ scope = 'hub' }: { scope?: CommunityScope }) {
  const params = useLocalSearchParams<{ postId: string; team?: string | string[] }>();
  const { postId } = params;
  const teamSlug = Array.isArray(params.team) ? params.team[0] : params.team;
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { fonts, showToast, theme } = useMinionTheme();
  const team = scope === 'team' ? getMinionTeam(teamSlug) : null;
  const accent = team ? fanAccentText(team.primaryColor) : theme.accent;
  const basePath = teamSlug && scope === 'team' ? `/fan/${teamSlug}/community` : '/community';
  const path = `/api/mobile/v1/community/posts/${encodeURIComponent(postId ?? '')}${teamSlug && scope === 'team' ? `?team=${encodeURIComponent(teamSlug)}` : ''}`;
  const { data, error, loading, refresh } = useCachedQuery<MobileCommunityPostDetailDto>(path, { cache: false, enabled: Boolean(postId) });
  const scrollRef = useRef<ScrollView>(null);
  const [comment, setComment] = useState('');
  const [replyTo, setReplyTo] = useState<MobileCommunityComment | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(() => new Set());

  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace(basePath as never);
      return true;
    });
    return () => subscription.remove();
  }, [basePath, router]));

  useEffect(() => {
    setComment('');
    setReplyTo(null);
    setEmojiOpen(false);
    setOwnerMenuOpen(false);
    setRevealed(false);
    setExpandedReplies(new Set());
    scrollRef.current?.scrollTo({ animated: false, y: 0 });
  }, [postId]);
  const roots = useMemo(() => data?.comments.filter((item) => !item.parentId) ?? [], [data?.comments]);
  const replies = useMemo(() => {
    const map = new Map<string, MobileCommunityComment[]>();
    data?.comments.filter((item) => item.parentId).forEach((item) => map.set(item.parentId!, [...(map.get(item.parentId!) ?? []), item]));
    return map;
  }, [data?.comments]);
  const toggleReplies = (commentId: string) => {
    setExpandedReplies((current) => {
      const next = new Set(current);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const requireLogin = () => {
    if (session) return true;
    router.push(`/login?next=${encodeURIComponent(pathname)}` as never);
    return false;
  };
  const react = async (target: 'post' | 'comment', targetId: string, kind: 'honor' | 'dislike') => {
    if (!requireLogin()) return;
    try {
      await mutateMobileApi<MobileCommunityReactionDto>('/api/mobile/v1/community/reactions', 'POST', { kind, target, targetId });
      refresh();
    } catch (caught) { Alert.alert('반응 실패', caught instanceof Error ? caught.message : '잠시 후 다시 시도해주세요.'); }
  };
  const report = async (target: 'post' | 'comment', targetId: string) => {
    if (!requireLogin()) return;
    try {
      const result = await mutateMobileApi<MobileCommunityActionDto>('/api/mobile/v1/community/reports', 'POST', { scope: data?.scope ?? 'hub', target, targetId });
      showToast(result.message, 'success');
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : '잠시 후 다시 시도해주세요.', 'error');
    }
  };
  const submitComment = async () => {
    const content = comment.trim();
    if (!content || submitting || !data) return;
    setSubmitting(true);
    try {
      await mutateMobileApi<MobileCommunityCommentMutationDto>('/api/mobile/v1/community/comments', 'POST', { content, parentId: replyTo?.id ?? null, postId: data.id });
      setComment(''); setReplyTo(null); setEmojiOpen(false); refresh();
    } catch (caught) { Alert.alert('등록 실패', caught instanceof Error ? caught.message : '댓글을 등록하지 못했습니다.'); }
    finally { setSubmitting(false); }
  };
  const deletePost = () => Alert.alert('게시글 삭제', '이 게시글을 삭제할까요?', [
    { style: 'cancel', text: '취소' },
    { style: 'destructive', text: '삭제', onPress: () => void mutateMobileApi<MobileCommunityActionDto>(path, 'DELETE').then(() => router.replace(basePath as never)).catch((caught) => Alert.alert('삭제 실패', caught instanceof Error ? caught.message : '게시글을 삭제하지 못했습니다.')) },
  ]);

  if (loading && !data) return <CommunityPostLoadingState headerTitle={team?.shortName ?? 'LCK'} onClose={() => router.replace(basePath as never)} />;
  if (error && !data) return <FocusState><ErrorState onRetry={refresh} title={error} /></FocusState>;
  if (!data) return <FocusState><ErrorState onRetry={refresh} /></FocusState>;

  const title = data.isBlinded ? (data.blindedSource === 'ai' ? '정화봇이 숨긴 게시글입니다.' : '블라인드된 게시글입니다.') : data.title;
  return (
    <KeyboardAwareView minimumBottomInset={8} style={[styles.root, { backgroundColor: theme.pageBackground }]}>
      {({ bottomInset }) => <>
        <View style={[styles.safeTop, { backgroundColor: theme.pageBackground, height: insets.top }]} />
        <View style={[styles.header, { borderBottomColor: theme.divider, marginTop: insets.top }]}>
          <Pressable accessibilityLabel="게시글 닫기" onPress={() => router.replace(basePath as never)} style={styles.headerButton}><X color={theme.text} size={22} strokeWidth={1.8} /></Pressable>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.ink, ...fonts.display }]}>{team?.shortName ?? 'LCK'}</Text>
          {data.permissions.canEdit || data.permissions.canDelete ? <Pressable accessibilityLabel="게시글 관리" onPress={() => setOwnerMenuOpen(true)} style={styles.headerButton}><Ellipsis color={theme.text} size={21} strokeWidth={2} /></Pressable> : <View style={styles.headerButton} />}
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 56 + bottomInset }} keyboardShouldPersistTaps="handled" ref={scrollRef} showsVerticalScrollIndicator={false}>
        <View style={[styles.ad, { backgroundColor: theme.adSurface }]}><Text style={[styles.adText, { color: theme.muted, ...fonts.medium }]}>ADVERTISEMENT</Text></View>
        <View style={[styles.article, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <View style={styles.postHeader}>
            <Text style={[styles.postTitle, { color: data.isBlinded ? theme.muted : theme.ink, ...(data.isBlinded ? fonts.medium : fonts.bold) }]}>{title}</Text>
            <View style={styles.authorRow}><CommunityAuthor author={data.author} evidence={{ target: 'post', targetId: data.id }} onBlocked={() => router.replace(basePath as never)} variant="detail" detailMeta={<View style={styles.detailMeta}><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13 }}>{formatCommunityDate(data.createdAt)}</Text><Text style={{ color: theme.muted, fontSize: 13 }}>·</Text><Eye color={theme.muted} size={13} /><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13 }}>{data.viewCount.toLocaleString('ko-KR')}</Text></View>} /></View>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          <View style={styles.body}>
            {data.isBlinded && !revealed ? <Pressable onPress={() => setRevealed(true)} style={[styles.blinded, { backgroundColor: theme.surfaceMuted }]}>{data.blindedSource === 'ai' ? <Image accessibilityLabel="" contentFit="contain" source={require('@/assets/characters/pen-warning-blocked-red.png')} style={styles.blindedCharacter} /> : <EyeOff color={theme.muted} size={28} strokeWidth={1.6} />}<Text style={{ color: theme.ink, ...fonts.bold, fontSize: 15 }}>{title}</Text><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 14 }}>내용을 보려면 눌러주세요.</Text></Pressable> : <CommunityPostContent document={data.content} />}
          </View>
          <View style={[styles.postActions, { borderColor: theme.divider }]}>
            <View style={styles.reactions}><ReactionButton accent={accent} active={data.reaction === 'honor'} count={data.likeCount} icon="honor" label="와드" onPress={() => void react('post', data.id, 'honor')} /><ReactionButton accent={accent} active={data.reaction === 'dislike'} count={data.dislikeCount} icon="dislike" label="비추천" onPress={() => void react('post', data.id, 'dislike')} /></View>
            <Pressable onPress={() => report('post', data.id)} style={[styles.report, { backgroundColor: theme.surface, borderColor: theme.border }]}><Flag color={theme.muted} size={15} strokeWidth={1.8} /><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>리폿</Text></Pressable>
          </View>
          <View style={styles.commentTitle}><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 15, lineHeight: 22.5 }}>댓글</Text><Text style={{ color: accent, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{data.commentCount}</Text></View>
          <View style={styles.comments}>{roots.map((item) => {
            const itemReplies = replies.get(item.id) ?? [];
            const repliesExpanded = expandedReplies.has(item.id);
            return (
              <View key={item.id} style={styles.commentThread}>
                <CommentItem accent={accent} comment={item} continued={itemReplies.length > 0} onDelete={refresh} onReact={react} onReply={setReplyTo} onReport={report} />
                {itemReplies.length > 0 && !repliesExpanded ? (
                  <View style={styles.threadToggleRow}>
                    <View style={[styles.threadConnection, { borderColor: theme.border }]} />
                    <Pressable accessibilityState={{ expanded: false }} onPress={() => toggleReplies(item.id)} style={styles.threadToggleButton}><Text style={{ color: theme.text, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>답글 {itemReplies.length}개</Text><ChevronDown color={theme.text} size={18} strokeWidth={2} /></Pressable>
                  </View>
                ) : null}
                {itemReplies.length > 0 && repliesExpanded ? (
                  <View>
                    {itemReplies.map((reply) => <View key={reply.id} style={styles.replyThreadRow}><View style={[styles.replyThreadStem, { backgroundColor: theme.border }]} /><View style={[styles.replyThreadElbow, { borderColor: theme.border }]} /><View style={styles.replyThreadContent}><CommentItem accent={accent} comment={reply} onDelete={refresh} onReact={react} onReport={report} reply /></View></View>)}
                    <View style={styles.threadToggleRow}>
                      <View style={[styles.threadConnection, { borderColor: theme.border }]} />
                      <Pressable accessibilityState={{ expanded: true }} onPress={() => toggleReplies(item.id)} style={styles.threadToggleButton}><Text style={{ color: theme.text, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>답글 숨기기</Text><ChevronUp color={theme.text} size={18} strokeWidth={2} /></Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}</View>
        </View>
        </ScrollView>
        <View style={[styles.commentDock, { backgroundColor: theme.pageBackground, borderTopColor: theme.divider, paddingBottom: bottomInset }]}>
        {replyTo ? <View style={styles.replying}><Text numberOfLines={1} style={{ color: theme.muted, flex: 1, ...fonts.medium, fontSize: 13 }}>{displayAuthor(replyTo.author)}님에게 답글</Text><Pressable onPress={() => setReplyTo(null)}><X color={theme.muted} size={16} /></Pressable></View> : null}
        {emojiOpen ? <View style={[styles.emojiBar, { backgroundColor: theme.surface }]}>{EMOJIS.map((emoji) => <Pressable key={emoji} onPress={() => setComment((value) => `${value}${emoji}`.slice(0, COMMENT_MAX_LENGTH))} style={styles.emoji}><Text style={styles.emojiText}>{emoji}</Text></Pressable>)}</View> : null}
        <View style={styles.commentComposer}>
          <View style={[styles.commentInputWrap, { backgroundColor: theme.surfaceMuted }]}><TextInput maxLength={COMMENT_MAX_LENGTH} multiline numberOfLines={1} onChangeText={setComment} placeholder="댓글을 입력해 주세요." placeholderTextColor={theme.muted} style={[styles.commentInput, { color: theme.text, ...fonts.regular }]} value={comment} /><Pressable accessibilityLabel="이모지 선택" onPress={() => setEmojiOpen((open) => !open)} style={styles.emojiButton}><Smile color={theme.muted} size={19} strokeWidth={1.7} /></Pressable></View>
          <Pressable accessibilityLabel={submitting ? '댓글 등록 중' : '댓글 등록'} disabled={!comment.trim() || submitting} onPress={() => void submitComment()} style={styles.send}>{submitting ? <ActivityIndicator color={accent} size="small" /> : <SendHorizontal color={comment.trim() ? accent : theme.muted} size={22} strokeWidth={2} />}</Pressable>
        </View>
        </View>
        <BottomSheet onClose={() => setOwnerMenuOpen(false)} open={ownerMenuOpen} title="게시글 관리">
          {data.permissions.canEdit ? <OwnerAction label="수정" onPress={() => { setOwnerMenuOpen(false); router.push(`${basePath}/post/${data.id}/edit` as never); }} /> : null}
          {data.permissions.canDelete ? <OwnerAction destructive label="삭제" onPress={() => { setOwnerMenuOpen(false); deletePost(); }} /> : null}
        </BottomSheet>
      </>}
    </KeyboardAwareView>
  );
}

function FocusState({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets(); const { theme } = useMinionTheme();
  return <View style={[styles.focusState, { backgroundColor: theme.pageBackground, paddingTop: insets.top }]}>{children}</View>;
}

function CommunityPostLoadingState({ headerTitle, onClose }: { headerTitle: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.pageBackground }]}>
      <View style={[styles.safeTop, { backgroundColor: theme.pageBackground, height: insets.top }]} />
      <View style={[styles.header, { borderBottomColor: theme.divider, marginTop: insets.top }]}>
        <Pressable accessibilityLabel="게시글 닫기" onPress={onClose} style={styles.headerButton}><X color={theme.text} size={22} strokeWidth={1.8} /></Pressable>
        <Text style={[styles.headerTitle, { color: theme.ink, ...fonts.display }]}>{headerTitle}</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 56 + (Platform.OS === 'web' ? 0 : insets.bottom) }} showsVerticalScrollIndicator={false}>
        <Bone height={60} radius={0} width="100%" />
        <View style={[styles.article, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <View style={styles.postHeader}>
            <Bone height={23} width="75%" />
            <View style={styles.loadingAuthor}><Bone height={36} radius={18} width={36} /><View style={styles.loadingAuthorCopy}><Bone height={13} width={112} /><View style={styles.loadingMeta}><Bone height={13} width={80} /><Bone height={13} width={48} /></View></View></View>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          <View style={styles.loadingBody}><Bone height={16} width="100%" /><Bone height={16} width="91.67%" /><Bone height={16} width="80%" /><Bone height={16} width="66.67%" /></View>
          <View style={[styles.postActions, { borderColor: theme.divider }]}><View style={styles.reactions}><Bone height={36} radius={8} width={82} /><Bone height={36} radius={8} width={88} /></View><Bone height={36} radius={8} width={67} /></View>
          <View style={styles.commentTitle}><Bone height={23} width={36} /><Bone height={20} width={16} /></View>
          <View style={styles.comments}>{Array.from({ length: 4 }, (_, index) => <View key={index} style={[styles.loadingComment, index > 0 ? { borderTopColor: theme.border, borderTopWidth: 1 } : null]}><View style={styles.loadingCommentTop}><Bone height={32} radius={16} width={32} /><Bone height={14} width={96} /><Bone height={13} width={56} /><View style={styles.loadingCommentReactions}><Bone height={14} width={48} /><Bone height={14} width={56} /></View></View><Bone height={15} width={index % 2 === 0 ? '80%' : '60%'} /><View style={styles.loadingLinks}><Bone height={13} width={48} /><Bone height={13} width={32} /></View></View>)}</View>
        </View>
      </ScrollView>
      <View style={[styles.commentDock, { backgroundColor: theme.pageBackground, borderTopColor: theme.divider, paddingBottom: Platform.OS === 'web' ? 8 : Math.max(insets.bottom, 8) }]}><View style={styles.commentComposer}><View style={{ flex: 1 }}><Bone height={40} radius={20} width="100%" /></View><Bone height={36} radius={18} width={36} /></View></View>
    </View>
  );
}

function Bone({ height, radius = 5, width }: { height: number; radius?: number; width: number | `${number}%` }) {
  const { theme } = useMinionTheme();
  return <View style={{ backgroundColor: theme.surfaceMuted, borderRadius: radius, flexShrink: 0, height, width }} />;
}

function ReactionButton({ accent, active, count, icon, label, onPress, small = false }: { accent?: string; active: boolean; count: number; icon: 'honor' | 'dislike'; label: string; onPress: () => void; small?: boolean }) {
  const { fonts, theme } = useMinionTheme(); const Icon = icon === 'honor' ? ThumbsUp : ThumbsDown;
  const activeColor = accent ?? theme.accent;
  return <Pressable accessibilityLabel={`${label} ${count}`} accessibilityState={{ selected: active }} onPress={onPress} style={[small ? styles.smallReaction : styles.reaction, small ? null : { borderColor: theme.border }]}><Icon color={active ? activeColor : small ? theme.muted : theme.text} size={16} strokeWidth={1.8} />{small ? <Text style={{ color: active ? activeColor : theme.muted, ...fonts.medium, fontSize: 12, lineHeight: 18 }}>{count}</Text> : <Text style={{ color: active ? activeColor : theme.text, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{label} {count}</Text>}</Pressable>;
}

function CommentAvatar({ author, reply }: { author: MobileCommunityAuthor; reply: boolean }) {
  const name = displayAuthor(author);
  return author.id ? <RankAvatar fallback={name} profileImageUrl={author.profileImage?.url} size={reply ? 'reply' : 'detail'} tier={author.tier} /> : <GuestAvatar size={reply ? 'reply' : 'detail'} />;
}

function CommentItem({ accent, comment, continued = false, onDelete, onReact, onReply, onReport, reply = false }: { accent: string; comment: MobileCommunityComment; continued?: boolean; onDelete: () => void; onReact: (target: 'comment', id: string, kind: 'honor' | 'dislike') => Promise<void>; onReply?: (comment: MobileCommunityComment) => void; onReport: (target: 'comment', id: string) => void; reply?: boolean }) {
  const { fonts, theme } = useMinionTheme(); const [editing, setEditing] = useState(false); const [content, setContent] = useState(typeof comment.content === 'string' ? comment.content : ''); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await mutateMobileApi<MobileCommunityCommentMutationDto>(`/api/mobile/v1/community/comments/${comment.id}`, 'PATCH', { content }); setEditing(false); onDelete(); } catch (caught) { Alert.alert('수정 실패', caught instanceof Error ? caught.message : '댓글을 수정하지 못했습니다.'); } finally { setBusy(false); } };
  const remove = () => Alert.alert('댓글 삭제', '이 댓글을 삭제할까요?', [{ text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: () => void mutateMobileApi<MobileCommunityActionDto>(`/api/mobile/v1/community/comments/${comment.id}`, 'DELETE').then(onDelete).catch((caught) => Alert.alert('삭제 실패', caught instanceof Error ? caught.message : '댓글을 삭제하지 못했습니다.')) }]);
  return (
    <View style={styles.commentItem}>
      {continued ? <View style={[styles.commentContinuation, { backgroundColor: theme.border }]} /> : null}
      <CommentAvatar author={comment.author} reply={reply} />
      <View style={styles.commentInner}>
        <View style={styles.commentTop}>
          <View style={styles.commentAuthor}><CommunityAuthor author={comment.author} evidence={{ target: 'comment', targetId: comment.id }} hideAvatar onBlocked={onDelete} /></View>
          <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 12, lineHeight: 18 }}>{formatCommunityDate(comment.createdAt)}</Text>
          <Pressable accessibilityLabel="리폿" onPress={() => onReport('comment', comment.id)} style={styles.commentMenu}><Ellipsis color={theme.muted} size={17} strokeWidth={1.8} /></Pressable>
        </View>
        {comment.isDeleted ? (
          <Text style={[styles.commentBody, { color: theme.muted, ...fonts.regular, fontSize: 14 }]}>삭제된 댓글입니다.</Text>
        ) : editing ? (
          <View style={[styles.editBox, { borderColor: theme.border }]}>
            <TextInput maxLength={COMMENT_MAX_LENGTH} multiline onChangeText={setContent} style={{ color: theme.text, ...fonts.regular, fontSize: 15, lineHeight: 24.75, minHeight: 72 }} value={content} />
            <View style={styles.editActions}><Pressable onPress={() => setEditing(false)}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>취소</Text></Pressable><Pressable disabled={!content.trim() || busy} onPress={() => void save()}><Text style={{ color: accent, ...fonts.medium, fontSize: 13 }}>{busy ? '저장 중' : '저장'}</Text></Pressable></View>
          </View>
        ) : comment.isBlinded ? (
          <View style={[styles.blindedComment, { backgroundColor: theme.surfaceMuted }]}>
            {comment.blindedSource === 'ai' ? <Image accessibilityLabel="" contentFit="contain" source={require('@/assets/characters/pen-warning-blocked-red.png')} style={styles.blindedCommentCharacter} /> : <EyeOff color={theme.muted} size={14} strokeWidth={1.8} />}
            <Text style={[styles.commentBody, { color: theme.muted, ...fonts.regular }]}>블라인드된 댓글입니다.</Text>
          </View>
        ) : (
          <Text style={[styles.commentBody, { color: theme.text, ...fonts.regular }]}>{String(comment.content)}</Text>
        )}
        <View style={styles.commentLinks}>
          <View style={styles.commentReactions}><ReactionButton accent={accent} active={comment.reaction === 'honor'} count={comment.likeCount} icon="honor" label="와드" onPress={() => void onReact('comment', comment.id, 'honor')} small /><ReactionButton accent={accent} active={comment.reaction === 'dislike'} count={comment.dislikeCount} icon="dislike" label="비추천" onPress={() => void onReact('comment', comment.id, 'dislike')} small /></View>
          {!reply && !comment.isDeleted && onReply ? <Pressable onPress={() => onReply(comment)}><Text style={commentLinkText(theme.muted, fonts.medium)}>답글</Text></Pressable> : null}
          {comment.permissions.canEdit && !comment.isDeleted ? <Pressable onPress={() => setEditing(true)}><Text style={commentLinkText(theme.muted, fonts.medium)}>수정</Text></Pressable> : null}
          {comment.permissions.canDelete && !comment.isDeleted ? <Pressable onPress={remove}><Text style={commentLinkText(theme.muted, fonts.medium)}>삭제</Text></Pressable> : null}
        </View>
      </View>
    </View>
  );
}

function commentLinkText(color: string, font: TextStyle) {
  return { color, ...font, fontSize: 13, lineHeight: 19.5 } as const;
}

function OwnerAction({ destructive = false, label, onPress }: { destructive?: boolean; label: string; onPress: () => void }) { const { fonts, theme } = useMinionTheme(); return <Pressable onPress={onPress} style={styles.ownerAction}><Text style={{ color: destructive ? '#ef4444' : theme.text, ...fonts.bold, fontSize: 15 }}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  root: { flex: 1 }, safeTop: { left: 0, position: 'absolute', right: 0, top: 0 }, header: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', height: 48, paddingHorizontal: 12 }, headerButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 }, headerTitle: { flex: 1, fontSize: 16, lineHeight: 24, textAlign: 'center' }, ad: { alignItems: 'center', height: 60, justifyContent: 'center' }, adText: { fontSize: 13, letterSpacing: 2.2, lineHeight: 19.5 }, article: { borderTopWidth: 1, minHeight: 500 }, postHeader: { paddingBottom: 20, paddingHorizontal: 14, paddingTop: 16 }, postTitle: { fontSize: 16, lineHeight: 23.2 }, authorRow: { alignItems: 'center', flexDirection: 'row', marginTop: 12 }, detailMeta: { alignItems: 'center', flexDirection: 'row', gap: 5 }, divider: { height: 1, marginHorizontal: 14 }, body: { minHeight: 180, paddingHorizontal: 14, paddingVertical: 24 }, blinded: { alignItems: 'center', borderRadius: 12, gap: 7, justifyContent: 'center', minHeight: 150, padding: 20 }, blindedCharacter: { height: 112, width: 112 }, blindedComment: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 8, flexDirection: 'row', gap: 8, marginTop: 2, paddingHorizontal: 10, paddingVertical: 6 }, blindedCommentCharacter: { height: 32, width: 32 }, postActions: { alignItems: 'center', borderBottomWidth: 1, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 16 }, reactions: { flexDirection: 'row', gap: 8 }, reaction: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 6, height: 36, paddingHorizontal: 12 }, smallReaction: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 4, height: 32, justifyContent: 'center', paddingHorizontal: 8 }, report: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 6, height: 36, paddingHorizontal: 12 }, commentTitle: { alignItems: 'baseline', flexDirection: 'row', gap: 4, paddingHorizontal: 14, paddingVertical: 16 }, comments: { paddingHorizontal: 14 }, commentThread: { marginBottom: 16 }, commentItem: { alignItems: 'flex-start', flexDirection: 'row', gap: 16, minHeight: 78 }, commentContinuation: { bottom: 0, left: 18, position: 'absolute', top: 40, width: 1 }, commentInner: { flex: 1, minWidth: 0, position: 'relative' }, commentTop: { alignItems: 'center', flexDirection: 'row', gap: 4, height: 20, paddingRight: 30 }, commentAuthor: { flexShrink: 1, minWidth: 0 }, commentMenu: { alignItems: 'center', height: 32, justifyContent: 'center', position: 'absolute', right: 0, top: -6, width: 32 }, commentReactions: { flexDirection: 'row', gap: 4 }, commentBody: { fontSize: 14, lineHeight: 20, marginTop: 2 }, commentLinks: { alignItems: 'center', flexDirection: 'row', gap: 8, height: 32, marginLeft: -8, marginTop: 4 }, threadToggleRow: { height: 52, position: 'relative' }, threadConnection: { borderBottomLeftRadius: 16, borderBottomWidth: 1, borderLeftWidth: 1, height: 30, left: 18, position: 'absolute', top: 0, width: 18 }, threadToggleButton: { alignItems: 'center', borderRadius: 20, flexDirection: 'row', gap: 6, height: 40, left: 36, paddingHorizontal: 16, position: 'absolute', top: 12 }, replyThreadRow: { minHeight: 90, position: 'relative' }, replyThreadStem: { bottom: 0, left: 18, position: 'absolute', top: 0, width: 1 }, replyThreadElbow: { borderBottomLeftRadius: 16, borderBottomWidth: 1, borderLeftWidth: 1, height: 24, left: 18, position: 'absolute', top: 0, width: 30 }, replyThreadContent: { marginLeft: 48, paddingTop: 12 }, editBox: { borderRadius: 8, borderWidth: 1, marginTop: 4, padding: 10 }, editActions: { alignItems: 'center', flexDirection: 'row', gap: 18, justifyContent: 'flex-end', marginTop: 7 }, commentDock: { borderTopWidth: 1, bottom: 0, left: 0, paddingHorizontal: 10, paddingTop: 8, position: 'absolute', right: 0 }, replying: { alignItems: 'center', flexDirection: 'row', paddingBottom: 6, paddingHorizontal: 8 }, emojiBar: { borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7, padding: 5 }, emoji: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 }, emojiText: { fontSize: 20 }, commentComposer: { alignItems: 'center', flexDirection: 'row', gap: 6, minHeight: 40 }, commentInputWrap: { alignItems: 'center', borderRadius: 20, flex: 1, flexDirection: 'row', minHeight: 40, paddingHorizontal: 14, paddingVertical: 6 }, commentInput: { flex: 1, fontSize: 14, lineHeight: 24, maxHeight: 80, minHeight: 24, paddingVertical: 0 }, emojiButton: { alignItems: 'center', height: 28, justifyContent: 'center', width: 28 }, send: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 }, ownerAction: { justifyContent: 'center', minHeight: 48, paddingHorizontal: 14 }, focusState: { alignItems: 'center', flex: 1, justifyContent: 'center' }, loadingAuthor: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 12 }, loadingAuthorCopy: { flex: 1, gap: 6 }, loadingMeta: { flexDirection: 'row', gap: 6 }, loadingBody: { gap: 10, minHeight: 180, paddingHorizontal: 14, paddingVertical: 24 }, loadingComment: { gap: 8, paddingVertical: 14 }, loadingCommentTop: { alignItems: 'center', flexDirection: 'row', gap: 8 }, loadingCommentReactions: { flexDirection: 'row', gap: 12, marginLeft: 'auto' }, loadingLinks: { flexDirection: 'row', gap: 12 },
});
