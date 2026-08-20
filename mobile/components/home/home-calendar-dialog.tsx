import { Image } from 'expo-image';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Clock3 from 'lucide-react-native/icons/clock-3';
import X from 'lucide-react-native/icons/x';
import { useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TeamLogo } from '@/components/data/team-logo';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileHomeDto, type MobileMatchSummary } from '@/lib/api-client';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const EVENT_COLOR = { birthday: '#304ffe', championship: '#f5c518', custom: '#f5c518', debut: '#7c5cff' } as const;

function keyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthDayOf(date: Date) {
  return keyOf(date).slice(5);
}

function calendarDays(year: number, month: number) {
  const first = new Date(year, month, 1, 12);
  const sundayOffset = first.getDay();
  const start = new Date(year, month, 1 - sundayOffset, 12);
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index, 12));
}

function timeOf(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', hour12: false, minute: '2-digit', timeZone: 'Asia/Seoul' }).format(new Date(value));
}

type Props = {
  calendar: MobileHomeDto['calendar'];
  events: MobileHomeDto['calendarEvents'];
};

export function HomeCalendarDialog({ calendar, events }: Props) {
  const now = new Date();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [initialMonthKey] = useState(() => keyOf(now).slice(0, 7));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { colorScheme, fonts, theme } = useMinionTheme();
  const matchesByDate = useMemo(() => new Map(calendar.filter((group) => group.date.startsWith(initialMonthKey)).map((group) => [group.date, group.matches])), [calendar, initialMonthKey]);
  const days = useMemo(() => calendarDays(year, month), [month, year]);
  const selectedMatches = selectedKey ? matchesByDate.get(selectedKey) ?? [] : [];
  const selectedEvents = selectedKey ? events.filter((event) => event.isRecurring ? event.monthDay === selectedKey.slice(5) : event.date === selectedKey) : [];

  const moveMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1, 12);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelectedKey(null);
  };

  return <>
    <Pressable accessibilityLabel="LCK 캘린더 열기" onPress={() => setOpen(true)} style={[styles.trigger, { backgroundColor: theme.card }]}>
      <CalendarDays color={theme.ink} size={16} strokeWidth={2} />
      <Text style={[styles.triggerText, { color: theme.ink, fontFamily: fonts.bold }]}>월간 캘린더 보기</Text>
    </Pressable>
    <Modal animationType="fade" onRequestClose={() => setOpen(false)} transparent visible={open}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="LCK 캘린더 닫기" onPress={() => setOpen(false)} style={[styles.backdrop, { backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.45)' }]} />
        <View style={[styles.panel, { backgroundColor: theme.surface, paddingBottom: Math.max(insets.bottom, 0) }]}>
          <View style={[styles.dialogHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.dialogTitle, { color: theme.ink, fontFamily: fonts.black }]}>LCK 캘린더</Text>
            <Pressable accessibilityLabel="닫기" onPress={() => setOpen(false)} style={styles.closeButton}><X color={theme.muted} size={21} /></Pressable>
          </View>
          <View style={styles.dialogBody}>
            <View style={[styles.calendarShell, { backgroundColor: colorScheme === 'dark' ? '#1c1e22' : '#ffffff', borderColor: theme.border }]}>
              {selectedKey && (selectedMatches.length || selectedEvents.length) ? (
                <CalendarDetail dateKey={selectedKey} events={selectedEvents} matches={selectedMatches} onBack={() => setSelectedKey(null)} />
              ) : <>
                <View style={styles.captionRow}>
                  <View style={styles.captionNav}>
                    <Pressable accessibilityLabel="이전 달" onPress={() => moveMonth(-1)} style={[styles.navButton, width <= 420 && styles.navButtonCompact, { backgroundColor: theme.card }]}><ChevronLeft color={theme.muted} size={14} strokeWidth={2.25} /></Pressable>
                    <Pressable accessibilityLabel="다음 달" onPress={() => moveMonth(1)} style={[styles.navButton, width <= 420 && styles.navButtonCompact, { backgroundColor: theme.card }]}><ChevronRight color={theme.muted} size={14} strokeWidth={2.25} /></Pressable>
                  </View>
                  <Text style={[styles.caption, { color: theme.ink, fontFamily: fonts.black }]}>{year}년 {month + 1}월</Text>
                </View>
                <View style={styles.weekRow}>{WEEKDAYS.map((weekday) => <Text key={weekday} style={[styles.weekday, { color: theme.muted, fontFamily: fonts.medium }]}>{weekday}</Text>)}</View>
                <View>{Array.from({ length: 6 }, (_, week) => <View key={week} style={styles.weekRow}>{days.slice(week * 7, week * 7 + 7).map((day) => {
                  const key = keyOf(day);
                  const dayMatches = matchesByDate.get(key) ?? [];
                  const dayEvents = events.filter((event) => event.isRecurring ? event.monthDay === monthDayOf(day) : event.date === key);
                  const outside = day.getMonth() !== month;
                  const today = key === keyOf(now);
                  const hasAnything = dayMatches.length > 0 || dayEvents.length > 0;
                  const eventTypes = Array.from(new Set(dayEvents.map((event) => event.type))).slice(0, dayMatches.length ? 2 : 3);
                  return <View key={key} style={styles.dayCell}><Pressable disabled={!hasAnything} onPress={() => setSelectedKey(key)} style={[styles.dayButton, today && { backgroundColor: `${theme.ink}1f` }]}><Text style={[styles.dayText, { color: outside ? '#b0b3b8' : theme.text, fontFamily: fonts.medium }]}>{day.getDate()}</Text><View style={styles.dots}>{dayMatches.length ? <View style={[styles.dot, { backgroundColor: '#00b979' }]} /> : null}{eventTypes.map((type) => <View key={type} style={[styles.dot, { backgroundColor: EVENT_COLOR[type] }]} />)}</View></Pressable></View>;
                })}</View>)}</View>
              </>}
              <View style={styles.legend}><Legend color="#00b979" label="경기" /><Legend color={EVENT_COLOR.birthday} label="생일" /><Legend color={EVENT_COLOR.debut} label="데뷔" /><Legend color={EVENT_COLOR.custom} label="기념일" /></View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  </>;
}

function CalendarDetail({ dateKey, events, matches, onBack }: { dateKey: string; events: MobileHomeDto['calendarEvents']; matches: MobileMatchSummary[]; onBack: () => void }) {
  const { fonts, theme } = useMinionTheme();
  const [, month, day] = dateKey.split('-').map(Number);
  return <View style={styles.detail}><View style={styles.detailHeader}><Pressable onPress={onBack} style={styles.detailBack}><ChevronLeft color={theme.ink} size={16} strokeWidth={2.5} /><Text style={{ color: theme.ink, fontFamily: fonts.black, fontSize: 14, lineHeight: 17.5 }}>{month}월 {day}일</Text></Pressable><Pressable accessibilityLabel="날짜 상세 닫기" onPress={onBack} style={styles.detailClose}><X color={theme.muted} size={14} strokeWidth={2.5} /></Pressable></View><ScrollView contentContainerStyle={styles.detailList}>{matches.map((match) => <View key={match.id} style={[styles.matchDetail, { backgroundColor: theme.card }]}><View style={styles.matchMeta}><Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{match.tournament?.league ?? ''}</Text><View style={styles.matchTime}><Clock3 color="#00b979" size={12} strokeWidth={2.25} /><Text style={{ color: '#00b979', fontFamily: fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{timeOf(match.startsAt)}</Text></View></View><View style={styles.detailTeams}><TeamLogo plain size={16} team={match.teamA} themeAware /><Text style={{ color: theme.ink, fontFamily: fonts.black, fontSize: 14, lineHeight: 17.5 }}>{match.teamA?.shortName ?? 'TBD'}</Text><Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19.5 }}>vs</Text><TeamLogo plain size={16} team={match.teamB} themeAware /><Text style={{ color: theme.ink, fontFamily: fonts.black, fontSize: 14, lineHeight: 17.5 }}>{match.teamB?.shortName ?? 'TBD'}</Text></View></View>)}{events.map((event) => <View key={event.id} style={[styles.eventDetail, { backgroundColor: theme.card }]}>{event.image?.url ? <Image contentFit="cover" contentPosition="top" source={{ uri: resolveApiAssetUrl(event.image.url) ?? undefined }} style={styles.eventImage} /> : <View style={[styles.eventIcon, { backgroundColor: `${EVENT_COLOR[event.type]}1f` }]}><Text>{event.type === 'birthday' ? '🎂' : event.type === 'debut' ? '🎉' : event.type === 'championship' ? '🏆' : '🎈'}</Text></View>}<Text numberOfLines={1} style={{ color: theme.ink, flex: 1, fontFamily: fonts.black, fontSize: 13, lineHeight: 19.5 }}>{event.title}</Text><Text style={{ color: EVENT_COLOR[event.type], fontFamily: fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{event.dday === 0 ? 'D-DAY' : `D-${event.dday}`}</Text></View>)}</ScrollView></View>;
}

function Legend({ color, label }: { color: string; label: string }) {
  const { fonts, theme } = useMinionTheme();
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
  calendarShell: { borderRadius: 16, borderWidth: 1, height: 400, padding: 16 },
  caption: { fontSize: 16, letterSpacing: -0.4, lineHeight: 24, textAlign: 'center' },
  captionNav: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', position: 'absolute', top: 1, width: 168 },
  captionRow: { alignItems: 'center', height: 27.2, justifyContent: 'center', marginBottom: 9.6 },
  closeButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  dayButton: { alignItems: 'center', borderRadius: 10, height: 42, justifyContent: 'center', width: 42 },
  dayCell: { alignItems: 'center', height: 44, justifyContent: 'center', width: '14.285714%' },
  dayText: { fontSize: 12, lineHeight: 12 },
  detail: { flex: 1, minHeight: 0 },
  detailBack: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  detailClose: { alignItems: 'center', height: 24, justifyContent: 'center', width: 24 },
  detailHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4, paddingVertical: 2 },
  detailList: { gap: 6 },
  detailTeams: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
  dialogBody: { padding: 16 },
  dialogHeader: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', minHeight: 56, paddingHorizontal: 16 },
  dialogTitle: { flex: 1, fontSize: 17, letterSpacing: -0.34 },
  dot: { borderRadius: 2, height: 4, width: 4 },
  dots: { alignItems: 'center', flexDirection: 'row', gap: 2, height: 4, justifyContent: 'center' },
  eventDetail: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  eventImage: { borderRadius: 16, height: 32, width: 32 },
  eventIcon: { alignItems: 'center', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  legend: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center', marginTop: 12, rowGap: 6 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  matchDetail: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  matchMeta: { gap: 2 },
  matchTime: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  navButton: { alignItems: 'center', borderRadius: 9, height: 28, justifyContent: 'center', width: 28 },
  navButtonCompact: { height: 27, width: 27 },
  panel: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', overflow: 'hidden', width: '100%' },
  trigger: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 8, height: 44, justifyContent: 'center', paddingHorizontal: 16 },
  triggerText: { fontSize: 14, lineHeight: 20 },
  weekday: { fontSize: 12, lineHeight: 18, paddingBottom: 3.2, paddingTop: 1.6, textAlign: 'center', width: '14.285714%' },
  weekRow: { flexDirection: 'row', width: '100%' },
});
