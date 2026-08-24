import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

function Bone({ style }: { style?: StyleProp<ViewStyle> }) {
  const { theme } = useMinionTheme();
  return <View style={[styles.bone, { backgroundColor: theme.surfaceMuted }, style]} />;
}

function MatchRowSkeleton({ isLast }: { isLast: boolean }) {
  const { theme } = useMinionTheme();
  return (
    <View style={[styles.matchRow, !isLast && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
      <View style={styles.matchRowTime}>
        <Bone style={{ height: 16, width: 40 }} />
        <Bone style={{ height: 12, width: 32 }} />
      </View>
      <View style={styles.matchRowTeams}>
        <View style={styles.matchRowSide}>
          <Bone style={{ height: 16, width: 56 }} />
          <Bone style={{ borderRadius: 16, height: 32, width: 32 }} />
        </View>
        <Bone style={{ alignSelf: 'center', height: 20, width: 32 }} />
        <View style={styles.matchRowSideReverse}>
          <Bone style={{ borderRadius: 16, height: 32, width: 32 }} />
          <Bone style={{ height: 16, width: 56 }} />
        </View>
      </View>
    </View>
  );
}

export function ScheduleLoadingSkeleton() {
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
    <Animated.View accessibilityLabel="일정 불러오는 중" accessibilityRole="progressbar" style={[styles.root, { opacity }]}>
      <View style={[styles.topBar, { borderBottomColor: theme.border, marginHorizontal: -16, paddingHorizontal: 16 }]}>
        <Bone style={{ borderRadius: 8, height: 36, width: 36 }} />
        <Bone style={{ borderRadius: 8, height: 36, width: 112 }} />
        <Bone style={{ borderRadius: 8, height: 36, width: 36 }} />
      </View>
      <View style={styles.sections}>
        {Array.from({ length: 3 }, (_, day) => (
          <View key={day}>
            <View style={styles.sectionHeading}>
              <Bone style={{ height: 24, width: 96 }} />
              {day === 0 ? <Bone style={{ borderRadius: 999, height: 24, width: 48 }} /> : null}
            </View>
            <View style={[styles.sectionCard, { borderColor: theme.border }]}>
              {(() => {
                const rowCount = day === 0 ? 3 : 2;
                return Array.from({ length: rowCount }, (_, row) => <MatchRowSkeleton isLast={row === rowCount - 1} key={row} />);
              })()}
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bone: { borderRadius: 6 },
  matchRow: { flexDirection: 'row', gap: 10, minHeight: 66, paddingHorizontal: 12, paddingVertical: 12 },
  matchRowSide: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  matchRowSideReverse: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8 },
  matchRowTeams: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8 },
  matchRowTime: { gap: 8, width: 48 },
  root: { paddingBottom: 8 },
  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 12 },
  sections: { gap: 32, paddingTop: 28 },
  topBar: { borderBottomWidth: 1, flexDirection: 'row', gap: 8, paddingVertical: 12 },
});
