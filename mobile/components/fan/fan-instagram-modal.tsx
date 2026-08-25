import * as Linking from 'expo-linking';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import X from 'lucide-react-native/icons/x';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { InstagramGlyph } from '@/components/fan/fan-shared';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileTeamDetailDto } from '@/lib/api-client';

type SocialItem = MobileTeamDetailDto['social'][number];

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
  const insets = useSafeAreaInsets();
  const { colorScheme, fonts, showToast, theme } = useMinionTheme();
  const [index, setIndex] = useState(startIndex);
  const [loading, setLoading] = useState(true);
  const item = items[index];
  const embedUrl = item ? instagramEmbedUrl(item.url) : null;

  useEffect(() => {
    setIndex(startIndex);
    setLoading(true);
  }, [startIndex]);

  if (!item) return null;

  const moveTo = (next: number) => {
    setLoading(true);
    setIndex(next);
  };

  const openOriginal = async () => {
    try { await Linking.openURL(item.url); } catch { showToast('Instagram 원문을 열지 못했습니다.', 'error'); }
  };

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View accessibilityLabel={`${item.ownerName} Instagram 게시물`} accessibilityViewIsModal style={[styles.backdrop, { backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.60)', paddingTop: insets.top }]}>
        <View style={[styles.panel, { backgroundColor: theme.surface, paddingBottom: insets.bottom }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={[styles.icon, { backgroundColor: theme.surfaceMuted }]}><InstagramGlyph color={theme.ink} size={16} /></View>
            <View style={styles.owner}><Text numberOfLines={1} style={{ color: theme.ink, fontFamily: fonts.black, fontSize: 14 }}>@{item.ownerName}</Text><Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 13 }}>{relativeTime(item.publishedAt)}</Text></View>
            <Pressable accessibilityLabel="Instagram 원문 열기" onPress={() => void openOriginal()} style={[styles.original, { backgroundColor: theme.surfaceMuted }]}><Text style={{ color: theme.ink, fontFamily: fonts.bold, fontSize: 13 }}>원문 ↗</Text></Pressable>
            <Pressable accessibilityLabel="게시물 닫기" onPress={onClose} style={[styles.close, { backgroundColor: theme.surfaceMuted }]}><X color={theme.ink} size={18} strokeWidth={2.5} /></Pressable>
          </View>
          <View style={styles.content}>
            {embedUrl ? <WebView key={item.id} onLoadEnd={() => setLoading(false)} originWhitelist={['https://*']} source={{ uri: embedUrl }} style={[styles.webview, { backgroundColor: theme.surface }]} /> : <View style={styles.unavailable}><Text style={{ color: theme.text, fontFamily: fonts.bold, fontSize: 14, textAlign: 'center' }}>이 게시물은 앱 안에서 표시할 수 없습니다.</Text><Pressable onPress={() => void openOriginal()} style={styles.external}><Text style={{ color: '#ffffff', fontFamily: fonts.bold, fontSize: 14 }}>Instagram에서 보기 ↗</Text></Pressable></View>}
            {loading && embedUrl ? <View pointerEvents="none" style={[styles.loader, { backgroundColor: theme.surface }]}><ActivityIndicator color={theme.accent} size="large" /><Text style={{ color: theme.muted, fontFamily: fonts.bold, fontSize: 13 }}>Instagram 게시물을 불러오는 중</Text></View> : null}
          </View>
          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Pressable accessibilityLabel="이전 Instagram 게시물" disabled={index === 0} onPress={() => moveTo(index - 1)} style={[styles.nav, index === 0 && styles.disabled]}><ChevronLeft color={theme.ink} size={16} strokeWidth={2.5} /><Text style={{ color: theme.ink, fontFamily: fonts.bold, fontSize: 13 }}>이전 게시물</Text></Pressable>
            <Text style={{ color: theme.muted, fontFamily: fonts.black, fontSize: 13 }}>{index + 1} / {items.length}</Text>
            <Pressable accessibilityLabel="다음 Instagram 게시물" disabled={index === items.length - 1} onPress={() => moveTo(index + 1)} style={[styles.nav, styles.navNext, index === items.length - 1 && styles.disabled]}><Text style={{ color: theme.ink, fontFamily: fonts.bold, fontSize: 13 }}>다음 게시물</Text><ChevronRight color={theme.ink} size={16} strokeWidth={2.5} /></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  close: { alignItems: 'center', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  content: { flex: 1, minHeight: 0, position: 'relative' },
  disabled: { opacity: 0.25 },
  external: { backgroundColor: '#111827', borderRadius: 999, marginTop: 16, paddingHorizontal: 16, paddingVertical: 11 },
  footer: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', height: 44, justifyContent: 'space-between', paddingHorizontal: 8 },
  header: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', gap: 12, height: 64, paddingHorizontal: 16 },
  icon: { alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', gap: 12, justifyContent: 'center' },
  nav: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 4, height: '100%' },
  navNext: { justifyContent: 'flex-end' },
  original: { borderRadius: 999, marginLeft: 'auto', paddingHorizontal: 12, paddingVertical: 9 },
  owner: { flexShrink: 1, minWidth: 0 },
  panel: { flex: 1, overflow: 'hidden' },
  unavailable: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 32 },
  webview: { flex: 1 },
});
