import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

const CARD_GAP = 12;

function Bone({ style }: { style?: StyleProp<ViewStyle> }) {
  const { theme } = useMinionTheme();
  return <View style={[styles.bone, { backgroundColor: theme.surfaceMuted }, style]} />;
}

function SectionTitleSkeleton() {
  return (
    <View style={styles.sectionTitleRow}>
      <Bone style={styles.sectionTitle} />
      <Bone style={styles.sectionAction} />
    </View>
  );
}

export function HomeLoadingSkeleton() {
  const { width } = useWindowDimensions();
  const { theme } = useMinionTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;
  const contentWidth = width - 32;
  const matchWidth = (contentWidth - CARD_GAP * 0.1) / 1.1;

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
    <Animated.View accessibilityLabel="메인 콘텐츠 불러오는 중" accessibilityRole="progressbar" style={[styles.root, { opacity }]}>
      <View style={[styles.matchCard, { backgroundColor: theme.card, width: matchWidth }]}>
        <View style={styles.between}>
          <Bone style={styles.matchMeta} />
          <Bone style={styles.matchDate} />
        </View>
        <View style={styles.matchTeams}>
          <Bone style={styles.teamName} />
          <Bone style={styles.teamLogo} />
          <Bone style={styles.score} />
          <Bone style={styles.teamLogo} />
          <Bone style={styles.teamName} />
        </View>
        <Bone style={styles.odds} />
      </View>
      <Bone style={styles.calendar} />

      <View style={styles.newsSection}>
        <SectionTitleSkeleton />
        <Bone style={{ borderRadius: 8, height: contentWidth * 9 / 16, width: contentWidth }} />
        <Bone style={styles.leadTitle} />
        <Bone style={styles.leadMeta} />
        <View style={styles.newsRows}>
          {Array.from({ length: 3 }, (_, index) => (
            <View key={index} style={[styles.newsRow, { borderBottomColor: theme.divider }]}>
              <Bone style={styles.newsThumb} />
              <View style={styles.flex}>
                <Bone style={styles.rowTitle} />
                <Bone style={styles.rowTitleShort} />
                <Bone style={styles.rowMeta} />
              </View>
            </View>
          ))}
        </View>
      </View>

      <Bone style={[styles.ad, { backgroundColor: theme.adSurface }]} />

      <View style={styles.section40}>
        <SectionTitleSkeleton />
        {Array.from({ length: 5 }, (_, index) => (
          <View key={index} style={[styles.postRow, { borderBottomColor: theme.divider }]}>
            <View style={styles.flex}>
              <Bone style={styles.postTitle} />
              <Bone style={styles.postMeta} />
            </View>
            {index % 2 === 0 ? <Bone style={styles.postThumb} /> : null}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ad: { borderRadius: 16, height: 100, marginTop: 32, width: '100%' },
  between: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  bone: { borderRadius: 6 },
  calendar: { borderRadius: 10, height: 44, marginTop: 12, width: '100%' },
  flex: { flex: 1, minWidth: 0 },
  leadMeta: { height: 12, marginTop: 8, width: '38%' },
  leadTitle: { height: 16, marginTop: 10, width: '88%' },
  matchCard: { borderRadius: 12, minHeight: 112, padding: 12 },
  matchDate: { height: 10, width: 54 },
  matchMeta: { height: 10, width: 100 },
  matchTeams: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 13 },
  newsRow: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingVertical: 12 },
  newsRows: { marginTop: 20 },
  newsSection: { marginTop: 32 },
  newsThumb: { borderRadius: 8, height: 58.5, width: 104 },
  odds: { borderRadius: 999, height: 4, marginTop: 15, width: '100%' },
  postMeta: { height: 10, marginTop: 7, width: '42%' },
  postRow: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', gap: 10, minHeight: 58, paddingVertical: 8 },
  postThumb: { borderRadius: 8, height: 44, width: 64 },
  postTitle: { height: 13, width: '82%' },
  root: { paddingBottom: 20 },
  rowMeta: { height: 10, marginTop: 'auto', width: '46%' },
  rowTitle: { height: 13, width: '94%' },
  rowTitleShort: { height: 13, marginTop: 6, width: '68%' },
  score: { borderRadius: 6, height: 30, width: 54 },
  section40: { marginTop: 40 },
  sectionAction: { height: 12, width: 52 },
  sectionTitle: { height: 18, width: 76 },
  sectionTitleRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  teamLogo: { borderRadius: 14, height: 28, width: 28 },
  teamName: { height: 14, width: 42 },
});
