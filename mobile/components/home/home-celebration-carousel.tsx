import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileHomeDto } from '@/lib/api-client';

type Celebration = MobileHomeDto['celebrations'][number];
const EMOJI = { birthday: '🎂', championship: '🏆', custom: '🎈', debut: '🎉' };

function Banner({ event, onPause }: { event: Celebration; onPause?: (paused: boolean) => void }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 640;
  const { fonts } = useMinionTheme();
  const banner = event.banner;
  if (!banner) return null;
  const image = resolveApiAssetUrl(banner.image?.url);
  return <Pressable accessibilityRole="link" onFocus={() => onPause?.(true)} onBlur={() => onPause?.(false)} onHoverIn={() => onPause?.(true)} onHoverOut={() => onPause?.(false)} onPress={() => router.navigate(banner.href as never)} style={[styles.banner, { backgroundColor: banner.background }, wide && { justifyContent: 'center', gap: 20, paddingHorizontal: 24, paddingVertical: 14 }]}>
    <View style={[styles.avatar, { backgroundColor: banner.soft }, wide && { width: 40, height: 40, borderRadius: 20 }]}>{image ? <Image contentFit={banner.contain ? 'contain' : 'cover'} contentPosition={banner.contain ? 'center' : 'top'} source={{ uri: image }} style={{ width: wide ? 40 : 36, height: wide ? 40 : 36 }} /> : <Text style={{ fontSize: 18 }}>{EMOJI[event.type]}</Text>}</View>
    <View style={{ flex: wide ? undefined : 1, minWidth: 0, flexShrink: 1 }}><Text numberOfLines={1} style={{ color: banner.accent, ...fonts.regular, fontSize: wide ? 14 : 13, lineHeight: wide ? 20 : 16 }}>{banner.eyebrow}</Text><Text numberOfLines={1} style={{ color: banner.foreground, ...fonts.display, fontSize: 16, lineHeight: 24 }}>{banner.headline}</Text></View>
    <View style={[styles.cta, { flexDirection: 'row', alignItems: 'center', gap: 2 }]}>{wide ? <Text style={{ color: banner.ctaColor, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>축하하러 가기</Text> : null}<ChevronRight color={banner.ctaColor} size={14} strokeWidth={2.5} /></View>
  </Pressable>;
}

export function HomeCelebrationCarousel({ events }: { events: Celebration[] }) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(1);
  const [paused, setPaused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const focused = useIsFocused();
  const scroll = useRef<ScrollView>(null);
  const index = useRef(1);
  const multiple = events.length > 1;
  const slides = multiple ? [events.at(-1)!, ...events, events[0]] : events;
  const signature = events.map((event) => event.id).join(',');
  useEffect(() => { const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active')); return () => subscription.remove(); }, []);
  useEffect(() => {
    index.current = multiple ? 1 : 0;
    setActive(index.current);
    scroll.current?.scrollTo({ x: index.current * (width + 12), animated: false });
  }, [signature, multiple, width]);
  useEffect(() => {
    if (!multiple || !width || !focused || !foreground || paused) return;
    const timer = setInterval(() => { if (index.current >= events.length + 1) { index.current = 1; scroll.current?.scrollTo({ x: width + 12, animated: false }); } index.current += 1; setActive(index.current); scroll.current?.scrollTo({ x: index.current * (width + 12), animated: true }); }, 5000);
    return () => clearInterval(timer);
  }, [multiple, width, focused, foreground, paused, events.length]);
  if (!events.length) return null;
  const settle = (x: number) => {
    const next = Math.round(x / (width + 12));
    index.current = next === 0 ? events.length : next === events.length + 1 ? 1 : next;
    if (index.current !== next) scroll.current?.scrollTo({ x: index.current * (width + 12), animated: false });
    setActive(index.current);
    setPaused(false);
  };
  return <View accessibilityLabel="축하 배너" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ marginBottom: 32, minWidth: 0 }}>
    {multiple ? <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} snapToInterval={width + 12} decelerationRate="fast" onScrollBeginDrag={() => setPaused(true)} onScrollEndDrag={(event) => { if (!event.nativeEvent.velocity?.x) settle(event.nativeEvent.contentOffset.x); }} onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.x)} contentContainerStyle={{ gap: 12 }} style={{ borderRadius: 16 }}>
      {slides.map((event, i) => <View key={`${event.id}:${i}`} accessibilityElementsHidden={i !== active} importantForAccessibility={i === active ? 'auto' : 'no-hide-descendants'} accessibilityLabel={`${events.length}개 중 ${((i - 1 + events.length) % events.length) + 1}번째 배너`} style={{ width }}><Banner event={event} onPause={setPaused} /></View>)}
    </ScrollView> : <Banner event={events[0]} />}
  </View>;
}

const styles = StyleSheet.create({ banner: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16 }, avatar: { height: 36, width: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, cta: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 } });
