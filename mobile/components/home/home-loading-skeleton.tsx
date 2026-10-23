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

      <Bone style={{ borderRadius: 16, height: 60, marginTop: 32, width: contentWidth }} />

      <View style={styles.section40}>
        <SectionTitleSkeleton />
        {Array.from({ length: 6 }, (_, index) => (
          <View key={index} style={[styles.postRow, { borderBottomColor: theme.divider }]}>
            <View style={styles.flex}>
              <Bone style={styles.postTitle} />
              <Bone style={styles.postMeta} />
            </View>
            {index % 2 === 0 ? <Bone style={styles.postThumb} /> : null}
          </View>
        ))}
      </View>
      <View style={styles.section40}><SectionTitleSkeleton />{Array.from({ length: 6 }, (_, index) => <View key={index} style={{ flexDirection: 'row', gap: 12, paddingVertical: 8, minHeight: 76 }}><Bone style={{ width: 80, height: 60 }} /><View style={{ flex: 1, justifyContent: 'center', gap: 4 }}><Bone style={{ width: '95%', height: 22 }} /><Bone style={{ width: '70%', height: 20 }} /></View></View>)}</View>
      <View style={styles.section40}><SectionTitleSkeleton /><Bone style={{ height: (contentWidth - 14.4) / 2.2 * 4 / 3, borderRadius: 16 }} /></View>
      <View style={styles.section40}><SectionTitleSkeleton /><Bone style={{ height: 96 }} /></View>
      <View style={styles.section40}><SectionTitleSkeleton /><Bone style={{ height: 220, borderRadius: 16 }} /></View>
      {[0, 1].map((key) => <View key={key} style={{ marginTop: 24 }}><SectionTitleSkeleton /><View style={{ flexDirection: 'row', gap: 12 }}>{[0, 1].map((column) => <Bone key={column} style={{ width: (contentWidth - 14.4) / 2.2, aspectRatio: 3 / 4, borderRadius: 16 }} />)}</View></View>)}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  between: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  bone: { borderRadius: 6 },
  calendar: { borderRadius: 10, height: 44, marginTop: 12, width: '100%' },
  flex: { flex: 1, minWidth: 0 },
  matchCard: { borderRadius: 12, minHeight: 119, padding: 12 },
  matchDate: { height: 10, width: 54 },
  matchMeta: { height: 10, width: 100 },
  matchTeams: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 13 },
  odds: { borderRadius: 999, height: 4, marginTop: 15, width: '100%' },
  postMeta: { height: 10, marginTop: 7, width: '42%' },
  postRow: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', gap: 12, minHeight: 65, paddingVertical: 8 },
  postThumb: { borderRadius: 8, height: 44, width: 64 },
  postTitle: { height: 13, width: '82%' },
  root: { paddingBottom: 20 },
  score: { borderRadius: 6, height: 30, width: 54 },
  section40: { marginTop: 40 },
  sectionAction: { height: 12, width: 52 },
  sectionTitle: { height: 18, width: 76 },
  sectionTitleRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  teamLogo: { borderRadius: 14, height: 28, width: 28 },
  teamName: { height: 14, width: 42 },
});
