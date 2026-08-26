import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { TOURNAMENT_LOGO_ASSETS } from '@/constants/tournament-segments';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileTournamentSegmentNavItem } from '@/lib/api-client';

export function TournamentSegmentSwitcher({ activeKey, items, onSelect }: { activeKey: string; items: MobileTournamentSegmentNavItem[]; onSelect: (key: string) => void }) {
  if (items.length <= 1) return null;

  return (
    <ScrollView contentContainerStyle={styles.content} horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      {items.map((item) => (
        <SegmentChip active={item.key === activeKey} item={item} key={item.key} onPress={() => onSelect(item.key)} />
      ))}
    </ScrollView>
  );
}

function SegmentChip({ active, item, onPress }: { active: boolean; item: MobileTournamentSegmentNavItem; onPress: () => void }) {
  const { fonts, theme } = useMinionTheme();
  const logo = item.logo ? TOURNAMENT_LOGO_ASSETS[item.logo] : undefined;
  const iconColor = active ? theme.surface : theme.muted;
  const width = Math.min(30, 14 * item.logoAspect);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? { backgroundColor: theme.ink, borderColor: theme.ink } : { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {logo ? <Image contentFit="contain" source={logo} style={{ height: 14, width }} tintColor={iconColor} /> : null}
      <Text style={[styles.chipText, { color: active ? theme.surface : theme.muted, ...fonts.black }]}>{item.name}</Text>
      {item.isOngoing ? <OngoingDot /> : null}
    </Pressable>
  );
}

function OngoingDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { duration: 1000, easing: Easing.inOut(Easing.ease), toValue: 0.4, useNativeDriver: true }),
        Animated.timing(opacity, { duration: 1000, easing: Easing.inOut(Easing.ease), toValue: 1, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.dot, { opacity }]} />;
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 6, height: 32, paddingHorizontal: 12 },
  chipText: { fontSize: 13, lineHeight: 19.5 },
  content: { gap: 6, paddingLeft: 16, paddingRight: 16 },
  dot: { backgroundColor: '#10b981', borderRadius: 3, height: 6, width: 6 },
  scroll: { marginHorizontal: -16 },
});
