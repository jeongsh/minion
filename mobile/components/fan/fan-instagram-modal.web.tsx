import * as Linking from 'expo-linking';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { createElement, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileTeamDetailDto } from '@/lib/api-client';

type SocialItem = MobileTeamDetailDto['social'][number];
type EmbedStatus = 'error' | 'loading' | 'ready';

const EMBED_LOAD_TIMEOUT_MS = 15_000;

function relativeTime(value: string | null) {
  if (!value) return '';
  const hours = Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000);
  if (hours < 1) return '방금';
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function instagramEmbedUrl(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    const match = url.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
    return match ? `https://www.instagram.com/${match[1]}/${match[2]}/embed/captioned/` : null;
  } catch { return null; }
}

export function FanInstagramModal({ items, onClose, startIndex }: { items: SocialItem[]; onClose: () => void; startIndex: number }) {
  const { fonts, showToast, theme } = useMinionTheme();
  const [index, setIndex] = useState(startIndex);
  const [embedStatus, setEmbedStatus] = useState<EmbedStatus>('loading');
  const [reloadAttempt, setReloadAttempt] = useState(0);
  const item = items[index];
  const embedUrl = item ? instagramEmbedUrl(item.url) : null;

  useEffect(() => {
    if (!embedUrl || embedStatus !== 'loading') return;

    const timeout = setTimeout(() => setEmbedStatus('error'), EMBED_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [embedStatus, embedUrl, reloadAttempt]);

  if (!item) return null;

  const moveTo = (next: number) => {
    setEmbedStatus('loading');
    setReloadAttempt(0);
    setIndex(next);
  };

  const retry = () => {
    setEmbedStatus('loading');
    setReloadAttempt((attempt) => attempt + 1);
  };

  const openOriginal = async () => {
    try { await Linking.openURL(item.url); } catch { showToast('Instagram 원문을 열지 못했습니다.', 'error'); }
  };

  return (
    <BottomSheet open onClose={onClose} title={'@' + item.ownerName} scrollable={false} panelStyle={{ height: '92%' }} contentStyle={{ flex: 1 }} actions={<Pressable accessibilityLabel="Instagram 원문 열기" onPress={() => void openOriginal()} style={[styles.original, { backgroundColor: theme.surfaceMuted }]}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 13 }}>원문 ↗</Text></Pressable>} footer={<View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Pressable accessibilityLabel="이전 Instagram 게시물" disabled={index === 0} onPress={() => moveTo(index - 1)} style={[styles.nav, index === 0 && styles.disabled]}><ChevronLeft color={theme.ink} size={16} strokeWidth={2.5} /><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 13 }}>이전 게시물</Text></Pressable>
            <Text style={{ color: theme.muted, ...fonts.black, fontSize: 13 }}>{index + 1} / {items.length}</Text>
            <Pressable accessibilityLabel="다음 Instagram 게시물" disabled={index === items.length - 1} onPress={() => moveTo(index + 1)} style={[styles.nav, styles.navNext, index === items.length - 1 && styles.disabled]}><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 13 }}>다음 게시물</Text><ChevronRight color={theme.ink} size={16} strokeWidth={2.5} /></Pressable>
          </View>}>
      <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, marginBottom: 8 }}>{relativeTime(item.publishedAt)}</Text>
          <View style={styles.content}>
            {embedUrl ? createElement('iframe', {
              allow: 'encrypted-media; picture-in-picture; web-share',
              allowFullScreen: true,
              key: `${item.id}-${reloadAttempt}`,
              onError: () => setEmbedStatus('error'),
              onLoad: () => setEmbedStatus('ready'),
              src: embedUrl,
              style: { backgroundColor: theme.surface, border: 0, height: '100%', width: '100%' },
              title: `Instagram post by ${item.ownerName}`,
            }) : (
              <View style={styles.unavailable}><Text style={{ color: theme.text, ...fonts.medium, fontSize: 14, lineHeight: 21, textAlign: 'center' }}>이 게시물은 앱 안에서 표시할 수 없습니다.</Text><Pressable onPress={() => void openOriginal()} style={styles.external}><Text style={{ color: '#ffffff', ...fonts.medium, fontSize: 14 }}>Instagram에서 보기 ↗</Text></Pressable></View>
            )}
            {embedStatus === 'loading' && embedUrl ? <View pointerEvents="none" style={[styles.loader, { backgroundColor: theme.surface }]}><ActivityIndicator color={theme.accent} size="large" /><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>Instagram 게시물을 불러오는 중</Text></View> : null}
            {embedStatus === 'error' && embedUrl ? <View style={[styles.unavailable, styles.error, { backgroundColor: theme.surface }]}><Text style={{ color: theme.text, ...fonts.medium, fontSize: 14, lineHeight: 21, textAlign: 'center' }}>게시물을 불러오지 못했습니다.</Text><View style={styles.errorActions}><Pressable onPress={retry} style={[styles.retry, { backgroundColor: theme.surfaceMuted }]}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 14 }}>다시 시도</Text></Pressable><Pressable onPress={() => void openOriginal()} style={styles.external}><Text style={{ color: '#ffffff', ...fonts.medium, fontSize: 14 }}>Instagram에서 보기 ↗</Text></Pressable></View></View> : null}
          </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, minHeight: 0, position: 'relative' },
  disabled: { opacity: 0.25 },
  error: { ...StyleSheet.absoluteFillObject },
  errorActions: { flexDirection: 'row', gap: 8 },
  external: { backgroundColor: '#111827', borderRadius: 999, marginTop: 16, paddingHorizontal: 16, paddingVertical: 11 },
  footer: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', height: 44, justifyContent: 'space-between', paddingHorizontal: 8 },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', gap: 12, justifyContent: 'center' },
  nav: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 4, height: '100%' },
  navNext: { justifyContent: 'flex-end' },
  original: { borderRadius: 999, marginLeft: 'auto', paddingHorizontal: 12, paddingVertical: 9 },
  retry: { borderRadius: 999, marginTop: 16, paddingHorizontal: 16, paddingVertical: 11 },
  unavailable: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 32 },
});
