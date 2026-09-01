import { useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { WeekDate } from '@/lib/schedule-dates';

export const SCHEDULE_WEEK_SCROLLER_HEIGHT = 70;

export function scheduleTargetForDate(dateKey: string, availableDateKeys: string[]) {
  if (availableDateKeys.includes(dateKey)) return dateKey;
  return availableDateKeys.find((key) => key >= dateKey) ?? availableDateKeys.at(-1);
}

export function ScheduleWeekScroller({
  activeDateKey,
  availableDateKeys,
  dates,
  onSelectDate,
  todayKey,
}: {
  activeDateKey?: string;
  availableDateKeys: string[];
  dates: WeekDate[];
  onSelectDate: (dateKey: string) => void;
  todayKey: string;
}) {
  const { fonts, theme } = useMinionTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const cellWidth = viewportWidth > 0 ? (viewportWidth - 34) / 7 : 44;

  useEffect(() => {
    if (!activeDateKey || viewportWidth <= 0) return;
    const index = dates.findIndex((date) => date.key === activeDateKey);
    if (index < 0) return;
    const cellStride = cellWidth + 4;
    const contentWidth = dates.length * cellWidth + Math.max(0, dates.length - 1) * 4 + 8;
    const centeredX = 4 + index * cellStride - (viewportWidth - cellWidth) / 2;
    const maxX = Math.max(0, contentWidth - viewportWidth);
    scrollRef.current?.scrollTo({ animated: true, x: Math.min(maxX, Math.max(0, centeredX)), y: 0 });
  }, [activeDateKey, cellWidth, dates, viewportWidth]);

  const handleLayout = (event: LayoutChangeEvent) => setViewportWidth(event.nativeEvent.layout.width);

  return (
    <View style={[styles.bar, { backgroundColor: theme.pageBackground, borderBottomColor: theme.border }]}>
      <ScrollView
        contentContainerStyle={styles.gridContent}
        horizontal
        onLayout={handleLayout}
        ref={scrollRef}
        showsHorizontalScrollIndicator={false}
        style={[styles.grid, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {dates.map((date) => {
          const isActive = date.key === activeDateKey;
          const isToday = date.key === todayKey;
          const targetKey = scheduleTargetForDate(date.key, availableDateKeys);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${date.day}일 ${date.weekday}요일${isToday ? ', 오늘' : ''}`}
              accessibilityState={isActive ? { selected: true } : undefined}
              disabled={!targetKey}
              key={date.key}
              onPress={() => targetKey && onSelectDate(targetKey)}
              style={[
                styles.cell,
                { width: cellWidth },
                isActive && { backgroundColor: theme.ink },
                isToday && !isActive && { borderColor: theme.ink, borderWidth: 1 },
              ]}>
              <Text style={[styles.weekday, { color: isActive ? theme.surface : theme.muted, ...fonts.medium }]}>{date.weekday}</Text>
              <Text style={[styles.day, { color: isActive ? theme.surface : theme.muted, ...fonts.medium }]}>{date.day}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: 1, marginHorizontal: -16, paddingBottom: 7, paddingHorizontal: 16, paddingTop: 8 },
  cell: { alignItems: 'center', borderRadius: 8, justifyContent: 'center', minHeight: 44 },
  day: { fontSize: 14, lineHeight: 21 },
  grid: { borderRadius: 12, borderWidth: 1 },
  gridContent: { gap: 4, padding: 4 },
  weekday: { fontSize: 13, lineHeight: 18 },
});
