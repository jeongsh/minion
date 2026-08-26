import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Clock3 from 'lucide-react-native/icons/clock-3';
import X from 'lucide-react-native/icons/x';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { ScheduleDialogChrome } from '@/components/schedule/schedule-dialog-chrome';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileMatchSummary, type MobileTeamSummary } from '@/lib/api-client';
import { dateKeyKST, formatTimeKST } from '@/lib/schedule-dates';
import { tournamentTypeLabel } from '@/lib/tournament-label';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
/** 웹 lib/calendar/theme.ts(CALENDAR_EVENT_COLORS)와 동일한 색. 일정 화면은 이벤트 데이터를 쓰지 않지만
 * 웹 HomeCalendar는 데이터 유무와 무관하게 4개 항목 범례를 항상 그리므로 그대로 맞춘다. */
const LEGEND = [
  { color: '#00b979', label: '경기' },
  { color: '#304ffe', label: '생일' },
  { color: '#7c5cff', label: '데뷔' },
  { color: '#f5c518', label: '기념일' },
] as const;

function calendarDays(year: number, month: number) {
  const first = new Date(year, month, 1, 12);
  const start = new Date(year, month, 1 - first.getDay(), 12);
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index, 12));
}

export function ScheduleCalendarDialog({
  activeMonth,
  activeYear,
  matches,
  onClose,
  open,
}: {
  activeMonth: number;
  activeYear: number;
  matches: MobileMatchSummary[];
  onClose: () => void;
  open: boolean;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colorScheme, fonts, theme } = useMinionTheme();
  const [year, setYear] = useState(activeYear);
  const [month, setMonth] = useState(activeMonth - 1);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setYear(activeYear);
      setMonth(activeMonth - 1);
      setSelectedKey(null);
    }
  }, [activeMonth, activeYear, open]);

  const matchesByDate = useMemo(() => {
    const map = new Map<string, MobileMatchSummary[]>();
    for (const match of matches) {
      const key = dateKeyKST(match.startsAt);
      const list = map.get(key) ?? [];
      list.push(match);
      map.set(key, list);
    }
    return map;
  }, [matches]);

  const days = useMemo(() => calendarDays(year, month), [month, year]);
  const selectedMatches = selectedKey ? (matchesByDate.get(selectedKey) ?? []) : [];
  const today = dateKeyKST(new Date());

  function moveMonth(delta: number) {
    const next = new Date(year, month + delta, 1, 12);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelectedKey(null);
  }

  function goToMatch(matchId: string) {
    onClose();
    router.navigate(`/matches/${encodeURIComponent(matchId)}` as never);
  }

  return (
    <ScheduleDialogChrome onClose={onClose} open={open} title={`${activeYear}년 ${activeMonth}월 캘린더`}>
      <View style={[styles.shell, { backgroundColor: colorScheme === 'dark' ? '#1c1e22' : '#ffffff', borderColor: theme.border }]}>
        {selectedKey && selectedMatches.length > 0 ? (
          <View style={styles.detail}>
            <View style={styles.detailHeader}>
              <Pressable onPress={() => setSelectedKey(null)} style={styles.detailBack}>
                <ChevronLeft color={theme.ink} size={16} strokeWidth={2.5} />
                <Text style={{ color: theme.ink, ...fonts.black, fontSize: 14, lineHeight: 17.5 }}>
                  {Number(selectedKey.split('-')[1])}월 {Number(selectedKey.split('-')[2])}일
                </Text>
              </Pressable>
              <Pressable accessibilityLabel="날짜 상세 닫기" onPress={() => setSelectedKey(null)} style={styles.detailClose}>
                <X color={theme.muted} size={14} strokeWidth={2.5} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.detailList} style={styles.detailScroll}>
              {selectedMatches.map((match) => (
                <Pressable key={match.id} onPress={() => goToMatch(match.id)} style={[styles.matchDetail, { backgroundColor: theme.card }]}>
                  <View style={styles.matchMeta}>
                    <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{tournamentTypeLabel(match.tournament)}</Text>
                    <View style={styles.matchTime}>
                      <Clock3 color="#00b979" size={12} strokeWidth={2.25} />
                      <Text style={{ color: '#00b979', ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{formatTimeKST(match.startsAt)}</Text>
                    </View>
                  </View>
                  <View style={styles.detailTeams}>
                    <CalendarTeamLogo team={match.teamA} />
                    <Text style={{ color: theme.ink, ...fonts.black, fontSize: 14, lineHeight: 17.5 }}>{match.teamA?.shortName ?? 'TBD'}</Text>
                    <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>vs</Text>
                    <CalendarTeamLogo team={match.teamB} />
                    <Text style={{ color: theme.ink, ...fonts.black, fontSize: 14, lineHeight: 17.5 }}>{match.teamB?.shortName ?? 'TBD'}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : (
          <>
            <View style={styles.captionRow}>
              <View style={styles.captionNav}>
                <Pressable accessibilityLabel="이전 달" onPress={() => moveMonth(-1)} style={[styles.navButton, width <= 420 && styles.navButtonCompact, { backgroundColor: theme.card }]}>
                  <ChevronLeft color={theme.muted} size={14} strokeWidth={2.25} />
                </Pressable>
                <Pressable accessibilityLabel="다음 달" onPress={() => moveMonth(1)} style={[styles.navButton, width <= 420 && styles.navButtonCompact, { backgroundColor: theme.card }]}>
                  <ChevronRight color={theme.muted} size={14} strokeWidth={2.25} />
                </Pressable>
              </View>
              <Text style={[styles.caption, { color: theme.ink, ...fonts.black }]}>{year}년 {month + 1}월</Text>
            </View>
            <View style={styles.weekRow}>
              {WEEKDAYS.map((weekday) => (
                <Text key={weekday} style={[styles.weekday, { color: theme.muted, ...fonts.medium }]}>{weekday}</Text>
              ))}
            </View>
            <View>
              {Array.from({ length: 6 }, (_, week) => (
                <View key={week} style={styles.weekRow}>
                  {days.slice(week * 7, week * 7 + 7).map((day) => {
                    const key = dateKeyKST(day);
                    const dayMatches = matchesByDate.get(key) ?? [];
                    const outside = day.getMonth() !== month;
                    const isToday = key === today;
                    return (
                      <View key={key} style={styles.dayCell}>
                        <Pressable
                          disabled={dayMatches.length === 0}
                          onPress={() => setSelectedKey(key)}
                          style={[styles.dayButton, isToday && { backgroundColor: `${theme.ink}1f` }]}>
                          <Text style={[styles.dayText, { color: outside ? '#b0b3b8' : theme.text, ...fonts.medium }]}>{day.getDate()}</Text>
                          <View style={styles.dots}>{dayMatches.length ? <View style={[styles.dot, { backgroundColor: '#00b979' }]} /> : null}</View>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </>
        )}
        <View style={styles.legend}>
          {LEGEND.map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScheduleDialogChrome>
  );
}

/** 웹 HomeCalendar의 CalendarDetailList와 동일하게, 로고가 없으면(TBD) 아무것도 그리지 않는다(자리표시 박스 없음). */
function CalendarTeamLogo({ team }: { team: MobileTeamSummary | null }) {
  const { colorScheme } = useMinionTheme();
  const useWhite = colorScheme === 'dark' && Boolean(team?.useWhiteLogoOnDark) && Boolean(team?.logoDark?.url);
  const uri = resolveApiAssetUrl(useWhite ? (team?.logoDark?.url ?? null) : (team?.logo?.url ?? null));
  if (!uri) return null;
  return <Image contentFit="contain" source={{ uri }} style={styles.detailTeamLogo} />;
}

const styles = StyleSheet.create({
  caption: { fontSize: 16, letterSpacing: -0.4, lineHeight: 24, textAlign: 'center' },
  captionNav: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', position: 'absolute', top: 1, width: 168 },
  captionRow: { alignItems: 'center', height: 27.2, justifyContent: 'center', marginBottom: 9.6 },
  dayButton: { alignItems: 'center', borderRadius: 10, height: 42, justifyContent: 'center', width: 42 },
  dayCell: { alignItems: 'center', height: 44, justifyContent: 'center', width: '14.285714%' },
  dayText: { fontSize: 12, lineHeight: 12 },
  detail: { flex: 1, minHeight: 0 },
  detailBack: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  detailClose: { alignItems: 'center', height: 24, justifyContent: 'center', width: 24 },
  detailHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4, paddingVertical: 2 },
  detailList: { gap: 6 },
  detailScroll: { flex: 1 },
  detailTeamLogo: { height: 16, width: 16 },
  detailTeams: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
  dot: { borderRadius: 2, height: 4, width: 4 },
  dots: { alignItems: 'center', flexDirection: 'row', gap: 2, height: 4, justifyContent: 'center' },
  legend: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center', marginTop: 12, rowGap: 6 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  matchDetail: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  matchMeta: { gap: 2 },
  matchTime: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  navButton: { alignItems: 'center', borderRadius: 9, height: 28, justifyContent: 'center', width: 28 },
  navButtonCompact: { height: 27, width: 27 },
  shell: { borderRadius: 16, borderWidth: 1, height: 400, padding: 16 },
  weekday: { fontSize: 12, lineHeight: 18, paddingBottom: 3.2, paddingTop: 1.6, textAlign: 'center', width: '14.285714%' },
  weekRow: { flexDirection: 'row', width: '100%' },
});
