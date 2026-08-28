import { useLocalSearchParams, useRouter } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import Lock from 'lucide-react-native/icons/lock';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/feedback-states';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileSupportInquiryDetailDto } from '@/lib/api-client';
import { mutateMobileApi } from '@/lib/api-client';

const STATUS_LABEL = { open: '답변 대기', answered: '답변완료', closed: '종료' } as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).format(new Date(value));
}

export function SupportInquiryScreen() {
  const { inquiryId } = useLocalSearchParams<{ inquiryId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fonts, theme } = useMinionTheme();
  const path = `/api/mobile/v1/support/inquiries/${encodeURIComponent(inquiryId ?? '')}`;
  const { data, error, loading, refresh, setData } = useSupportInquiryQuery(path, Boolean(inquiryId));

  const close = () => router.replace('/support' as never);

  return (
    <View style={[styles.root, { backgroundColor: theme.pageBackground }]}>
      <View style={[styles.safeTop, { backgroundColor: theme.pageBackground, height: insets.top }]} />
      <View style={[styles.header, { borderBottomColor: theme.divider, marginTop: insets.top }]}>
        <Pressable accessibilityLabel="목록으로" onPress={close} style={styles.headerButton}><ChevronLeft color={theme.text} size={22} /></Pressable>
        <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.ink, ...fonts.display }]}>문의 상세</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading && !data ? (
          <ActivityIndicator color={theme.accent} style={styles.loading} />
        ) : error && !data ? (
          <ErrorState onRetry={refresh} title={error} />
        ) : data ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.metaRow}>
              <View style={[styles.statusBadge, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={{ color: theme.ink, ...fonts.medium, fontSize: 12 }}>{STATUS_LABEL[data.status]}</Text>
              </View>
              <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 12 }}>{data.authorLabel} · {formatDate(data.createdAt)}</Text>
            </View>

            <View style={styles.subjectRow}>
              {data.isPrivate ? <Lock color={theme.muted} size={16} strokeWidth={2} /> : null}
              <Text style={[styles.subject, { color: theme.ink, ...fonts.black }]}>{data.subject}</Text>
            </View>

            {data.locked && data.hasPassword ? (
              <PasswordGate inquiryId={inquiryId ?? ''} onUnlocked={setData} />
            ) : data.locked ? (
              <View style={[styles.gate, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={{ color: theme.text, ...fonts.regular, fontSize: 13 }}>작성자만 볼 수 있는 글이에요.</Text>
              </View>
            ) : (
              <>
                <Text style={[styles.message, { color: theme.text, ...fonts.regular }]}>{data.message}</Text>
                {data.reply ? (
                  <View style={[styles.reply, { backgroundColor: theme.surfaceMuted }]}>
                    <Text style={{ color: theme.ink, ...fonts.medium, fontSize: 12 }}>
                      MINION 답변{data.answeredAt ? ` · ${formatDate(data.answeredAt)}` : ''}
                    </Text>
                    <Text style={[styles.replyText, { color: theme.text, ...fonts.regular }]}>{data.reply}</Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function PasswordGate({ inquiryId, onUnlocked }: { inquiryId: string; onUnlocked: (detail: MobileSupportInquiryDetailDto) => void }) {
  const { fonts, theme } = useMinionTheme();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const unlock = async () => {
    if (!password) return;
    setPending(true);
    setError(null);
    try {
      const detail = await mutateMobileApi<MobileSupportInquiryDetailDto>(
        `/api/mobile/v1/support/inquiries/${encodeURIComponent(inquiryId)}/unlock`,
        'POST',
        { password },
      );
      onUnlocked(detail);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '비밀번호를 확인하지 못했어요.');
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={[styles.gate, { backgroundColor: theme.surfaceMuted }]}>
      <Text style={{ color: theme.text, ...fonts.regular, fontSize: 13 }}>비밀번호를 입력하면 내용을 볼 수 있어요.</Text>
      <View style={styles.gateRow}>
        <TextInput
          accessibilityLabel="비밀번호"
          onChangeText={setPassword}
          placeholder="비밀번호"
          placeholderTextColor={theme.muted}
          secureTextEntry
          style={[styles.gateInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, ...fonts.regular }]}
          value={password}
        />
        <Pressable
          accessibilityLabel={pending ? '확인 중' : '확인'}
          disabled={pending || !password}
          onPress={() => void unlock()}
          style={({ pressed }) => [styles.gateButton, { backgroundColor: theme.accent, opacity: pending || !password ? 0.5 : pressed ? 0.85 : 1 }]}
        >
          {pending ? <ActivityIndicator color={theme.accentForeground} size="small" /> : <Text style={{ color: theme.accentForeground, ...fonts.bold, fontSize: 13 }}>확인</Text>}
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/** useCachedQuery는 캐시가 서버 응답을 그대로 두므로, 비밀번호 확인 후 잠금 해제된 상세로
 * 로컬 상태만 교체할 수 있게 얇은 래퍼를 둔다. */
function useSupportInquiryQuery(path: string, enabled: boolean) {
  const query = useCachedQuery<MobileSupportInquiryDetailDto>(path, { cache: false, enabled });
  const [override, setOverride] = useState<MobileSupportInquiryDetailDto | null>(null);
  const data = override ?? query.data;
  return {
    data,
    error: query.error,
    loading: query.loading,
    refresh: () => {
      setOverride(null);
      query.refresh();
    },
    setData: setOverride,
  };
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 },
  content: { padding: 16 },
  error: { color: '#ef4444', fontSize: 12 },
  gate: { borderRadius: 12, gap: 10, padding: 14 },
  gateButton: { alignItems: 'center', borderRadius: 8, height: 40, justifyContent: 'center', paddingHorizontal: 16 },
  gateInput: { borderRadius: 8, borderWidth: 1, flex: 1, fontSize: 14, height: 40, paddingHorizontal: 12 },
  gateRow: { flexDirection: 'row', gap: 8 },
  header: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', height: 48, paddingHorizontal: 12, position: 'relative' },
  headerButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  headerTitle: { fontSize: 16, left: 56, lineHeight: 24, position: 'absolute', right: 56, textAlign: 'center' },
  loading: { marginTop: 40 },
  message: { fontSize: 14, lineHeight: 24 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  reply: { borderRadius: 12, gap: 4, padding: 14 },
  replyText: { fontSize: 14, lineHeight: 24 },
  root: { flex: 1 },
  safeTop: { left: 0, position: 'absolute', right: 0, top: 0 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  subject: { fontSize: 18, letterSpacing: -0.2 },
  subjectRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
});
