import { Image } from 'expo-image';
import Play from 'lucide-react-native/icons/play';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { tournamentTokens } from '@/constants/tournament-theme';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileVideoItem } from '@/lib/api-client';
import { InlineVideoPlayer } from './inline-video-player';

function providerLabel(provider: string | null) {
  if (provider === 'afreecatv') return 'SOOP';
  if (provider === 'youtube') return 'YouTube';
  return '다시보기';
}

function youtubeEmbedUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (url.hostname.includes('youtube.com')) {
      const id = url.searchParams.get('v') ?? url.pathname.split('/').filter(Boolean).pop();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function SetVodPlayer({ matchName, vods }: { matchName: string; vods: MobileVideoItem[] }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const active = vods[activeIndex] ?? vods[0];
  if (!active) return null;
  const embedUrl = active.embedUrl ?? youtubeEmbedUrl(active.url);

  return (
    <View style={styles.vodPlayerRoot}>
      {embedUrl ? (
        <InlineVideoPlayer title={`${matchName} ${active.title}`} url={embedUrl} />
      ) : (
        <Pressable onPress={() => WebBrowser.openBrowserAsync(active.url)} style={[styles.previewBox, { backgroundColor: '#000000' }]}>
          {active.thumbnail?.url ? <Image contentFit="cover" source={{ uri: active.thumbnail.url }} style={styles.previewImage} /> : null}
          <View style={styles.previewPlayOverlay}>
            <Play color="#ffffff" fill="#ffffff" size={56} />
          </View>
        </Pressable>
      )}
      <Text style={[styles.previewCaption, { color: theme.text, fontFamily: fonts.bold }]}>{active.title.replace('다시보기', '').trim()}</Text>

      <Text style={[styles.asideHeading, { color: theme.text, fontFamily: fonts.bold }]}>세트별 다시보기</Text>
      <View style={styles.vodList}>
        {vods.map((vod, index) => {
          const selected = index === activeIndex;
          return (
            <Pressable
              key={vod.id}
              onPress={() => setActiveIndex(index)}
              style={[styles.vodRow, selected && { backgroundColor: tournamentTokens[colorScheme].surfaceMuted }]}
            >
              <View style={[styles.vodThumb, { backgroundColor: '#000000' }]}>
                {vod.thumbnail?.url ? (
                  <Image contentFit="cover" source={{ uri: vod.thumbnail.url }} style={styles.previewImage} />
                ) : (
                  <View style={styles.previewPlayOverlay}>
                    <Play color="#ffffff" fill="#ffffff" size={20} />
                  </View>
                )}
              </View>
              <View style={styles.vodRowText}>
                <Text numberOfLines={1} style={[styles.vodRowTitle, { color: selected ? theme.accent : theme.text, fontFamily: fonts.bold }]}>{vod.title.replace('다시보기', '').trim()}</Text>
                <Text style={[styles.vodRowProvider, { color: tournamentTokens[colorScheme].muted, fontFamily: fonts.medium }]}>{providerLabel(vod.channelName)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MatchVideoTab({ matchName, matchVodUrl, vods }: { matchName: string; matchVodUrl: string | null; vods: MobileVideoItem[] }) {
  const { fonts, theme } = useMinionTheme();
  const hasContent = Boolean(matchVodUrl) || vods.length > 0;
  const matchEmbedUrl = youtubeEmbedUrl(matchVodUrl);

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.ink, fontFamily: fonts.display }]}>영상</Text>
      {hasContent ? (
        <View style={styles.contentWrap}>
          {matchEmbedUrl ? <InlineVideoPlayer title={`${matchName} VOD`} url={matchEmbedUrl} /> : null}
          {matchVodUrl ? (
            <Pressable onPress={() => WebBrowser.openBrowserAsync(matchVodUrl)}>
              <Text style={[styles.originalLink, { color: theme.accent, fontFamily: fonts.bold }]}>원본 영상 열기</Text>
            </Pressable>
          ) : null}
          {vods.length > 0 ? <SetVodPlayer matchName={matchName} vods={vods} /> : null}
        </View>
      ) : (
        <View style={[styles.emptyBox, { borderColor: theme.border }]}>
          <Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 14 }}>아직 연결된 영상 URL이 없습니다.</Text>
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
