import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/feedback-states';
import { KeyboardAwareView } from '@/components/keyboard-aware-view';
import { getMinionTeam } from '@/constants/teams';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileCommunityPostDetailDto, MobileCommunityPostMutationDto, MobileMiniconCatalogDto, TiptapDocument } from '@/lib/api-client';
import { invalidateApiCache, mutateMobileApi } from '@/lib/api-client';
import { fanAccentText } from '@/lib/fan-colors';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useAuth } from '@/providers/auth-provider';
import { CommunityRichEditor, type CommunityRichEditorHandle } from './community-rich-editor';
import { boardLabel, boardsForScope, emptyTiptapDocument, isTiptapEmpty, POST_TEXT_MAX_LENGTH, POST_TITLE_MAX_LENGTH, tiptapTextLength, type CommunityScope } from './community-utils';

export function CommunityComposeScreen({ edit = false, scope = 'hub' }: { edit?: boolean; scope?: CommunityScope }) {
  const params = useLocalSearchParams<{ board?: string | string[]; cat?: string | string[]; postId?: string; team?: string | string[] }>();
  const { postId } = params;
  const teamSlug = Array.isArray(params.team) ? params.team[0] : params.team;
  const requestedCategory = Array.isArray(params.cat) ? params.cat[0] : params.cat ?? (Array.isArray(params.board) ? params.board[0] : params.board);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { fonts, theme } = useMinionTheme();
  const team = scope === 'team' ? getMinionTeam(teamSlug) : null;
  const accent = team ? fanAccentText(team.primaryColor) : theme.accent;
  const boards = boardsForScope(scope);
  const defaultCategory = boards.some((board) => board.slug === requestedCategory) ? requestedCategory! : 'free';
  const basePath = teamSlug && scope === 'team' ? `/fan/${teamSlug}/community` : '/community';
  const detailPath = `/api/mobile/v1/community/posts/${encodeURIComponent(postId ?? '')}${teamSlug && scope === 'team' ? `?team=${encodeURIComponent(teamSlug)}` : ''}`;
  const detail = useCachedQuery<MobileCommunityPostDetailDto>(detailPath, { cache: false, enabled: edit && Boolean(postId) });
  const minicons = useCachedQuery<MobileMiniconCatalogDto>('/api/mobile/v1/minicons/picker', { cache: false });
  const [category, setCategory] = useState(defaultCategory);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [document, setDocument] = useState<TiptapDocument>(emptyTiptapDocument);
  const [editorVersion, setEditorVersion] = useState(0);
  const [initialized, setInitialized] = useState(!edit);
  const [submitting, setSubmitting] = useState(false);
  const editorRef = useRef<CommunityRichEditorHandle>(null);
  const hasFocused = useRef(false);
  const length = tiptapTextLength(document);

  const resetDraft = useCallback(() => {
    setCategory(defaultCategory);
    setCategoryOpen(false);
    setTitle('');
    setDocument(emptyTiptapDocument());
    setEditorVersion((version) => version + 1);
  }, [defaultCategory]);

  useFocusEffect(useCallback(() => {
    if (!edit && hasFocused.current) resetDraft();
    hasFocused.current = true;
  }, [edit, resetDraft]));

  useEffect(() => {
    if (!edit || initialized || !detail.data) return;
    setCategory(detail.data.boardType);
    setTitle(detail.data.title);
    setDocument(detail.data.content);
    setInitialized(true);
  }, [detail.data, edit, initialized]);

  const close = () => edit && postId ? router.replace(`${basePath}/post/${postId}` as never) : router.replace(basePath as never);

  const submit = async () => {
    if (!title.trim()) { Alert.alert('제목을 입력하세요.'); return; }
    setSubmitting(true);
    try {
      const latestDocument = await editorRef.current?.flush() ?? document;
      const latestLength = tiptapTextLength(latestDocument);
      if (isTiptapEmpty(latestDocument)) { Alert.alert('내용을 입력하세요.'); return; }
      if (latestLength > POST_TEXT_MAX_LENGTH) { Alert.alert(`본문은 ${POST_TEXT_MAX_LENGTH.toLocaleString('ko-KR')}자까지 입력할 수 있습니다.`); return; }
      const payload = { boardType: category, content: JSON.stringify(latestDocument), scope, teamSlug, title: title.trim() };
      const result = edit && postId
        ? await mutateMobileApi<MobileCommunityPostMutationDto>(detailPath, 'PATCH', payload)
        : await mutateMobileApi<MobileCommunityPostMutationDto>('/api/mobile/v1/community/posts', 'POST', payload);
      await invalidateApiCache('/api/mobile/v1/community/posts');
      if (!edit) resetDraft();
      router.replace(edit ? `${basePath}/post/${result.id}` as never : basePath as never);
    } catch (caught) { Alert.alert(edit ? '수정 실패' : '등록 실패', caught instanceof Error ? caught.message : '게시글을 저장하지 못했습니다.'); }
    finally { setSubmitting(false); }
  };

  if (edit && detail.loading && !detail.data) return <ComposeState><ActivityIndicator color={theme.accent} /></ComposeState>;
  if (edit && detail.error && !detail.data) return <ComposeState><ErrorState onRetry={detail.refresh} title={detail.error} /></ComposeState>;
  if (!initialized) return <ComposeState><ActivityIndicator color={theme.accent} /></ComposeState>;

  return (
    <KeyboardAwareView style={[styles.root, { backgroundColor: theme.pageBackground }]}>
      <View style={[styles.safeTop, { backgroundColor: theme.pageBackground, height: insets.top }]} />
      <View style={[styles.header, { borderBottomColor: theme.divider, marginTop: insets.top }]}>
        <Pressable accessibilityLabel="이전 화면" onPress={close} style={styles.headerButton}><ChevronLeft color={theme.text} size={22} /></Pressable>
        <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.ink, ...fonts.display }]}>{edit ? '글 수정' : '글쓰기'}</Text>
        <Pressable accessibilityLabel={submitting ? '등록 중' : edit ? '수정' : '등록'} disabled={submitting || length > POST_TEXT_MAX_LENGTH} onPress={() => void submit()} style={({ pressed }) => [styles.headerSubmit, { backgroundColor: accent, opacity: submitting || length > POST_TEXT_MAX_LENGTH ? 0.4 : pressed ? 0.78 : 1 }]}>
          {submitting ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={{ color: '#ffffff', ...fonts.medium, fontSize: 14 }}>{edit ? '수정' : '등록'}</Text>}
        </Pressable>
      </View>
      <View style={styles.content}>
        <View style={[styles.heading, { borderBottomColor: theme.border }]}>
          <View style={styles.categoryWrap}>
            <Pressable accessibilityLabel="말머리 선택" accessibilityState={{ expanded: categoryOpen }} onPress={() => setCategoryOpen((open) => !open)} style={[styles.category, { backgroundColor: theme.surface, borderColor: categoryOpen ? theme.ink : theme.border }]}>
              <Text style={{ color: theme.text, ...fonts.medium, fontSize: 14 }}>{boardLabel(category, scope)}</Text>
              <ChevronDown color={theme.muted} size={16} strokeWidth={1.8} style={{ transform: [{ rotate: categoryOpen ? '180deg' : '0deg' }] }} />
            </Pressable>
            {categoryOpen ? <View accessibilityLabel="말머리 선택 목록" style={[styles.categoryMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>{boards.map((board) => <Pressable accessibilityRole="menuitem" key={board.slug} onPress={() => { setCategory(board.slug); setCategoryOpen(false); }} style={({ pressed }) => [styles.categoryOption, category === board.slug || pressed ? { backgroundColor: theme.surfaceMuted } : null]}><Text style={{ color: category === board.slug ? theme.ink : theme.text, flex: 1, ...fonts.medium, fontSize: 14 }}>{board.label}</Text>{category === board.slug ? <Check color={theme.ink} size={17} /> : null}</Pressable>)}</View> : null}
          </View>
          <TextInput accessibilityLabel="제목" maxLength={POST_TITLE_MAX_LENGTH} onChangeText={setTitle} placeholder="제목을 입력하세요" placeholderTextColor={colorWithAlpha(theme.muted, 0.55)} style={[styles.titleInput, { color: theme.ink, ...(title ? fonts.bold : fonts.medium) }]} value={title} />
        </View>
        <View style={styles.editor}><CommunityRichEditor allowEmbeds={Boolean(session)} allowMedia characterCount={length} characterLimit={POST_TEXT_MAX_LENGTH} key={editorVersion} maxImages={session ? 10 : 1} miniconPacks={detail.data?.miniconPacks ?? minicons.data?.packs ?? []} onChange={setDocument} ref={editorRef} value={document} /></View>
      </View>
    </KeyboardAwareView>
  );
}

