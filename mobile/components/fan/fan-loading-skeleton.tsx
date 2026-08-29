import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

export function FanLoadingSkeleton({ section = 'home' }: { section?: 'home' | 'players' | 'schedule' | 'social' | 'videos' }) {
  const { theme } = useMinionTheme();
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { duration: 800, easing: Easing.inOut(Easing.ease), toValue: 0.9, useNativeDriver: true }),
      Animated.timing(opacity, { duration: 800, easing: Easing.inOut(Easing.ease), toValue: 0.55, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  if (section === 'players') {
    return <Animated.View accessibilityLabel="선수단을 불러오는 중입니다" style={[styles.grid, { opacity }]}>{Array.from({ length: 8 }, (_, index) => <View key={index} style={[styles.player, { backgroundColor: theme.card, borderColor: theme.border }]}><View style={[styles.playerImage, { backgroundColor: theme.surfaceMuted }]} /><Bone height={16} width="56%" /><Bone height={13} width="76%" /></View>)}</Animated.View>;
  }

  if (section === 'social') {
    return <Animated.View accessibilityLabel="소셜 피드를 불러오는 중입니다" style={[styles.socialGrid, { opacity }]}>{Array.from({ length: 12 }, (_, index) => <View key={index} style={[styles.social, { backgroundColor: theme.surfaceMuted }]} />)}</Animated.View>;
  }

  if (section === 'videos') {
    return <Animated.View accessibilityLabel="영상을 불러오는 중입니다" style={[styles.grid, { opacity }]}>{Array.from({ length: 8 }, (_, index) => <View key={index} style={styles.video}><View style={[styles.videoImage, { backgroundColor: theme.surfaceMuted }]} /><Bone height={13} width="94%" /><Bone height={12} width="45%" /></View>)}</Animated.View>;
  }

  if (section === 'schedule') {
    return <Animated.View accessibilityLabel="경기 일정을 불러오는 중입니다" style={[styles.schedule, { opacity }]}><Bone height={25} width="32%" />{Array.from({ length: 3 }, (_, index) => <View key={index} style={[styles.scheduleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>{Array.from({ length: 2 }, (_, row) => <View key={row} style={styles.scheduleRow}><Bone height={14} width={42} /><Bone height={30} width="68%" /></View>)}</View>)}</Animated.View>;
  }

  return (
    <Animated.View accessibilityLabel="팬페이지를 불러오는 중입니다" style={[styles.home, { opacity }]}>
      <View style={[styles.hero, { backgroundColor: theme.surfaceMuted }]}><View style={[styles.logo, { backgroundColor: theme.surface }]} /><View style={styles.heroText}><Bone height={24} width="68%" /><Bone height={38} width={172} /></View></View>
      <HomeSection themeColor={theme.surfaceMuted} kind="match" />
      <HomeSection themeColor={theme.surfaceMuted} kind="community" />
      <HomeSection themeColor={theme.surfaceMuted} kind="social" />
      <HomeSection themeColor={theme.surfaceMuted} kind="video" />
      <HomeSection themeColor={theme.surfaceMuted} kind="roster" />
    </Animated.View>
  );
}

function Bone({ height, width }: { height: number; width: number | `${number}%` }) {
  const { theme } = useMinionTheme();
  return <View style={{ backgroundColor: theme.surfaceMuted, borderRadius: 6, height, width }} />;
}

function HomeSection({ kind, themeColor }: { kind: 'community' | 'match' | 'roster' | 'social' | 'video'; themeColor: string }) {
  const count = kind === 'match' ? 1 : kind === 'community' ? 3 : 3;
  const height = kind === 'match' ? 56 : kind === 'community' ? 65 : kind === 'social' ? 152 : kind === 'video' ? 170 : 148;
  return <View style={styles.homeSection}><Bone height={16} width="24%" /><View style={[styles.homeRail, kind === 'community' ? styles.communitySkeleton : null]}>{Array.from({ length: count }, (_, index) => <View key={index} style={{ backgroundColor: themeColor, borderRadius: kind === 'social' || kind === 'roster' ? 12 : kind === 'community' ? 0 : 8, height, width: kind === 'match' || kind === 'community' ? '100%' : kind === 'video' ? 302 : kind === 'roster' ? 112 : 114 }} />)}</View></View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, paddingVertical: 20 },
  communitySkeleton: { borderRadius: 12, flexDirection: 'column', gap: 1, overflow: 'hidden' },
  hero: { alignItems: 'flex-end', flexDirection: 'row', gap: 16, height: 132, paddingBottom: 20, paddingHorizontal: 16 },
  heroText: { gap: 8 },
  home: { gap: 20 },
  homeRail: { flexDirection: 'row', gap: 8, overflow: 'hidden' },
  homeSection: { gap: 12, paddingHorizontal: 16 },
  logo: { borderRadius: 12, height: 68, width: 68 },
  player: { borderRadius: 16, borderWidth: 1, gap: 8, overflow: 'hidden', paddingBottom: 12, width: '48.6%' },
  playerImage: { aspectRatio: 4 / 5, width: '100%' },
  schedule: { gap: 20, paddingHorizontal: 16, paddingVertical: 20 },
  scheduleCard: { borderRadius: 16, borderWidth: 1, gap: 1, overflow: 'hidden' },
  scheduleRow: { alignItems: 'center', flexDirection: 'row', gap: 16, minHeight: 66, paddingHorizontal: 12 },
  social: { aspectRatio: 3 / 4, width: '33.15%' },
  socialGrid: { backgroundColor: '#000000', flexDirection: 'row', flexWrap: 'wrap', gap: 1 },
  video: { gap: 8, width: '48.6%' },
  videoImage: { aspectRatio: 16 / 9, borderRadius: 8, width: '100%' },
});
