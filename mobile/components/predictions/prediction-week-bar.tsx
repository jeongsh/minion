import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Coins from 'lucide-react-native/icons/coins';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

/** 웹 대회 필터 칩 레일은 sm(640px) 미만에서 숨겨지므로 모바일엔 주간 이동 + 보유 LP만 보여준다. */
export function PredictionWeekBar({ balance, canGoNext, canGoPrev, onNext, onPrev, weekKey }: { balance: number | null; canGoNext: boolean; canGoPrev: boolean; onNext: () => void; onPrev: () => void; weekKey: string }) {
  const { colorScheme, fonts, theme } = useMinionTheme();

  return (
    <View style={[styles.bar, { backgroundColor: colorScheme === 'dark' ? theme.surfaceMuted : theme.surface, borderColor: theme.border }]}>
      <View style={styles.nav}>
        <Pressable accessibilityLabel="이전 주" disabled={!canGoPrev} onPress={onPrev} style={[styles.navButton, !canGoPrev && styles.navButtonDisabled]}>
          <ChevronLeft color={theme.muted} size={18} />
        </Pressable>
        <Text style={[styles.weekLabel, { color: theme.ink, fontFamily: fonts.black }]}>{weekKey.replaceAll('-', '.')}</Text>
        <Pressable accessibilityLabel="다음 주" disabled={!canGoNext} onPress={onNext} style={[styles.navButton, !canGoNext && styles.navButtonDisabled]}>
          <ChevronRight color={theme.muted} size={18} />
        </Pressable>
      </View>
      <View style={[styles.balance, { backgroundColor: theme.surfaceMuted }]}>
        <Coins color={theme.ink} size={16} />
        <Text style={[styles.balanceText, { color: theme.ink, fontFamily: fonts.black }]}>{balance === null ? '로그인' : `${balance.toLocaleString('ko-KR')} LP`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { alignItems: 'center', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'space-between', padding: 16 },
  balance: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 6, height: 36, marginLeft: 'auto', paddingHorizontal: 10 },
  balanceText: { fontSize: 13, lineHeight: 19.5 },
  nav: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  navButton: { alignItems: 'center', borderRadius: 8, height: 36, justifyContent: 'center', width: 36 },
  navButtonDisabled: { opacity: 0.3 },
  weekLabel: { fontSize: 15, lineHeight: 22.5, minWidth: 118, textAlign: 'center' },
});
