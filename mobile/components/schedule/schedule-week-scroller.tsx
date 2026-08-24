import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { WeekDate } from '@/lib/schedule-dates';

export const SCHEDULE_WEEK_SCROLLER_HEIGHT = 70;

export function scheduleTargetForDate(dateKey: string, availableDateKeys: string[]) {
  if (availableDateKeys.includes(dateKey)) return dateKey;
  return availableDateKeys.find((key) => key >= dateKey) ?? availableDateKeys.at(-1);
}

export function ScheduleWeekScroller({
  availableDateKeys,
  dates,
  onSelectDate,
  todayKey,
}: {
  availableDateKeys: string[];
  dates: WeekDate[];
  onSelectDate: (dateKey: string) => void;
  todayKey: string;
}) {
  const { fonts, theme } = useMinionTheme();

  return (
    <View style={[styles.bar, { backgroundColor: theme.pageBackground, borderBottomColor: theme.border }]}>
      <View style={[styles.grid, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {dates.map((date) => {
          const isToday = date.key === todayKey;
          const targetKey = scheduleTargetForDate(date.key, availableDateKeys);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={isToday ? { selected: true } : undefined}
              disabled={!targetKey}
              key={date.key}
              onPress={() => targetKey && onSelectDate(targetKey)}
              style={[styles.cell, isToday && { backgroundColor: theme.ink }]}>
              <Text style={[styles.weekday, { color: isToday ? theme.surface : theme.muted, fontFamily: fonts.medium }]}>{date.weekday}</Text>
              <Text style={[styles.day, { color: isToday ? theme.surface : theme.muted, fontFamily: fonts.black }]}>{date.day}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: 1, marginHorizontal: -16, paddingBottom: 7, paddingHorizontal: 16, paddingTop: 8 },
  cell: { alignItems: 'center', borderRadius: 8, flex: 1, justifyContent: 'center', minHeight: 44 },
  day: { fontSize: 14, lineHeight: 21 },
  grid: { borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 4, padding: 4 },
  weekday: { fontSize: 11, lineHeight: 16.5 },
});
