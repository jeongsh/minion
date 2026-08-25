import { useLocalSearchParams, useRouter } from 'expo-router';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/bottom-sheet';
import { ErrorState } from '@/components/feedback-states';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileCommunityPostDetailDto, MobileCommunityPostMutationDto, TiptapDocument } from '@/lib/api-client';
import { mutateMobileApi } from '@/lib/api-client';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useAuth } from '@/providers/auth-provider';
import { CommunityRichEditor } from './community-rich-editor';
import { boardLabel, emptyTiptapDocument, HUB_BOARDS, isTiptapEmpty, POST_TEXT_MAX_LENGTH, POST_TITLE_MAX_LENGTH, tiptapTextLength } from './community-utils';

export function CommunityComposeScreen({ edit = false }: { edit?: boolean }) {
  const { postId } = useLocalSearchParams<{ postId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, viewer } = useAuth();
  const { fonts, theme } = useMinionTheme();
  const detailPath = `/api/mobile/v1/community/posts/${encodeURIComponent(postId ?? '')}`;
  const detail = useCachedQuery<MobileCommunityPostDetailDto>(detailPath, { cache: false, enabled: edit && Boolean(postId) });
  const [category, setCategory] = useState('free');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [document, setDocument] = useState<TiptapDocument>(emptyTiptapDocument);
  const [initialized, setInitialized] = useState(!edit);
  const [submitting, setSubmitting] = useState(false);
  const length = tiptapTextLength(document);

  useEffect(() => {
    if (!edit || initialized || !detail.data) return;
    setCategory(detail.data.boardType);
    setTitle(detail.data.title);
    setDocument(detail.data.content);
    setInitialized(true);
  }, [detail.data, edit, initialized]);

  const close = () => edit && postId ? router.replace(`/community/post/${postId}` as never) : router.replace('/community' as never);
  const submit = async () => {
    if (!title.trim()) { Alert.alert('제목을 입력하세요.'); return; }
    if (isTiptapEmpty(document)) { Alert.alert('내용을 입력하세요.'); return; }
    if (length > POST_TEXT_MAX_LENGTH) { Alert.alert(`본문은 ${POST_TEXT_MAX_LENGTH.toLocaleString('ko-KR')}자까지 입력할 수 있습니다.`); return; }
    setSubmitting(true);
    try {
      const payload = { boardType: category, content: JSON.stringify(document), scope: 'hub', title: title.trim() };
      const result = edit && postId
        ? await mutateMobileApi<MobileCommunityPostMutationDto>(detailPath, 'PATCH', payload)
        : await mutateMobileApi<MobileCommunityPostMutationDto>('/api/mobile/v1/community/posts', 'POST', payload);
      router.replace(edit ? `/community/post/${result.id}` as never : '/community' as never);
    } catch (caught) { Alert.alert(edit ? '수정 실패' : '등록 실패', caught instanceof Error ? caught.message : '게시글을 저장하지 못했습니다.'); }
    finally { setSubmitting(false); }
  };

  if (edit && detail.loading && !detail.data) return <ComposeState><ActivityIndicator color={theme.accent} /></ComposeState>;
  if (edit && detail.error && !detail.data) return <ComposeState><ErrorState onRetry={detail.refresh} title={detail.error} /></ComposeState>;
  if (!initialized) return <ComposeState><ActivityIndicator color={theme.accent} /></ComposeState>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: theme.pageBackground }]}>
      <View style={{ height: insets.top }} />
      <View style={[styles.header, { borderBottomColor: theme.divider }]}><Pressable accessibilityLabel="이전 화면" onPress={close} style={styles.back}><ChevronLeft color={theme.text} size={24} /></Pressable><Text style={[styles.headerTitle, { color: theme.ink, fontFamily: fonts.bold }]}>{edit ? '글 수정' : '글쓰기'}</Text><View style={styles.back} /></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!edit && !session ? <View style={[styles.guest, { backgroundColor: theme.surfaceMuted }]}><Text style={{ color: theme.text, fontFamily: fonts.bold, fontSize: 14 }}>비회원 닉네임은 등록할 때 자동으로 발급돼요.</Text></View> : !edit ? <View style={[styles.guest, { backgroundColor: theme.surfaceMuted }]}><Text style={{ color: theme.text, fontFamily: fonts.bold, fontSize: 14 }}>{viewer?.nickname ?? '회원'}님으로 작성</Text></View> : null}
        <View style={[styles.titleBox, { borderColor: theme.border }]}>
          <Pressable accessibilityLabel="말머리" onPress={() => setCategoryOpen(true)} style={[styles.category, { backgroundColor: theme.surfaceMuted, borderRightColor: theme.border }]}><Text style={{ color: theme.text, fontFamily: fonts.medium, fontSize: 16 }}>{boardLabel(category)}</Text><ChevronDown color={theme.muted} size={14} /></Pressable>
          <TextInput accessibilityLabel="제목" maxLength={POST_TITLE_MAX_LENGTH} onChangeText={setTitle} placeholder="제목을 입력하세요" placeholderTextColor={theme.muted} style={[styles.titleInput, { color: theme.ink, fontFamily: fonts.bold }]} value={title} />
        </View>
        <CommunityRichEditor allowMedia={Boolean(session)} onChange={setDocument} value={document} />
        <Text style={[styles.count, { color: length > POST_TEXT_MAX_LENGTH ? '#ef4444' : theme.muted, fontFamily: fonts.regular }]}>{length.toLocaleString('ko-KR')}/{POST_TEXT_MAX_LENGTH.toLocaleString('ko-KR')}자</Text>
        <View style={[styles.submitBar, { borderTopColor: theme.divider }]}><Text style={[styles.policy, { color: theme.muted, fontFamily: fonts.regular }]}>서로 존중하는 커뮤니티를 위해 비방·욕설은 삼가주세요.</Text><Pressable disabled={submitting || length > POST_TEXT_MAX_LENGTH} onPress={() => void submit()} style={[styles.submit, { backgroundColor: theme.ink }]}>{submitting ? <ActivityIndicator color={theme.surface} size="small" /> : <Text style={{ color: theme.surface, fontFamily: fonts.bold, fontSize: 14 }}>{edit ? '수정' : '등록'}</Text>}</Pressable></View>
      </ScrollView>
      <BottomSheet onClose={() => setCategoryOpen(false)} open={categoryOpen} title="말머리">
        {HUB_BOARDS.map((board) => <Pressable key={board.slug} onPress={() => { setCategory(board.slug); setCategoryOpen(false); }} style={[styles.categoryOption, category === board.slug ? { backgroundColor: theme.surfaceMuted } : null]}><Text style={{ color: category === board.slug ? theme.ink : theme.text, fontFamily: category === board.slug ? fonts.bold : fonts.medium, fontSize: 15 }}>{board.label}</Text></Pressable>)}
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