function ComposeState({ children }: { children: React.ReactNode }) { const insets = useSafeAreaInsets(); const { theme } = useMinionTheme(); return <View style={[styles.state, { backgroundColor: theme.pageBackground, paddingTop: insets.top }]}>{children}</View>; }

function colorWithAlpha(hex: string, alpha: number) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

const styles = StyleSheet.create({ root: { flex: 1 }, safeTop: { left: 0, position: 'absolute', right: 0, top: 0 }, header: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', height: 48, paddingHorizontal: 12, position: 'relative' }, headerButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 }, headerTitle: { fontSize: 16, left: 56, lineHeight: 24, position: 'absolute', right: 56, textAlign: 'center' }, headerSubmit: { alignItems: 'center', borderRadius: 10, height: 36, justifyContent: 'center', minWidth: 58, paddingHorizontal: 12, position: 'absolute', right: 12 }, content: { flex: 1, paddingHorizontal: 16 }, heading: { borderBottomWidth: 1, gap: 8, paddingBottom: 12, paddingTop: 14, zIndex: 20 }, categoryWrap: { alignSelf: 'flex-start', position: 'relative', zIndex: 21 }, category: { alignItems: 'center', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 8, height: 40, paddingHorizontal: 12 }, categoryMenu: { borderRadius: 12, borderWidth: 1, left: 12, padding: 6, position: 'absolute', top: 48, width: 164, zIndex: 22 }, categoryOption: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', minHeight: 38, paddingHorizontal: 10 }, titleInput: { fontSize: 16, letterSpacing: -0.4, lineHeight: 23.2, minHeight: 32, paddingHorizontal: 0, paddingVertical: 3 }, editor: { flex: 1, marginTop: 12 }, state: { alignItems: 'center', flex: 1, justifyContent: 'center' } });
