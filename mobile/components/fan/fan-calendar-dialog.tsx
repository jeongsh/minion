import { Image } from 'expo-image';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Clock3 from 'lucide-react-native/icons/clock-3';
import X from 'lucide-react-native/icons/x';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TeamLogo } from '@/components/data/team-logo';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileTeamDetailDto } from '@/lib/api-client';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const EVENT_COLOR = { birthday: '#304ffe', championship: '#f5c518', custom: '#f5c518', debut: '#7c5cff' } as const;

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function matchDateKey(value: string) {
  return new Intl.DateTimeFormat('en-CA', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Seoul', year: 'numeric' }).format(new Date(value));
}

function monthDays(year: number, month: number) {
  const first = new Date(year, month, 1, 12);
  const start = new Date(year, month, 1 - first.getDay(), 12);
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index, 12));
}

function matchTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', hour12: false, minute: '2-digit', timeZone: 'Asia/Seoul' }).format(new Date(value));
}

type Props = {
  background: string;
  border: string;
  events: MobileTeamDetailDto['calendarEvents'];
  iconColor: string;
  matches: MobileTeamDetailDto['matches'];
  teamShort: string;
};

export function FanCalendarDialog({ background, border, events = [], iconColor, matches, teamShort }: Props) {
  const today = new Date();
  const insets = useSafeAreaInsets();
  const { colorScheme, fonts, theme } = useMinionTheme();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const days = useMemo(() => monthDays(year, month), [month, year]);
  const matchesByDate = useMemo(() => {
    const result = new Map<string, MobileTeamDetailDto['matches']>();
    for (const match of matches) {
      const key = matchDateKey(match.startsAt);
      result.set(key, [...(result.get(key) ?? []), match]);
    }
    return result;
  }, [matches]);
  const selectedMatches = selectedKey ? matchesByDate.get(selectedKey) ?? [] : [];
  const selectedEvents = selectedKey ? events.filter((event) => event.isRecurring ? event.monthDay === selectedKey.slice(5) : event.date === selectedKey) : [];

  const moveMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1, 12);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelectedKey(null);
  };

  return <>
    <Pressable accessibilityLabel="캘린더" onPress={() => setOpen(true)} style={({ pressed }) => [styles.trigger, { backgroundColor: background, borderColor: border, opacity: pressed ? 0.8 : 1 }]}>
      <CalendarDays color={iconColor} size={16} />
    </Pressable>
    <Modal animationType="fade" onRequestClose={() => setOpen(false)} transparent visible={open}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="캘린더 닫기" onPress={() => setOpen(false)} style={[styles.backdrop, { backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.45)' }]} />
        <View style={[styles.panel, { backgroundColor: theme.surface, paddingBottom: Math.max(insets.bottom, 0) }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.black }]}>{teamShort} 캘린더</Text>
            <Pressable accessibilityLabel="닫기" onPress={() => setOpen(false)} style={styles.close}><X color={theme.muted} size={21} /></Pressable>
          </View>
          <View style={styles.body}>
            <View style={[styles.calendar, { backgroundColor: colorScheme === 'dark' ? '#1c1e22' : '#ffffff', borderColor: theme.border }]}>
              {selectedKey && (selectedMatches.length || selectedEvents.length) ? (
                <CalendarDetail dateKey={selectedKey} events={selectedEvents} matches={selectedMatches} onBack={() => setSelectedKey(null)} />
              ) : <>
                <View style={styles.captionRow}>
                  <View style={styles.captionNav}>
                    <Pressable accessibilityLabel="이전 달" onPress={() => moveMonth(-1)} style={[styles.nav, { backgroundColor: theme.card }]}><ChevronLeft color={theme.muted} size={14} strokeWidth={2.25} /></Pressable>
                    <Pressable accessibilityLabel="다음 달" onPress={() => moveMonth(1)} style={[styles.nav, { backgroundColor: theme.card }]}><ChevronRight color={theme.muted} size={14} strokeWidth={2.25} /></Pressable>
                  </View>
                  <Text style={[styles.caption, { color: theme.ink, fontFamily: fonts.black }]}>{year}년 {month + 1}월</Text>
                </View>
                <View style={styles.week}>{WEEKDAYS.map((day) => <Text key={day} style={[styles.weekday, { color: theme.muted, fontFamily: fonts.medium }]}>{day}</Text>)}</View>
                <View>{Array.from({ length: 6 }, (_, week) => <View key={week} style={styles.week}>{days.slice(week * 7, week * 7 + 7).map((day) => {
                  const key = localDateKey(day);
                  const dayMatches = matchesByDate.get(key) ?? [];
                  const dayEvents = events.filter((event) => event.isRecurring ? event.monthDay === key.slice(5) : event.date === key);
                  const eventTypes = Array.from(new Set(dayEvents.map((event) => event.type))).slice(0, dayMatches.length ? 2 : 3);
                  const enabled = dayMatches.length > 0 || dayEvents.length > 0;
                  return <View key={key} style={styles.dayCell}><Pressable disabled={!enabled} onPress={() => setSelectedKey(key)} style={[styles.dayButton, key === localDateKey(today) && { backgroundColor: `${theme.ink}1f` }]}><Text style={[styles.dayText, { color: day.getMonth() === month ? theme.text : '#b0b3b8', fontFamily: fonts.medium }]}>{day.getDate()}</Text><View style={styles.dots}>{dayMatches.length ? <View style={[styles.dot, { backgroundColor: '#00b979' }]} /> : null}{eventTypes.map((type) => <View key={type} style={[styles.dot, { backgroundColor: EVENT_COLOR[type] }]} />)}</View></Pressable></View>;
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

function CalendarDetail({ dateKey, events, matches, onBack }: { dateKey: string; events: MobileTeamDetailDto['calendarEvents']; matches: MobileTeamDetailDto['matches']; onBack: () => void }) {
  const { fonts, theme } = useMinionTheme();
  const [, month, day] = dateKey.split('-').map(Number);
  return <View style={styles.detail}>
    <View style={styles.detailHeader}><Pressable onPress={onBack} style={styles.detailBack}><ChevronLeft color={theme.ink} size={16} strokeWidth={2.5} /><Text style={{ color: theme.ink, fontFamily: fonts.black, fontSize: 14 }}>{month}월 {day}일</Text></Pressable><Pressable accessibilityLabel="날짜 상세 닫기" onPress={onBack} style={styles.detailClose}><X color={theme.muted} size={14} strokeWidth={2.5} /></Pressable></View>
    <ScrollView contentContainerStyle={styles.detailList}>{matches.map((match) => <View key={match.id} style={[styles.match, { backgroundColor: theme.card }]}><View><Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 12 }}>{match.tournament?.league ?? ''}</Text><View style={styles.time}><Clock3 color="#00b979" size={12} /><Text style={{ color: '#00b979', fontFamily: fonts.medium, fontSize: 12 }}>{matchTime(match.startsAt)}</Text></View></View><View style={styles.teams}><TeamLogo plain size={16} team={match.teamA} themeAware /><Text style={{ color: theme.ink, fontFamily: fonts.black, fontSize: 13 }}>{match.teamA?.shortName ?? 'TBD'}</Text><Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 12 }}>vs</Text><TeamLogo plain size={16} team={match.teamB} themeAware /><Text style={{ color: theme.ink, fontFamily: fonts.black, fontSize: 13 }}>{match.teamB?.shortName ?? 'TBD'}</Text></View></View>)}{events.map((event) => { const imageUrl = resolveApiAssetUrl(event.image?.url); return <View key={event.id} style={[styles.event, { backgroundColor: theme.card }]}>{imageUrl ? <Image contentFit="cover" contentPosition="top" source={{ uri: imageUrl }} style={styles.eventImage} /> : <View style={[styles.eventIcon, { backgroundColor: `${EVENT_COLOR[event.type]}1f` }]}><Text>{event.type === 'birthday' ? '🎂' : event.type === 'debut' ? '🎉' : event.type === 'championship' ? '🏆' : '🎈'}</Text></View>}<Text numberOfLines={1} style={{ color: theme.ink, flex: 1, fontFamily: fonts.black, fontSize: 13 }}>{event.title}</Text><Text style={{ color: EVENT_COLOR[event.type], fontFamily: fonts.medium, fontSize: 12 }}>{event.dday === 0 ? 'D-DAY' : `D-${event.dday}`}</Text></View>; })}</ScrollView>
  </View>;
}

function Legend({ color, label }: { color: string; label: string }) {
  const { fonts, theme } = useMinionTheme();
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 12 }}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
  body: { padding: 16 },
  calendar: { borderRadius: 16, borderWidth: 1, height: 400, padding: 16 },
  caption: { fontSize: 16, letterSpacing: -0.4, lineHeight: 24, textAlign: 'center' },
  captionNav: { flexDirection: 'row', justifyContent: 'space-between', position: 'absolute', top: 1, width: 168 },
  captionRow: { alignItems: 'center', height: 27, justifyContent: 'center', marginBottom: 10 },
  close: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  dayButton: { alignItems: 'center', borderRadius: 10, height: 42, justifyContent: 'center', width: 42 },
  dayCell: { alignItems: 'center', height: 44, justifyContent: 'center', width: '14.285714%' },
  dayText: { fontSize: 12, lineHeight: 12 },
  detail: { flex: 1, minHeight: 0 },
  detailBack: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  detailClose: { alignItems: 'center', height: 24, justifyContent: 'center', width: 24 },
  detailHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4, paddingVertical: 2 },
  detailList: { gap: 6 },
  dot: { borderRadius: 2, height: 4, width: 4 },
  dots: { alignItems: 'center', flexDirection: 'row', gap: 2, height: 4, justifyContent: 'center' },
  event: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  eventIcon: { alignItems: 'center', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  eventImage: { borderRadius: 16, height: 32, width: 32 },
  header: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', minHeight: 56, paddingHorizontal: 16 },
  legend: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center', marginTop: 12, rowGap: 6 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  match: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  nav: { alignItems: 'center', borderRadius: 9, height: 28, justifyContent: 'center', width: 28 },
  panel: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', overflow: 'hidden', width: '100%' },
  teams: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
  time: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 2 },
  title: { flex: 1, fontSize: 17, letterSpacing: -0.34 },
  trigger: { alignItems: 'center', borderRadius: 18, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  week: { flexDirection: 'row', width: '100%' },
  weekday: { fontSize: 12, lineHeight: 18, paddingBottom: 3, paddingTop: 2, textAlign: 'center', width: '14.285714%' },
});
