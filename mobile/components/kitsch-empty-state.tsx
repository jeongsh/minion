import { Image } from 'expo-image';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

const CHARACTER_IMAGES = {
  flag: require('@/assets/characters/flag-4.png'),
  marker: require('@/assets/characters/pen-4.png'),
  megapon: require('@/assets/characters/megapon-1.png'),
} as const;
const EMPTY_BORDER = { dark: '#26735c', light: '#94dfc4' } as const;

type KitschCharacter = keyof typeof CHARACTER_IMAGES;

export function KitschEmptyState({
  action,
  animated = false,
  body,
  character = 'marker',
  compact = false,
  plain = false,
  title,
}: {
  action?: ReactNode;
  animated?: boolean;
  body?: string;
  character?: KitschCharacter;
  compact?: boolean;
  plain?: boolean;
  title: string;
}) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { duration: 1300, easing: Easing.inOut(Easing.ease), toValue: 1, useNativeDriver: true }),
        Animated.timing(bob, { duration: 1300, easing: Easing.inOut(Easing.ease), toValue: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, bob]);

  const transform = animated
    ? [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }, { rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] }) }]
    : undefined;

  return (
    <View style={[styles.root, compact ? styles.compact : styles.regular, plain ? null : { borderColor: EMPTY_BORDER[colorScheme], borderStyle: 'dashed', borderWidth: 2 }]}>
      <Animated.View style={transform ? { transform } : undefined}>
        <Image contentFit="contain" source={CHARACTER_IMAGES[character]} style={compact ? styles.compactCharacter : styles.character} />
      </Animated.View>
      <Text style={[compact ? styles.compactTitle : styles.title, { color: theme.ink, ...fonts.display }]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: theme.muted, ...fonts.regular }]}>{body}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: { marginTop: 16 },
  body: { fontSize: 14, lineHeight: 24, marginTop: 6, maxWidth: 384, textAlign: 'center' },
  character: { height: 80, width: 80 },
  compact: { minHeight: 112, paddingHorizontal: 20, paddingVertical: 20 },
  compactCharacter: { height: 56, width: 56 },
  compactTitle: { fontSize: 15, lineHeight: 22.5, marginTop: 8, textAlign: 'center' },
  regular: { minHeight: 160, paddingHorizontal: 20, paddingVertical: 40 },
  root: { alignItems: 'center', borderRadius: 16, justifyContent: 'center' },
  title: { fontSize: 17, lineHeight: 25.5, marginTop: 8, textAlign: 'center' },
});
