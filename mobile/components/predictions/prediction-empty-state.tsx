import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

const EMPTY_BORDER = { dark: '#26735c', light: '#94dfc4' } as const;
const CHARACTER_IMAGE = require('@/assets/characters/flag-4.png');

export function PredictionEmptyState() {
  const { colorScheme, fonts, theme } = useMinionTheme();
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { duration: 1300, easing: Easing.inOut(Easing.ease), toValue: 1, useNativeDriver: true }),
        Animated.timing(bob, { duration: 1300, easing: Easing.inOut(Easing.ease), toValue: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const rotate = bob.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] });

  return (
    <View style={[styles.empty, { borderColor: EMPTY_BORDER[colorScheme] }]}>
      <Animated.View style={{ transform: [{ translateY }, { rotate }] }}>
        <Image contentFit="contain" source={CHARACTER_IMAGE} style={styles.character} />
      </Animated.View>
      <Text style={[styles.title, { color: theme.ink, ...fonts.display }]}>찍을 경기가 아직 없어요</Text>
      <Text style={[styles.body, { color: theme.muted, ...fonts.regular }]}>다른 주차나 대회를 선택하면 예측판이 다시 열려요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 14, lineHeight: 24, marginTop: 6, textAlign: 'center' },
  character: { height: 80, width: 80 },
  empty: { alignItems: 'center', borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, minHeight: 160, paddingHorizontal: 20, paddingVertical: 40 },
  title: { fontSize: 17, lineHeight: 25.5, marginTop: 8, textAlign: 'center' },
});
