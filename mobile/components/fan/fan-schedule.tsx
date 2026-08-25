import Check from 'lucide-react-native/icons/check';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ErrorState } from '@/components/feedback-states';
import { FanLoadingSkeleton } from '@/components/fan/fan-loading-skeleton';
import { ScheduleMatchList } from '@/components/schedule/schedule-match-list';
import { SCHEDULE_SEGMENTS, type ScheduleSegmentKey } from '@/constants/schedule-segments';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileScheduleDto, MobileTeamSummary } from '@/lib/api-client';
import { currentKSTMonthYear } from '@/lib/schedule-dates';

type FanScheduleFilter = { month: number; segment: ScheduleSegmentKey | 'all'; year: number };
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export function FanSchedule({ team }: { team: MobileTeamSummary }) {
  const defaults = useMemo(() => currentKSTMonthYear(), []);
  const { fonts, theme } = useMinionTheme();
  const [filter, setFilter] = useState<FanScheduleFilter>({ month: defaults.month, segment: 'all', year: defaults.year });
  const [filterOpen, setFilterOpen] = useState(false);
  const path = `/api/mobile/v1/schedule?year=${filter.year}&month=${filter.month}&segment=${filter.segment}&team=${encodeURIComponent(team.id)}`;
  const { data, error, loading, refresh } = useCachedQuery<MobileScheduleDto>(path);

  useEffect(() => {
    if (!data) return;
    if (data.filters.activeYear !== filter.year || data.filters.activeMonth !== filter.month || data.filters.activeSegment !== filter.segment) {
      setFilter({ month: data.filters.activeMonth, segment: data.filters.activeSegment as FanScheduleFilter['segment'], year: data.filters.activeYear });
    }
  }, [data, filter]);

  if (loading && !data) return <FanLoadingSkeleton section="schedule" />;
  if (error && !data) return <View style={styles.error}><ErrorState onRetry={refresh} title={error} /></View>;

  return (
    <View style={styles.page}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.display }]}>경기 일정</Text>
        <Pressable onPress={() => setFilterOpen(true)} style={[styles.filterButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
          <SlidersHorizontal color={theme.ink} size={18} />
          <Text style={{ color: theme.ink, fontFamily: fonts.black, fontSize: 14, lineHeight: 20 }}>필터</Text>
        </Pressable>
      </View>
      <ScheduleMatchList emptyMessage={`${team.shortName}의 선택한 기간 경기가 없습니다. 기간 필터를 바꿔보세요.`} matches={data?.matches ?? []} />
      <FanScheduleFilterSheet
        filter={filter}
        onApply={setFilter}
        onClose={() => setFilterOpen(false)}
        open={filterOpen}
        teamName={team.shortName}
        years={data?.filters.years ?? [filter.year]}
      />
    </View>
  );
}

function FanScheduleFilterSheet({ filter, onApply, onClose, open, teamName, years }: {
  filter: FanScheduleFilter;
  onApply: (filter: FanScheduleFilter) => void;
  onClose: () => void;
  open: boolean;
  teamName: string;
  years: number[];
}) {
  const { fonts, theme } = useMinionTheme();
  const [draft, setDraft] = useState(filter);

  useEffect(() => {
    if (open) setDraft(filter);
  }, [filter, open]);

  return (
    <BottomSheet onClose={onClose} open={open} title={`${teamName} 일정 필터`}>
      <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
        <FilterGroup label="연도">
          <View style={styles.chips}>{years.map((year) => <Choice active={draft.year === year} key={year} label={String(year)} onPress={() => setDraft((current) => ({ ...current, year }))} />)}</View>
        </FilterGroup>
        <FilterGroup label="월">
          <View style={styles.chips}>{MONTHS.map((month) => <Choice active={draft.month === month} key={month} label={`${month}월`} onPress={() => setDraft((current) => ({ ...current, month }))} />)}</View>
        </FilterGroup>
        <FilterGroup label="대회">
          <View style={styles.segmentList}>{SCHEDULE_SEGMENTS.map((segment) => <Choice active={draft.segment === segment.key} full key={segment.key} label={segment.label} onPress={() => setDraft((current) => ({ ...current, segment: segment.key }))} />)}</View>
        </FilterGroup>
        <Pressable onPress={() => { onApply(draft); onClose(); }} style={[styles.applyButton, { backgroundColor: theme.ink }]}>
          <Text style={{ color: theme.surface, fontFamily: fonts.black, fontSize: 14 }}>적용</Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

function FilterGroup({ children, label }: { children: React.ReactNode; label: string }) {
  const { fonts, theme } = useMinionTheme();
  return <View style={styles.filterGroup}><Text style={{ color: theme.muted, fontFamily: fonts.bold, fontSize: 13, lineHeight: 19.5, marginBottom: 8 }}>{label}</Text>{children}</View>;
}

function Choice({ active, full = false, label, onPress }: { active: boolean; full?: boolean; label: string; onPress: () => void }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <Pressable onPress={onPress} style={[styles.choice, full ? styles.choiceFull : null, active ? { backgroundColor: theme.ink, borderColor: theme.ink } : { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text numberOfLines={1} style={{ color: active ? theme.surface : theme.ink, flex: 1, fontFamily: fonts.bold, fontSize: 13, textAlign: 'center' }}>{label}</Text>
      {active && full ? <Check color={theme.surface} size={15} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  applyButton: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', marginTop: 4, minHeight: 48 },
  choice: { alignItems: 'center', borderRadius: 10, borderWidth: 1, flexDirection: 'row', height: 40, justifyContent: 'center', paddingHorizontal: 9, width: '23.3%' },
  choiceFull: { justifyContent: 'space-between', width: '48.7%' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { paddingHorizontal: 16, paddingVertical: 20 },
  filterButton: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 44, paddingHorizontal: 12 },
  filterGroup: { marginBottom: 20 },
  page: { gap: 24, paddingHorizontal: 16, paddingVertical: 20 },
  segmentList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheetBody: { paddingBottom: 8, paddingTop: 8 },
  title: { fontSize: 20, letterSpacing: -0.4, lineHeight: 26 },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
