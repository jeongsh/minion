import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

function Bone({ style }: { style?: StyleProp<ViewStyle> }) {
  const { theme } = useMinionTheme();
  return <View style={[styles.bone, { backgroundColor: theme.surfaceMuted }, style]} />;
}

function MatchRowSkeleton() {
  return (
    <View style={styles.row}>
      <View style={styles.rowMeta}>
        <Bone style={{ height: 16, width: 128 }} />
        <Bone style={{ height: 16, width: 96 }} />
      </View>
      <Bone style={{ borderRadius: 12, height: 76 }} />
    </View>
  );
}

export function PredictionLoadingSkeleton() {
  const { theme } = useMinionTheme();
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
    <Animated.View accessibilityLabel="승부예측 불러오는 중" accessibilityRole="progressbar" style={[styles.root, { opacity }]}>
      <View style={[styles.topBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Bone style={{ borderRadius: 8, height: 36, width: 176 }} />
        <Bone style={{ borderRadius: 8, height: 28, width: 96 }} />
      </View>
      <View style={styles.sections}>
        {Array.from({ length: 2 }, (_, section) => (
          <View key={section} style={styles.section}>
            <Bone style={{ height: 24, width: 96 }} />
            <View style={styles.rows}>
              {Array.from({ length: 3 }, (_, row) => (
                <MatchRowSkeleton key={row} />
              ))}
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bone: { borderRadius: 6 },
  root: { gap: 36 },
  row: { gap: 8 },
  rowMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  rows: { gap: 20, marginTop: 12 },
  section: { gap: 12 },
  sections: { gap: 40 },
  topBar: { alignItems: 'center', borderRadius: 16, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
});