function ComposeState({ children }: { children: React.ReactNode }) { const insets = useSafeAreaInsets(); const { theme } = useMinionTheme(); return <View style={[styles.state, { backgroundColor: theme.pageBackground, paddingTop: insets.top }]}>{children}</View>; }

const styles = StyleSheet.create({ root: { flex: 1 }, header: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', height: 54 }, back: { alignItems: 'center', height: 54, justifyContent: 'center', width: 54 }, headerTitle: { flex: 1, fontSize: 17, textAlign: 'center' }, content: { gap: 14, paddingBottom: 26, paddingHorizontal: 15, paddingTop: 38 }, guest: { borderRadius: 8, justifyContent: 'center', minHeight: 40, paddingHorizontal: 13 }, titleBox: { borderRadius: 8, borderWidth: 1, flexDirection: 'row', height: 44, overflow: 'hidden' }, category: { alignItems: 'center', borderRightWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'space-between', paddingHorizontal: 13, width: 85 }, titleInput: { flex: 1, fontSize: 16, paddingHorizontal: 13, paddingVertical: 0 }, count: { fontSize: 13, marginTop: -8, textAlign: 'right' }, submitBar: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', gap: 12, marginHorizontal: -15, marginTop: 1, paddingHorizontal: 15, paddingTop: 12 }, policy: { flex: 1, fontSize: 13, lineHeight: 19 }, submit: { alignItems: 'center', borderRadius: 8, height: 40, justifyContent: 'center', minWidth: 92, paddingHorizontal: 18 }, categoryOption: { borderRadius: 10, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 }, state: { alignItems: 'center', flex: 1, justifyContent: 'center' } });
