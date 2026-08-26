import { StyleSheet, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

function Bar({ height, width }: { height: number; width: number | `${number}%` }) {
  const { theme } = useMinionTheme();
  return <View style={{ backgroundColor: theme.surfaceMuted, borderRadius: 4, height, width }} />;
}

export function PlayerDetailLoadingSkeleton() {
  const { theme } = useMinionTheme();
  return (
    <View accessibilityLabel="선수 정보를 불러오는 중입니다" style={styles.page}>
      <View style={styles.profile}>
        <View style={[styles.portrait, { backgroundColor: theme.card }]} />
        <View style={styles.profileCopy}><Bar height={24} width={112} /><Bar height={14} width={144} /><Bar height={24} width={80} /></View>
      </View>
      <View style={[styles.select, { backgroundColor: theme.card, borderColor: theme.border }]}><Bar height={18} width={96} /></View>
      <View style={[styles.teamStrip, { borderColor: theme.border }]}><Bar height={30} width={82} /><Bar height={20} width={60} /><Bar height={20} width={128} /></View>
      <View>
        <View style={styles.sectionHeader}><Bar height={22} width={72} /><Bar height={14} width={112} /></View>
        <View style={[styles.radar, { backgroundColor: theme.card }]} />
        <View style={styles.axes}>{Array.from({ length: 8 }, (_, index) => <Bar height={19} key={index} width="100%" />)}</View>
      </View>
      <View><View style={styles.sectionHeader}><Bar height={22} width={72} /><Bar height={16} width={76} /></View><View style={[styles.summary, { backgroundColor: theme.card }]} /></View>
      <View><View style={styles.sectionHeader}><Bar height={22} width={54} /><Bar height={16} width={64} /></View><View style={[styles.table, { backgroundColor: theme.card }]} /></View>
      <View><View style={styles.sectionHeader}><Bar height={22} width={72} /><Bar height={36} width={104} /></View><View style={[styles.recent, { backgroundColor: theme.card }]} /></View>
      <View><View style={styles.sectionHeader}><Bar height={22} width={58} /><Bar height={16} width={128} /></View><View style={[styles.review, { backgroundColor: theme.card }]} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  axes: { gap: 12, marginTop: 24 },
  page: { gap: 28, paddingTop: 8 },
  portrait: { borderRadius: 16, height: 80, width: 80 },
  profile: { alignItems: 'flex-start', flexDirection: 'row', gap: 16, minHeight: 91 },
  profileCopy: { gap: 8, paddingTop: 2 },
  radar: { alignSelf: 'center', borderRadius: 140, height: 280, width: 280 },
  recent: { borderRadius: 8, height: 232 },
  review: { borderRadius: 12, height: 64 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  select: { alignItems: 'center', borderRadius: 12, borderWidth: 1, height: 44, justifyContent: 'center' },
  summary: { borderRadius: 8, height: 84 },
  table: { borderRadius: 8, height: 257 },
  teamStrip: { alignItems: 'center', borderRadius: 16, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 16, height: 100, paddingHorizontal: 20, paddingVertical: 14 },
});
