import CalendarDays from 'lucide-react-native/icons/calendar-days';
import { useFocusEffect } from 'expo-router';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/feedback-states';
import { MinionScreen } from '@/components/minion-screen';
import { ScheduleCalendarDialog } from '@/components/schedule/schedule-calendar-dialog';
import { ScheduleFilterSheet, type ScheduleFilterState } from '@/components/schedule/schedule-filter-sheet';
import { ScheduleLoadingSkeleton } from '@/components/schedule/schedule-loading-skeleton';
import { ScheduleMatchList } from '@/components/schedule/schedule-match-list';
import { SCHEDULE_WEEK_SCROLLER_HEIGHT, scheduleTargetForDate, ScheduleWeekScroller } from '@/components/schedule/schedule-week-scroller';
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
  const insets = useSafeAreaInsets();
  const defaults = useMemo(() => currentKSTMonthYear(), []);
  const [filter, setFilter] = useState<ScheduleFilterState>({ month: defaults.month, segment: 'all', teamId: 'all', year: defaults.year });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const listOffsetRef = useRef<number | null>(null);
  const sectionOffsetsRef = useRef(new Map<string, number>());
  const autoScrolledRef = useRef<string | null>(null);
  const [scrollRequest, setScrollRequest] = useState<{ animated: boolean; y: number } | null>(null);

  const query = buildQuery(filter);
  const { data, error, loading, refresh } = useCachedQuery<MobileScheduleDto>(`/api/mobile/v1/schedule?${query}`);
  const { data: teamsData } = useCachedQuery<MobileTeamsDto>('/api/mobile/v1/teams');

  const currentWeek = useMemo(() => weekDatesKST(), []);
  const todayKey = dateKeyKST(new Date());
  const availableDateKeys = useMemo(
    () => Array.from(new Set((data?.matches ?? []).map((match) => dateKeyKST(match.startsAt)))),
    [data?.matches],
  );
  const scheduleLayoutKey = useMemo(
    () => `${query}:${(data?.matches ?? []).map((match) => `${match.id}@${match.startsAt}`).join('|')}`,
    [data?.matches, query],
  );
  const autoScrollTarget = scheduleTargetForDate(todayKey, availableDateKeys);

  // 섹션 y좌표는 onLayout이 실제로 갱신할 때만 값이 바뀌므로 항상 최신값으로 신뢰한다.
  // 캐시 데이터 → 실제 데이터로 교체될 때 오늘 섹션의 위치가 우연히 동일하면
  // React Native가 onLayout을 다시 쏘지 않는데, 이전에는 그 값을 데이터셋 키로
  // 걸러내다 보니 이 경우 자동 스크롤이 영영 실행되지 않는 문제가 있었다.
  const scrollToDate = useCallback((dateKey: string, animated: boolean) => {
    const listOffset = listOffsetRef.current;
    const sectionOffset = sectionOffsetsRef.current.get(dateKey);
    if (listOffset == null || sectionOffset == null) return false;

    setScrollRequest({ animated, y: listOffset + sectionOffset });
    return true;
  }, []);

  const tryInitialScroll = useCallback(() => {
    if (!autoScrollTarget) return;
    const scrollId = `${scheduleLayoutKey}:${autoScrollTarget}`;
    if (autoScrolledRef.current === scrollId) return;
    if (scrollToDate(autoScrollTarget, false)) autoScrolledRef.current = scrollId;
  }, [autoScrollTarget, scheduleLayoutKey, scrollToDate]);

  // onLayout이 재발화하지 않는 경우(위와 동일한 이유)에도 데이터셋이 바뀌면
  // 이미 저장된 좌표로 다시 한 번 스크롤을 시도한다.
  useEffect(() => {
    tryInitialScroll();
  }, [tryInitialScroll]);

  // Expo Router는 탭과 스택 화면을 언마운트하지 않고 보관할 수 있다. 일정 화면에
  // 다시 포커스될 때마다 이전 방문의 완료 표식을 지우고, 저장된 레이아웃 좌표로
  // 오늘(없으면 가장 가까운 경기일) 섹션을 다시 맞춘다.
  useFocusEffect(
    useCallback(() => {
      autoScrolledRef.current = null;
      const frame = requestAnimationFrame(tryInitialScroll);
      return () => cancelAnimationFrame(frame);
    }, [tryInitialScroll]),
  );

  const handleListLayout = useCallback(
    (event: LayoutChangeEvent) => {
      listOffsetRef.current = event.nativeEvent.layout.y;
      tryInitialScroll();
    },
    [tryInitialScroll],
  );

  const handleSectionLayout = useCallback(
    (dateKey: string, y: number) => {
      sectionOffsetsRef.current.set(dateKey, y);
      tryInitialScroll();
    },
    [tryInitialScroll],
  );

  const handleSelectDate = useCallback(
    (dateKey: string) => {
      const targetKey = scheduleTargetForDate(dateKey, availableDateKeys);
      if (targetKey) scrollToDate(targetKey, true);
    },
    [availableDateKeys, scrollToDate],
  );

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
      <MinionScreen
        contentStyle={styles.content}
        scrollRequest={scrollRequest}
        stickyHeader={
          <ScheduleWeekScroller
            availableDateKeys={availableDateKeys}
            dates={currentWeek}
            onSelectDate={handleSelectDate}
            todayKey={todayKey}
          />
        }
        stickyHeaderHeight={SCHEDULE_WEEK_SCROLLER_HEIGHT}>
        <View onLayout={handleListLayout} style={styles.list}>
          <ScheduleMatchList emptyMessage={emptyMessage} matches={data.matches} onSectionLayout={handleSectionLayout} />
        </View>
      </MinionScreen>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        <View pointerEvents="box-none" style={[styles.fabRow, { bottom: theme.size.footerDockClearance + insets.bottom }]}>
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
        events={data.calendarEvents}
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
  fabRow: { flexDirection: 'row', gap: 8, position: 'absolute', right: 16, zIndex: 60 },
  list: { marginTop: 28 },
});
