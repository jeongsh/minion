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
      <Bone style={{ height: 238 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Bone style={{ height: 22, width: 80 }} /><Bone style={{ height: 38, width: 112 }} /></View>
      <View style={styles.rows}>{[0, 1].map((team) => <View key={team}><Bone style={{ height: 40 }} />{Array.from({ length: 5 }, (_, index) => <Bone key={index} style={{ borderRadius: 0, height: index ? 59 : 58 }} />)}</View>)}</View>
      <View style={{ gap: 12 }}><Bone style={{ height: 22, width: 48 }} /><View style={{ gap: 8, padding: 12 }}>{[0, 1].map((team) => <View key={team} style={{ flexDirection: 'row', gap: 4 }}>{Array.from({ length: 5 }, (_, index) => <Bone key={index} style={{ flex: 1, height: 64 }} />)}</View>)}</View><Bone style={{ height: 320 }} /><Bone style={{ height: 224 }} /><Bone style={{ height: 186 }} /></View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bone: { borderRadius: 6 },
  root: { gap: 16 },
  rows: { gap: 8, marginTop: 8 },
});
