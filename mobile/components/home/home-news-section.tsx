import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { HomeSectionHeading } from '@/components/home/home-section-heading';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileNewsItem } from '@/lib/api-client';
import { resolveNewsMetadata } from '@/lib/news-metadata';

function NewsRow({ article }: { article: MobileNewsItem }) {
  const { width } = useWindowDimensions();
  const { fonts, showToast, theme } = useMinionTheme();
  const [thumbnail, setThumbnail] = useState(article.thumbnail?.url ?? null);
  const [pending, setPending] = useState(!article.thumbnail?.url);
  const [errored, setErrored] = useState(false);
  const [title, setTitle] = useState(article.title);
  useEffect(() => {
    const controller = new AbortController();
    if (!article.thumbnail?.url) {
      void resolveNewsMetadata('thumbnail', article.url, controller.signal)
        .then((body) => { if (!controller.signal.aborted) { setThumbnail(body.thumbnail ?? null); setPending(false); } })
        .catch((error) => { if (!controller.signal.aborted) { console.error('[news-thumbnail]', error); setPending(false); } });
    }
    if (/(?:\.{3}|…)\s*$/.test(article.title)) {
      void resolveNewsMetadata('title', article.url, controller.signal)
        .then((body) => { if (!controller.signal.aborted && body.title && body.title.length > article.title.replace(/(?:\.{3}|…)\s*$/, '').length) setTitle(body.title); })
        .catch((error) => { if (!controller.signal.aborted) console.error('[news-title]', error); });
    }
    return () => controller.abort();
  }, [article.url, article.title, article.thumbnail?.url]);
  const date = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }).format(new Date(article.publishedAt));
  return <Pressable accessibilityRole="link" accessibilityLabel={`${title} ${article.source} ${date}`} onPress={() => { void Linking.openURL(article.url).catch(() => showToast('기사 원문을 열지 못했습니다.', 'error')); }} style={styles.row}>
    {thumbnail && !errored ? <Image contentFit="cover" onError={() => setErrored(true)} source={{ uri: resolveApiAssetUrl(thumbnail) ?? thumbnail }} style={[styles.thumbnail, width >= 640 && { width: 96 }]} /> : pending ? <View style={[styles.thumbnail, width >= 640 && { width: 96 }, { backgroundColor: theme.card }]} /> : null}
    <View style={styles.copy}><Text numberOfLines={1} style={{ color: theme.ink, ...fonts.bold, fontSize: 15, lineHeight: 21.75 }}>{title}</Text><View style={styles.meta}><Text numberOfLines={1} style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20, flexShrink: 1 }}>{article.source}</Text><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20 }}>{date}</Text></View></View>
  </Pressable>;
}

export function HomeNewsSection({ articles }: { articles: MobileNewsItem[] }) {
  const { width } = useWindowDimensions();
  if (!articles.length) return null;
  return <View style={{ marginTop: 40 }}><HomeSectionHeading title="LCK 뉴스" href="/news" /><View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 32 }}>{articles.slice(0, 6).map((article) => <View key={article.id} style={{ width: width >= 768 ? (width - 64) / 2 : '100%' }}><NewsRow article={article} /></View>)}</View></View>;
}

const styles = StyleSheet.create({ row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }, thumbnail: { width: 80, height: 60, borderRadius: 6 }, copy: { flex: 1, minWidth: 0 }, meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 } });
