import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import Play from 'lucide-react-native/icons/play';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tournamentTokens } from '@/constants/tournament-theme';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileVideoItem } from '@/lib/api-client';
import { InlineVideoPlayer } from './inline-video-player';

function providerLabel(provider: string | null) {
  if (provider === 'afreecatv') return 'SOOP';
  if (provider === 'youtube') return 'YouTube';
  return '다시보기';
}

function videoThumbnailUrl(value: string, thumbnailUrl?: string | null) {
  if (thumbnailUrl) return thumbnailUrl;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);
    let videoId: string | null = null;
    if (host === 'youtu.be') videoId = parts[0] ?? null;
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      videoId = url.pathname === '/watch'
        ? url.searchParams.get('v')
        : ['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] ?? null : null;
    }
    return videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)
      ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      : null;
  } catch {
    return null;
  }
}

function SetVodPlayer({ matchName, onOpen, vods }: { matchName: string; onOpen: (url: string) => Promise<void>; vods: MobileVideoItem[] }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const active = vods[activeIndex] ?? vods[0];
  if (!active) return null;
  // 서버의 임베드 가능 여부를 웹과 동일하게 따른다.
  const embedUrl = active.embedUrl;
  const thumbnailUrl = videoThumbnailUrl(active.url, active.thumbnail?.url);

  return (
    <View style={styles.vodPlayerRoot}>
      {embedUrl ? (
        <InlineVideoPlayer title={`${matchName} ${active.title}`} url={embedUrl} />
      ) : (
        <Pressable accessibilityRole="link" accessibilityLabel={`${matchName} ${active.title} 원본 영상 열기`} onPress={() => void onOpen(active.url)} style={[styles.previewBox, { backgroundColor: '#000000' }]}>
          {thumbnailUrl ? <Image contentFit="cover" source={{ uri: thumbnailUrl }} style={styles.previewImage} /> : null}
          <View style={styles.previewPlayOverlay}>
            <Play color="#ffffff" fill="#ffffff" size={56} />
          </View>
        </Pressable>
      )}
      <Text style={[styles.previewCaption, { color: theme.text, ...fonts.bold }]}>{active.title.replace('다시보기', '').trim()}</Text>

      <Text style={[styles.asideHeading, { color: theme.text, ...fonts.bold }]}>세트별 다시보기</Text>
      <View style={styles.vodList}>
        {vods.map((vod, index) => {
          const selected = index === activeIndex;
          const thumbnailUrl = videoThumbnailUrl(vod.url, vod.thumbnail?.url);
          return (
            <Pressable
              key={vod.id}
              onPress={() => setActiveIndex(index)}
              style={[styles.vodRow, selected && { backgroundColor: tournamentTokens[colorScheme].surfaceMuted }]}
            >
              <View style={[styles.vodThumb, { backgroundColor: '#000000' }]}>
                {thumbnailUrl ? (
                  <Image contentFit="cover" source={{ uri: thumbnailUrl }} style={styles.previewImage} />
                ) : (
                  <View style={styles.previewPlayOverlay}>
                    <Play color="#ffffff" fill="#ffffff" size={20} />
                  </View>
                )}
              </View>
              <View style={styles.vodRowText}>
                <Text numberOfLines={1} style={[styles.vodRowTitle, { color: selected ? theme.accent : theme.text, ...fonts.bold }]}>{vod.title.replace('다시보기', '').trim()}</Text>
                <Text style={[styles.vodRowProvider, { color: tournamentTokens[colorScheme].muted, ...fonts.medium }]}>{providerLabel(vod.channelName)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MatchVideoTab({ matchName, matchVodUrl, vods }: { matchName: string; matchVodUrl: string | null; vods: MobileVideoItem[] }) {
  const { fonts, showToast, theme } = useMinionTheme();
  const hasContent = Boolean(matchVodUrl) || vods.length > 0;
  const matchThumbnailUrl = matchVodUrl ? videoThumbnailUrl(matchVodUrl) : null;

  async function openVideo(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      showToast('영상을 열지 못했습니다.', 'error');
    }
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.ink, ...fonts.display }]}>영상</Text>
      {hasContent ? (
        <View style={styles.contentWrap}>
          {matchVodUrl ? (
            <Pressable accessibilityRole="link" onPress={() => void openVideo(matchVodUrl)}>
              {matchThumbnailUrl ? (
                <View style={[styles.previewBox, { backgroundColor: '#000000' }]}>
                  <Image contentFit="cover" source={{ uri: matchThumbnailUrl }} style={styles.previewImage} />
                  <View style={styles.previewPlayOverlay}>
                    <Play color="#ffffff" fill="#ffffff" size={56} />
                  </View>
                </View>
              ) : null}
              <Text style={[styles.originalLink, { color: theme.accent, ...fonts.bold }]}>원본 영상 열기</Text>
            </Pressable>
          ) : null}
          {vods.length > 0 ? <SetVodPlayer matchName={matchName} onOpen={openVideo} vods={vods} /> : null}
        </View>
      ) : (
        <View style={[styles.emptyBox, { borderColor: theme.border }]}>
          <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 14 }}>아직 연결된 영상 URL이 없습니다.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  asideHeading: { fontSize: 15, lineHeight: 22.5, marginTop: 4 },
  contentWrap: { gap: 10, marginTop: 12 },
  emptyBox: { borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, marginTop: 12, padding: 12 },
  heading: { fontSize: 16, lineHeight: 21.6 },
  originalLink: { fontSize: 15, lineHeight: 22.5 },
  previewBox: { aspectRatio: 16 / 9, borderRadius: 12, overflow: 'hidden', width: '100%' },
  previewCaption: { fontSize: 16, lineHeight: 24, marginTop: 10 },
  previewImage: { height: '100%', width: '100%' },
  previewPlayOverlay: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  section: { marginHorizontal: -16, paddingHorizontal: 16, paddingVertical: 16 },
  vodList: { gap: 10, marginTop: 4 },
  vodPlayerRoot: { gap: 0 },
  vodRow: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 10, padding: 4 },
  vodRowProvider: { fontSize: 13, lineHeight: 19.5, marginTop: 4 },
  vodRowText: { flex: 1, justifyContent: 'center', minWidth: 0 },
  vodRowTitle: { fontSize: 15, lineHeight: 20 },
  vodThumb: { aspectRatio: 16 / 9, borderRadius: 8, overflow: 'hidden', width: 140 },
});
