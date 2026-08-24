import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

function Bone({ style }: { style?: StyleProp<ViewStyle> }) {
  const { theme } = useMinionTheme();
  return <View style={[styles.bone, { backgroundColor: theme.surfaceMuted }, style]} />;
}

function TableRow({ isLast }: { isLast: boolean }) {
  const { theme } = useMinionTheme();
  return (
    <View style={[styles.tableRow, !isLast && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
      <Bone style={{ height: 16, width: 16 }} />
      <Bone style={{ borderRadius: 18, height: 36, width: 36 }} />
      <Bone style={{ flex: 1, height: 16 }} />
      <Bone style={{ height: 16, width: 32 }} />
      <Bone style={{ height: 16, width: 32 }} />
    </View>
  );
}

export function TournamentLoadingSkeleton() {
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
    <Animated.View accessibilityLabel="대회 정보 불러오는 중" accessibilityRole="progressbar" style={[styles.root, { opacity }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Bone style={{ borderRadius: 20, height: 40, width: 40 }} />
          <View style={styles.headerText}>
            <Bone style={{ height: 12, width: 80 }} />
            <Bone style={{ height: 28, width: 160 }} />
          </View>
        </View>
        <Bone style={{ borderRadius: 12, height: 40, width: 96 }} />
      </View>

      <View style={styles.switcherRow}>
        {Array.from({ length: 4 }, (_, index) => (
          <Bone key={index} style={{ borderRadius: 12, height: 40, width: 96 }} />
        ))}
      </View>

      <View style={[styles.tabsBlock, { borderBottomColor: theme.border }]}>
        <View style={styles.tabsRow}>
          <Bone style={{ height: 36, width: 80 }} />
          <Bone style={{ height: 36, width: 96 }} />
          <Bone style={{ height: 36, width: 96 }} />
        </View>
        <View style={styles.pillRow}>
          <Bone style={{ borderRadius: 8, height: 36, width: 80 }} />
          <Bone style={{ borderRadius: 8, height: 36, width: 80 }} />
          <Bone style={{ borderRadius: 8, height: 36, width: 80 }} />
        </View>
      </View>

      <View style={[styles.card, { borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Bone style={{ height: 20, width: 112 }} />
        </View>
        {Array.from({ length: 5 }, (_, index) => (
          <TableRow isLast={index === 4} key={index} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bone: { borderRadius: 6 },
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  cardHeader: { padding: 16 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  headerLeft: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  headerText: { gap: 8 },
  pillRow: { flexDirection: 'row', gap: 4 },
  root: { gap: 24 },
  switcherRow: { flexDirection: 'row', gap: 8 },
  tabsBlock: { borderBottomWidth: 1, gap: 12, paddingBottom: 12 },
  tabsRow: { flexDirection: 'row', gap: 20 },
  tableRow: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 10 },
});
