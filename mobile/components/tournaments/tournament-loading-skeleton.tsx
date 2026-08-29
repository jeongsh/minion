import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { tournamentTokens } from '@/constants/tournament-theme';
import { useMinionTheme } from '@/hooks/use-minion-theme';

function Bone({ style }: { style?: StyleProp<ViewStyle> }) {
  const { theme } = useMinionTheme();
  return <View style={[styles.bone, { backgroundColor: theme.surfaceMuted }, style]} />;
}

function TableRow({ index, isLast }: { index: number; isLast: boolean }) {
  const { colorScheme } = useMinionTheme();
  const tokens = tournamentTokens[colorScheme];

  return (
    <View style={[styles.tableRow, !isLast && { borderBottomColor: tokens.border, borderBottomWidth: 1 }]}>
      <View style={styles.tableMain}>
        <Bone style={styles.rankBone} />
        <Bone style={styles.teamLogoBone} />
        <Bone style={{ height: 14, width: index % 3 === 0 ? 104 : 76 }} />
      </View>
      <View style={styles.metrics}>
        <Bone style={styles.diffBone} />
        <Bone style={styles.recordBone} />
      </View>
    </View>
  );
}

export function TournamentLoadingSkeleton() {
  const { colorScheme, theme } = useMinionTheme();
  const tokens = tournamentTokens[colorScheme];
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
        <Bone style={styles.headerLogo} />
        <Bone style={styles.headerTitle} />
      </View>

      <View style={styles.switcherRow}>
        {Array.from({ length: 5 }, (_, index) => (
          <Bone key={index} style={{ borderRadius: 8, height: 32, width: index === 0 ? 74 : 82 }} />
        ))}
      </View>

      <View style={styles.tabsBlock}>
        <View style={[styles.pillRow, { backgroundColor: theme.card }]}>
          <Bone style={styles.pillBone} />
          <Bone style={styles.pillBone} />
          <Bone style={styles.pillBone} />
        </View>
        <View style={[styles.tabsRow, { borderBottomColor: theme.border }]}>
          <Bone style={{ height: 33, width: 48 }} />
          <Bone style={{ height: 33, width: 62 }} />
          <Bone style={{ height: 33, width: 62 }} />
          <Bone style={{ height: 33, width: 62 }} />
        </View>
      </View>

      <View style={styles.groupGrid}>
        {Array.from({ length: 2 }, (_, group) => (
          <View key={group} style={styles.groupBlock}>
            <View style={styles.groupTitleRow}>
              <View style={[styles.groupTitleBar, { backgroundColor: theme.accent }]} />
              <Bone style={styles.groupTitleBone} />
            </View>
            <View style={[styles.table, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
              {Array.from({ length: 5 }, (_, index) => (
                <TableRow index={index} isLast={index === 4} key={index} />
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
  diffBone: { height: 13, width: 24 },
  groupBlock: { gap: 10 },
  groupGrid: { gap: 16 },
  groupTitleBar: { borderRadius: 999, height: 14, width: 3 },
  groupTitleBone: { height: 15, width: 80 },
  groupTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 40 },
  headerLogo: { borderRadius: 2, height: 28, width: 48 },
  headerTitle: { height: 20, width: 104 },
  metrics: { alignItems: 'center', flexDirection: 'row', flexShrink: 0, gap: 10 },
  pillBone: { borderRadius: 6, height: 28, width: 72 },
  pillRow: { alignSelf: 'flex-start', borderRadius: 8, flexDirection: 'row', gap: 2, padding: 2 },
  rankBone: { height: 14, width: 24 },
  recordBone: { height: 13, width: 52 },
  root: { gap: 24 },
  switcherRow: { flexDirection: 'row', gap: 6, marginHorizontal: -16, overflow: 'hidden', paddingLeft: 16 },
  table: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  tableMain: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 },
  tableRow: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 52, paddingHorizontal: 12, paddingVertical: 8 },
  tabsBlock: { gap: 12 },
  tabsRow: { borderBottomWidth: 1, flexDirection: 'row', gap: 16 },
  teamLogoBone: { borderRadius: 12, height: 24, width: 24 },
});
