import { StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { WeekDate } from '@/lib/schedule-dates';

/**
 * 웹은 헤더 밑에 position:sticky로 붙지만, MinionScreen이 스크롤 ref/offset을 노출하지 않아
 * 이 화면에서는 붙잡을 수 없다. 정적 배치로 구현하고(정지 상태 좌표는 1px로 일치),
 * "고정 유지"·"오늘 탭→스크롤" 두 동작은 별도 통합 변경(ref 노출)이 합의될 때까지 보류한다.
 */
export function ScheduleWeekScroller({ dates, todayKey }: { dates: WeekDate[]; todayKey: string }) {
  const { fonts, theme } = useMinionTheme();

  return (
    <View style={[styles.bar, { backgroundColor: theme.pageBackground, borderBottomColor: theme.border }]}>
      <View style={[styles.grid, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {dates.map((date) => {
          const isToday = date.key === todayKey;
          return (
            <View accessibilityState={isToday ? { selected: true } : undefined} key={date.key} style={[styles.cell, isToday && { backgroundColor: theme.ink }]}>
              <Text style={[styles.weekday, { color: isToday ? theme.surface : theme.muted, fontFamily: fonts.medium }]}>{date.weekday}</Text>
              <Text style={[styles.day, { color: isToday ? theme.surface : theme.muted, fontFamily: fonts.black }]}>{date.day}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: 1, marginHorizontal: -16, paddingHorizontal: 16, paddingVertical: 8 },
  cell: { alignItems: 'center', borderRadius: 8, flex: 1, justifyContent: 'center', minHeight: 44 },
  day: { fontSize: 14, lineHeight: 21 },
  grid: { borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 4, padding: 4 },
  weekday: { fontSize: 11, lineHeight: 16.5 },
});
