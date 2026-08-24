import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

function Bone({ style }: { style?: StyleProp<ViewStyle> }) {
  const { theme } = useMinionTheme();
  return <View style={[styles.bone, { backgroundColor: theme.surfaceMuted }, style]} />;
}

export function MatchLoadingSkeleton() {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { duration: 850, easing: Easing.inOut(Easing.ease), toValue: 0.9, useNativeDriver: true }),
        Animated.timing(opacity, { duration: 850, easing: Easing.inOut(Easing.ease), toValue: 0.5, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View accessibilityLabel="경기 상세 불러오는 중" accessibilityRole="progressbar" style={[styles.root, { opacity }]}>
      <Bone style={{ borderRadius: 8, height: 130, marginHorizontal: -16 }} />
      <Bone style={{ borderRadius: 10, height: 38 }} />
      <Bone style={{ borderRadius: 10, height: 38, width: 130 }} />
      <View style={styles.rows}>
        {Array.from({ length: 5 }, (_, index) => (
          <Bone key={index} style={{ borderRadius: 8, height: 58 }} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bone: { borderRadius: 6 },
  root: { gap: 16 },
  rows: { gap: 8, marginTop: 8 },
});
