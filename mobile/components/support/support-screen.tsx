import { useFocusEffect, useRouter } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Lock from 'lucide-react-native/icons/lock';
import MessageSquarePlus from 'lucide-react-native/icons/message-square-plus';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorState } from '@/components/feedback-states';
import { MinionScreen } from '@/components/minion-screen';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileSupportBoardDto, MobileSupportBoardItem } from '@/lib/api-client';

const STATUS_LABEL = { open: '답변 대기', answered: '답변완료', closed: '종료' } as const;

function formatDate(value: string) {
  // 목록은 "26.01.01"처럼 연.월.일만 짧게 보여준다. locale 기본 구분자(점+공백, 끝점)에
  // 기대지 않도록 parts를 직접 뽑아 조립한다.
  const parts = new Intl.DateTimeFormat('ko-KR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Seoul',
    year: '2-digit',
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}.${get('month')}.${get('day')}`;
}

export function SupportScreen() {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  const [page, setPage] = useState(1);
  const path = useMemo(() => `/api/mobile/v1/support/inquiries?page=${page}`, [page]);
  const { data, error, loading, refresh } = useCachedQuery<MobileSupportBoardDto>(path, { cache: false });

  // 문의하기 화면에 다녀오거나 관리자가 답변을 등록한 뒤 다시 이 탭으로 돌아왔을 때도
  // 최신 상태를 보여줘야 한다. 네비게이션이 화면을 언마운트하지 않고 유지하는 경우가 있어
  // 최초 마운트 시점의 fetch만으로는 갱신을 놓친다.
  const hasFocusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (hasFocusedOnce.current) refresh();
      hasFocusedOnce.current = true;
    }, [refresh]),
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.pageBackground }]}>
      <MinionScreen contentStyle={styles.content}>
        <View style={styles.headingRow}>
          <Text style={[styles.pageTitle, { color: theme.ink, ...fonts.display }]}>고객센터</Text>
          <Pressable
            accessibilityLabel="문의하기"
            onPress={() => router.push('/support/new' as never)}
            style={({ pressed }) => [styles.composeButton, { backgroundColor: theme.accent, opacity: pressed ? 0.9 : 1 }]}
          >
            <MessageSquarePlus color={theme.accentForeground} size={15} strokeWidth={2} />
            <Text style={{ color: theme.accentForeground, ...fonts.bold, fontSize: 13 }}>문의하기</Text>
          </Pressable>
        </View>

        {loading && !data ? (
          <SupportBoardSkeleton />
        ) : error && !data ? (
          <ErrorState onRetry={refresh} title={error} />
        ) : data && data.items.length > 0 ? (
          <View style={[styles.board, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {data.items.map((item, index) => (
              <BoardRow index={index} inquiry={item} key={item.id} onPress={() => router.push(`/support/${item.id}` as never)} />
            ))}
          </View>
        ) : (
          <Text style={[styles.empty, { color: theme.muted, ...fonts.regular }]}>아직 등록된 문의가 없어요.</Text>
        )}

        {data && data.totalPages > 1 ? (
          <View style={styles.pagination}>
            <Pressable accessibilityLabel="이전 페이지" disabled={page <= 1} onPress={() => setPage((value) => Math.max(1, value - 1))} style={styles.pageButton}>
              <ChevronLeft color={page <= 1 ? theme.border : theme.text} size={18} />
            </Pressable>
            <Text style={{ color: theme.text, ...fonts.bold, fontSize: 13 }}>{data.page} / {data.totalPages}</Text>
            <Pressable accessibilityLabel="다음 페이지" disabled={page >= data.totalPages} onPress={() => setPage((value) => value + 1)} style={styles.pageButton}>
              <ChevronRight color={page >= data.totalPages ? theme.border : theme.text} size={18} />
            </Pressable>
          </View>
        ) : null}
      </MinionScreen>
    </View>
  );
}

function BoardRow({ index, inquiry, onPress }: { index: number; inquiry: MobileSupportBoardItem; onPress: () => void }) {
  const { fonts, theme } = useMinionTheme();
  const statusTone =
    inquiry.status === 'open'
      ? { bg: 'rgba(245,158,11,0.15)', text: '#b45309' }
      : inquiry.status === 'answered'
        ? { bg: 'rgba(16,185,129,0.15)', text: '#047857' }
        : { bg: theme.surfaceMuted, text: theme.muted };

  return (
    <Pressable
      accessibilityLabel={`${inquiry.subject} 보기`}
      accessibilityRole="link"
      onPress={onPress}
      style={[styles.row, index > 0 ? { borderTopColor: theme.divider, borderTopWidth: 1 } : null]}
    >
      <View style={styles.rowMain}>
        {inquiry.isPrivate ? <Lock color={theme.muted} size={13} strokeWidth={1.8} /> : null}
        <Text numberOfLines={1} style={[styles.rowSubject, { color: theme.ink, ...fonts.medium }]}>{inquiry.subject}</Text>
      </View>
      <View style={styles.rowMeta}>
        <View style={[styles.statusBadge, { backgroundColor: statusTone.bg }]}>
          <Text style={{ color: statusTone.text, ...fonts.medium, fontSize: 12 }}>{STATUS_LABEL[inquiry.status]}</Text>
        </View>
        <Text numberOfLines={1} style={[styles.rowAuthor, { color: theme.muted, ...fonts.regular }]}>{inquiry.authorLabel}</Text>
        <Text style={[styles.rowDate, { color: theme.muted, ...fonts.regular }]}>{formatDate(inquiry.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

function SupportBoardSkeleton() {
  const { theme } = useMinionTheme();
  return (
    <View style={[styles.board, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {[0, 1, 2].map((index) => (
        <View key={index} style={[styles.row, index > 0 ? { borderTopColor: theme.divider, borderTopWidth: 1 } : null]}>
          <View style={[styles.skeletonBadge, { backgroundColor: theme.surfaceMuted }]} />
          <View style={[styles.skeletonLine, { backgroundColor: theme.surfaceMuted }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  composeButton: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 6, height: 34, paddingHorizontal: 12 },
  content: { gap: 20, paddingBottom: 40, paddingTop: 24 },
  empty: { fontSize: 13, paddingVertical: 40, textAlign: 'center' },
  headingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  pageButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  pageTitle: { fontSize: 20, lineHeight: 25 },
  pagination: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center' },
  root: { flex: 1 },
  row: { gap: 6, minHeight: 58, paddingHorizontal: 14, paddingVertical: 10 },
  rowAuthor: { flexShrink: 1, fontSize: 13, minWidth: 0 },
  rowDate: { flexShrink: 0, fontSize: 12, marginLeft: 'auto' },
  rowMain: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  rowMeta: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  rowSubject: { flex: 1, fontSize: 14, minWidth: 0 },
  skeletonBadge: { borderRadius: 999, height: 20, width: 60 },
  skeletonLine: { borderRadius: 4, flex: 1, height: 16 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
});
