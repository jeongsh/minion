import CalendarDays from 'lucide-react-native/icons/calendar-days';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/feedback-states';
import { MinionScreen } from '@/components/minion-screen';
import { ScheduleCalendarDialog } from '@/components/schedule/schedule-calendar-dialog';
import { ScheduleFilterSheet, type ScheduleFilterState } from '@/components/schedule/schedule-filter-sheet';
import { ScheduleLoadingSkeleton } from '@/components/schedule/schedule-loading-skeleton';
import { ScheduleMatchList } from '@/components/schedule/schedule-match-list';
import { ScheduleWeekScroller } from '@/components/schedule/schedule-week-scroller';
import { SCHEDULE_SEGMENTS } from '@/constants/schedule-segments';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileScheduleDto, MobileTeamsDto } from '@/lib/api-client';
import { currentKSTMonthYear, dateKeyKST, weekDatesKST } from '@/lib/schedule-dates';

function segmentMessageLabel(segment: ScheduleFilterState['segment'], year: number) {
  if (segment === 'all') return `${year} 전체`;
  return SCHEDULE_SEGMENTS.find((item) => item.key === segment)?.label ?? `${year} 전체`;
}

function buildQuery(filter: ScheduleFilterState) {
  const params = new URLSearchParams();
  params.set('year', String(filter.year));
  params.set('month', String(filter.month));
  if (filter.segment !== 'all') params.set('segment', filter.segment);
  if (filter.teamId !== 'all') params.set('team', filter.teamId);
  return params.toString();
}

export default function ScheduleScreen() {
  const { theme } = useMinionTheme();
  const defaults = useMemo(() => currentKSTMonthYear(), []);
  const [filter, setFilter] = useState<ScheduleFilterState>({ month: defaults.month, segment: 'all', teamId: 'all', year: defaults.year });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const query = buildQuery(filter);
  const { data, error, loading, refresh } = useCachedQuery<MobileScheduleDto>(`/api/mobile/v1/schedule?${query}`);
  const { data: teamsData } = useCachedQuery<MobileTeamsDto>('/api/mobile/v1/teams');

  const currentWeek = useMemo(() => weekDatesKST(), []);
  const todayKey = dateKeyKST(new Date());

  if (loading && !data) {
    return (
      <MinionScreen contentStyle={styles.content}>
        <ScheduleLoadingSkeleton />
      </MinionScreen>
    );
  }

  if (error && !data) {
    return (
      <MinionScreen contentStyle={styles.content}>
        <ErrorState onRetry={refresh} />
      </MinionScreen>
    );
  }

  if (!data) return null;

  const emptyMessage = `${filter.year}년 ${filter.month}월 · ${segmentMessageLabel(filter.segment, filter.year)} 조건에 해당하는 경기가 없습니다.`;

  return (
    <>
      <MinionScreen contentStyle={styles.content}>
        <ScheduleWeekScroller dates={currentWeek} todayKey={todayKey} />
        <View style={styles.list}>
          <ScheduleMatchList emptyMessage={emptyMessage} matches={data.matches} />
        </View>
      </MinionScreen>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        <View pointerEvents="box-none" style={styles.fabRow}>
          <Pressable
            accessibilityLabel="캘린더 열기"
            onPress={() => setCalendarOpen(true)}
            style={[styles.fab, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <CalendarDays color={theme.ink} size={20} />
          </Pressable>
          <Pressable
            accessibilityLabel="필터 열기"
            onPress={() => setFilterOpen(true)}
            style={[styles.fab, { backgroundColor: theme.ink, borderColor: theme.border }]}>
            <SlidersHorizontal color={theme.surface} size={20} />
          </Pressable>
        </View>
      </View>

      <ScheduleCalendarDialog
        activeMonth={filter.month}
        activeYear={filter.year}
        matches={data.matches}
        onClose={() => setCalendarOpen(false)}
        open={calendarOpen}
      />
      <ScheduleFilterSheet
        filter={filter}
        onApply={setFilter}
        onClose={() => setFilterOpen(false)}
        open={filterOpen}
        teams={teamsData?.items ?? []}
        years={data.filters.years}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: 0, paddingBottom: 0 },
  fab: { alignItems: 'center', borderRadius: 24, borderWidth: 1, height: 48, justifyContent: 'center', width: 48 },
  fabRow: { bottom: 18, flexDirection: 'row', gap: 8, position: 'absolute', right: 16 },
  list: { marginTop: 28 },
});
