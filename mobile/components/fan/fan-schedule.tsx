import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CalendarPlus from 'lucide-react-native/icons/calendar-plus';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { TeamLogo } from '@/components/data/team-logo';
import { useTeamCalendar } from '@/components/fan/use-team-calendar';
import { FanCalendarSubmissionSheet } from '@/components/fan/fan-calendar-submission-sheet';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileMatchSummary, type MobileTeamDetailDto } from '@/lib/api-client';

type CalendarEvent = MobileTeamDetailDto['calendarEvents'][number];
type CalendarItem = { kind: 'match'; match: MobileMatchSummary } | { kind: 'event'; event: CalendarEvent };
type CalendarItemType = 'match' | CalendarEvent['type'];

const ITEM_META: Record<CalendarItemType, { color: string; emoji: string; label: string }> = {
  match: { color: '#00a66f', emoji: '🎮', label: '경기' },
  birthday: { color: '#304ffe', emoji: '🎂', label: '생일' },
  debut: { color: '#7c5cff', emoji: '🎉', label: '데뷔' },
  championship: { color: '#f5c518', emoji: '🏆', label: '우승' },
  custom: { color: '#f97316', emoji: '📅', label: '기념일' },
};
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function colorWithAlpha(color: string, alpha: number) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  return `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function monthFromKey(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1, 12);
}

function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function matchDateKey(value: string) {
  return new Intl.DateTimeFormat('en-CA', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Seoul', year: 'numeric' }).format(new Date(value));
}

function matchTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', hour12: false, minute: '2-digit', timeZone: 'Asia/Seoul' }).format(new Date(value));
}

function opponentFor(match: MobileMatchSummary, teamId: string) {
  return match.teamA?.id === teamId ? match.teamB : match.teamA;
}

function itemTime(item: CalendarItem) {
  return item.kind === 'match' ? matchTime(item.match.startsAt) : item.event.eventTime ?? '99:99';
}

function itemTitle(item: CalendarItem, teamId: string) {
  if (item.kind === 'event') return item.event.title;
  const opponent = opponentFor(item.match, teamId);
  return opponent?.shortName ?? opponent?.name ?? 'TBD';
}

function EventImage({ event, size }: { event: CalendarEvent; size: number }) {
  const { theme } = useMinionTheme();
  const uri = resolveApiAssetUrl(event.image?.url);
  if (uri) return <Image contentFit="cover" contentPosition="top" source={{ uri }} style={{ borderRadius: size / 2, height: size, width: size }} />;
  const meta = ITEM_META[event.type];
  return <View style={[styles.eventFallback, { backgroundColor: `${meta.color}1f`, borderRadius: size / 2, height: size, width: size }]}><Text style={{ color: theme.ink, fontSize: 13 }}>{meta.emoji}</Text></View>;
}

function CalendarPreview({ item, outside, teamId }: { item: CalendarItem; outside: boolean; teamId: string }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={styles.preview}>
      {item.kind === 'match'
        ? <TeamLogo plain size={16} team={opponentFor(item.match, teamId)} themeAware />
        : item.event.image
          ? <EventImage event={item.event} size={16} />
          : <View style={[styles.previewDot, { backgroundColor: ITEM_META[item.event.type].color }]} />}
      <Text numberOfLines={1} style={[styles.previewText, { color: theme.muted, opacity: outside ? 0.45 : 1, ...fonts.regular }]}>{itemTitle(item, teamId)}</Text>
    </View>
  );
}

export function FanSchedule({ data }: { data: MobileTeamDetailDto }) {
  const todayKey = useMemo(() => new Intl.DateTimeFormat('en-CA', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Seoul', year: 'numeric' }).format(new Date()), []);
  const calendar = useTeamCalendar(data.team.fanSiteHost, { matches: data.matches, events: data.calendarEvents });
  const [visibleMonth, setVisibleMonth] = useState(() => monthFromKey(todayKey));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const { fonts, theme } = useMinionTheme();
  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth]);
  const matchesByDate = useMemo(() => {
    const result = new Map<string, MobileMatchSummary[]>();
    for (const match of calendar.data.matches) {
      const key = matchDateKey(match.startsAt);
      result.set(key, [...(result.get(key) ?? []), match]);
    }
    return result;
  }, [calendar.data.matches]);
  const recurringByMonthDay = useMemo(() => {
    const result = new Map<string, CalendarEvent[]>();
    for (const event of calendar.data.events) {
      if (!event.isRecurring) continue;
      result.set(event.monthDay, [...(result.get(event.monthDay) ?? []), event]);
    }
    return result;
  }, [calendar.data.events]);
  const oneTimeByDate = useMemo(() => {
    const result = new Map<string, CalendarEvent[]>();
    for (const event of calendar.data.events) {
      if (event.isRecurring) continue;
      result.set(event.date, [...(result.get(event.date) ?? []), event]);
    }
    return result;
  }, [calendar.data.events]);
  const itemsForDate = (key: string): CalendarItem[] => [
    ...(matchesByDate.get(key) ?? []).map((match): CalendarItem => ({ kind: 'match', match })),
    ...(recurringByMonthDay.get(key.slice(5)) ?? []).map((event): CalendarItem => ({ kind: 'event', event })),
    ...(oneTimeByDate.get(key) ?? []).map((event): CalendarItem => ({ kind: 'event', event })),
  ].sort((a, b) => itemTime(a).localeCompare(itemTime(b)) || itemTitle(a, data.team.id).localeCompare(itemTitle(b, data.team.id), 'ko'));
  async function changeMonth(next: Date) {
    const month = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2,'0')}`;
    if (await calendar.load(month)) { setVisibleMonth(next); setSelectedKey(null); }
  }
  const moveMonth = (offset: number) => void changeMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1, 12));
  const selectedItems = selectedKey ? itemsForDate(selectedKey) : [];

  return (
    <View style={styles.page}>
      <View style={styles.toolbar}>
        <View style={styles.monthControls}>
          <Pressable accessibilityLabel="이전 달로 이동" onPress={() => moveMonth(-1)} style={styles.toolbarIcon}><ChevronLeft color={theme.muted} size={20} /></Pressable>
          <Text style={[styles.monthLabel, { color: theme.ink, ...fonts.medium }]}>{visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월</Text>
          <Pressable accessibilityLabel="다음 달로 이동" onPress={() => moveMonth(1)} style={styles.toolbarIcon}><ChevronRight color={theme.muted} size={20} /></Pressable>
          <Pressable onPress={() => void changeMonth(monthFromKey(todayKey))} style={styles.todayButton}><Text style={[styles.todayText, { color: theme.muted, ...fonts.medium }]}>오늘</Text></Pressable>
        </View>
        <Pressable accessibilityLabel={`${data.team.shortName} 일정 제보하기`} onPress={() => setSubmissionOpen(true)} style={styles.submitTrigger}><CalendarPlus color={theme.muted} size={14} /><Text style={[styles.submitTriggerText, { color: theme.muted, ...fonts.medium }]}>일정 제보</Text></Pressable>
      </View>
      <View accessibilityLabel={`${visibleMonth.getFullYear()}년 ${visibleMonth.getMonth() + 1}월 일정`} style={[styles.calendar, { borderBottomColor: theme.border }]}>
        <View style={[styles.weekHeader, { borderBottomColor: theme.border }]}>
          {WEEKDAYS.map((weekday, index) => <Text key={weekday} style={[styles.weekday, { color: index === 0 ? '#ef4444cc' : index === 6 ? '#3b82f6cc' : theme.muted, ...fonts.medium }]}>{weekday}</Text>)}
        </View>
        {Array.from({ length: 6 }, (_, weekIndex) => (
          <View key={weekIndex} style={[styles.week, { borderBottomColor: theme.border }]}>
            {days.slice(weekIndex * 7, weekIndex * 7 + 7).map((day, dayIndex) => {
              const key = dateKey(day);
              const items = itemsForDate(key);
              const outside = day.getMonth() !== visibleMonth.getMonth();
              const isToday = key === todayKey;
              return (
                <Pressable accessibilityLabel={`${key}, 일정 ${items.length}건 보기`} disabled={items.length === 0} key={key} onPress={() => setSelectedKey(key)} style={[styles.dayCell, { borderRightColor: theme.border }, dayIndex === 6 && styles.dayCellLast, outside && { backgroundColor: colorWithAlpha(theme.surfaceMuted, 0.3) }]}>
                  <View style={[styles.dayNumber, outside && { opacity: 0.45 }, isToday && { backgroundColor: theme.ink }]}><Text style={[styles.dayNumberText, { color: isToday ? theme.surface : outside ? theme.muted : theme.ink, ...fonts.medium }]}>{day.getDate()}</Text></View>
                  <View style={styles.previews}>{items.slice(0, 2).map((item) => <CalendarPreview item={item} key={item.kind === 'match' ? `match-${item.match.id}` : `event-${item.event.id}`} outside={outside} teamId={data.team.id} />)}</View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View accessibilityLabel="일정 색상 안내" style={styles.legend}>
        {(Object.entries(ITEM_META) as [CalendarItemType, (typeof ITEM_META)[CalendarItemType]][]).map(([type, meta]) => (
          <View key={type} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: meta.color }]} /><Text style={[styles.legendText, { color: theme.muted, ...fonts.regular }]}>{meta.label}</Text></View>
        ))}
      </View>
      <CalendarPopup dateKeyValue={selectedKey} items={selectedItems} onClose={() => setSelectedKey(null)} teamId={data.team.id} />
      <FanCalendarSubmissionSheet onClose={() => setSubmissionOpen(false)} open={submissionOpen} team={data.team} />
    </View>
  );
}

function CalendarPopup({ dateKeyValue, items, onClose, teamId }: { dateKeyValue: string | null; items: CalendarItem[]; onClose: () => void; teamId: string }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  if (!dateKeyValue || items.length === 0) return null;
  const date = dateFromKey(dateKeyValue);
  return (
    <BottomSheet open onClose={onClose} title={date.getMonth() + 1 + '월 ' + date.getDate() + '일'} contentStyle={styles.popupList}>
            {items.map((item) => item.kind === 'match' ? (
              <Pressable key={`popup-match-${item.match.id}`} onPress={() => { onClose(); router.navigate(`/matches/${encodeURIComponent(item.match.id)}` as never); }} style={[styles.popupItem, { backgroundColor: theme.card }]}>
                <TeamLogo plain size={24} team={opponentFor(item.match, teamId)} themeAware />
                <Text numberOfLines={1} style={[styles.popupItemTitle, { color: theme.ink, ...fonts.medium }]}>{itemTitle(item, teamId)}</Text>
                <Text style={[styles.popupItemTime, { color: theme.muted, ...fonts.medium }]}>{matchTime(item.match.startsAt)}</Text>
              </Pressable>
            ) : (
              <Pressable disabled={!item.event.sourceUrl} key={`popup-event-${item.event.id}`} onPress={() => item.event.sourceUrl && void Linking.openURL(item.event.sourceUrl)} style={[styles.popupItem, { backgroundColor: theme.card }]}>
                <EventImage event={item.event} size={32} />
                <Text numberOfLines={1} style={[styles.popupItemTitle, { color: theme.ink, ...fonts.medium }]}>{item.event.title}</Text>
                <Text style={[styles.popupItemTime, { color: ITEM_META[item.event.type].color, ...fonts.medium }]}>{item.event.eventTime ?? '종일'}</Text>
              </Pressable>
            ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  calendar: { borderBottomWidth: 1, width: '100%' },
  dayCell: { alignItems: 'center', borderRightWidth: 1, height: 80, paddingHorizontal: 2, paddingVertical: 4, width: '14.285714%' },
  dayCellLast: { borderRightWidth: 0 },
  dayNumber: { alignItems: 'center', borderRadius: 12, height: 24, justifyContent: 'center', width: 24 },
  dayNumberText: { fontSize: 13, lineHeight: 18 },
  eventFallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  legend: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', marginTop: 4, paddingHorizontal: 4, rowGap: 4 },
  legendDot: { borderRadius: 3, height: 6, width: 6 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  legendText: { fontSize: 13, lineHeight: 16 },
  monthControls: { alignItems: 'center', flexDirection: 'row', gap: 2 },
  monthLabel: { fontSize: 15, lineHeight: 22.5, textAlign: 'center' },
  page: { paddingHorizontal: 16, paddingVertical: 8 },
  popupItem: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 10, minHeight: 48, paddingHorizontal: 12, paddingVertical: 8 },
  popupItemTime: { flexShrink: 0, fontSize: 13, lineHeight: 19 },
  popupItemTitle: { flex: 1, fontSize: 13, lineHeight: 19, minWidth: 0 },
  popupList: { gap: 6 },
  preview: { alignItems: 'center', flexDirection: 'row', gap: 2, minWidth: 0, width: '100%' },
  previewDot: { borderRadius: 3, flexShrink: 0, height: 6, width: 6 },
  previewText: { flex: 1, fontSize: 12, lineHeight: 16, minWidth: 0 },
  previews: { gap: 2, marginTop: 2, minWidth: 0, width: '100%' },
  submitTrigger: { alignItems: 'center', flexDirection: 'row', gap: 6, height: 32, justifyContent: 'center', paddingHorizontal: 8 },
  submitTriggerText: { fontSize: 13, lineHeight: 19 },
  todayButton: { alignItems: 'center', height: 36, justifyContent: 'center', marginLeft: 4, paddingHorizontal: 8 },
  todayText: { fontSize: 14, lineHeight: 20 },
  toolbar: { alignItems: 'center', flexDirection: 'row', height: 36, justifyContent: 'space-between', marginBottom: 4 },
  toolbarIcon: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  week: { borderBottomWidth: 1, flexDirection: 'row' },
  weekHeader: { borderBottomWidth: 1, flexDirection: 'row' },
  weekday: { fontSize: 13, lineHeight: 19, paddingVertical: 4, textAlign: 'center', width: '14.285714%' },
});
