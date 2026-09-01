import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import EyeOff from 'lucide-react-native/icons/eye-off';
import { useEffect, useState } from 'react';
import { Animated, Easing, type GestureResponderEvent, type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/data/team-logo';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileMatchSummary } from '@/lib/api-client';
import { dateHeadingKST, dateKeyKST, formatTimeKST, isMatchFinished, isMatchLive, matchStatusLabel } from '@/lib/schedule-dates';
import { useSpoilerFree } from '@/providers/spoiler-free-provider';

const EMPTY_BORDER = { dark: '#26735c', light: '#94dfc4' } as const;
// Expo assets use Metro's numeric module reference at runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CHARACTER_IMAGE = require('@/assets/characters/pen-4.png');

export function ScheduleMatchList({
  emptyMessage,
  matches,
  onSectionLayout,
}: {
  emptyMessage: string;
  matches: MobileMatchSummary[];
  onSectionLayout?: (dateKey: string, y: number) => void;
}) {
  const { fonts, theme } = useMinionTheme();

  if (matches.length === 0) {
    return <ScheduleEmptyState body={emptyMessage} />;
  }

  const todayKey = dateKeyKST(new Date());
  const groups = new Map<string, MobileMatchSummary[]>();
  for (const match of matches) {
    const heading = dateHeadingKST(match.startsAt);
    const list = groups.get(heading) ?? [];
    list.push(match);
    groups.set(heading, list);
  }

  return (
    <View style={styles.list}>
      {Array.from(groups.entries()).map(([heading, dayMatches]) => {
        const dateKey = dateKeyKST(dayMatches[0].startsAt);
        const isToday = dateKey === todayKey;
        return (
          <View key={heading} onLayout={(event: LayoutChangeEvent) => onSectionLayout?.(dateKey, event.nativeEvent.layout.y)}>
            <View style={styles.headingRow}>
              <Text style={[styles.heading, { color: theme.ink, ...fonts.black }]}>{heading}</Text>
              {isToday ? (
                <View style={[styles.todayBadge, { backgroundColor: theme.accent }]}>
                  <Text style={[styles.todayBadgeText, { color: theme.accentForeground, ...fonts.medium }]}>오늘</Text>
                </View>
              ) : null}
            </View>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: isToday ? theme.accent : theme.border, borderWidth: isToday ? 2 : 1 }]}>
              {dayMatches.map((match, index) => (
                <MatchRow isLast={index === dayMatches.length - 1} key={match.id} match={match} />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function MatchRow({ isLast, match }: { isLast: boolean; match: MobileMatchSummary }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  const { enabled: spoilerFreeEnabled, isRevealed, reveal } = useSpoilerFree();
  const live = isMatchLive(match);
  const completed = match.status === 'completed';
  const spoiled = spoilerFreeEnabled && isMatchFinished(match) && !isRevealed(match.id);
  const winnerId = spoiled
    ? null
    : match.winnerTeamId ??
      (completed && match.teamAScore !== null && match.teamBScore !== null
        ? match.teamAScore > match.teamBScore
          ? match.teamA?.id
          : match.teamBScore > match.teamAScore
            ? match.teamB?.id
            : null
        : null);
  const teamColor = (teamId?: string | null) => (!spoiled && completed && winnerId ? (teamId === winnerId ? theme.ink : theme.muted) : theme.ink);
  const score = match.teamAScore === null || match.teamBScore === null ? 'VS' : `${match.teamAScore}\u00a0:\u00a0${match.teamBScore}`;

  return (
    <Pressable
      accessibilityLabel={spoiled ? '탭하여 결과 보기' : undefined}
      onPress={() => {
        if (spoiled) {
          reveal(match.id);
        }
        router.navigate(`/matches/${encodeURIComponent(match.id)}` as never);
      }}
      style={[styles.rowTouchable, !isLast && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
        <View style={styles.timeColumn}>
          <Text style={[styles.time, { color: theme.ink, ...fonts.black }]}>{formatTimeKST(match.startsAt)}</Text>
          {live ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={[styles.liveText, { ...fonts.medium }]}>LIVE</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: theme.cardHover }]}>
              <Text style={[styles.statusText, { color: theme.muted, ...fonts.medium }]}>{matchStatusLabel(match.status)}</Text>
            </View>
          )}
        </View>
        <View style={styles.teamsColumn}>
          <View style={styles.teamSideLeft}>
            <Text numberOfLines={1} style={[styles.teamName, { color: teamColor(match.teamA?.id), ...fonts.black, textAlign: 'right' }]}>
              {match.teamA?.shortName || match.teamA?.name || 'TBD'}
            </Text>
            <TeamLogo plain size={32} team={match.teamA} themeAware />
          </View>
          {spoiled ? (
            <Pressable
              accessibilityLabel="결과가 가려져 있습니다. 탭하여 보기"
              onPress={(event: GestureResponderEvent) => {
                event.stopPropagation();
                reveal(match.id);
              }}
              style={styles.scoreMasked}>
              <EyeOff color={theme.muted} size={16} />
            </Pressable>
          ) : (
            <Text numberOfLines={1} style={[styles.score, { color: theme.ink, ...fonts.black }]}>{score}</Text>
          )}
          <View style={styles.teamSideRight}>
            <TeamLogo plain size={32} team={match.teamB} themeAware />
            <Text numberOfLines={1} style={[styles.teamName, { color: teamColor(match.teamB?.id), ...fonts.black }]}>
              {match.teamB?.shortName || match.teamB?.name || 'TBD'}
            </Text>
          </View>
        </View>
    </Pressable>
  );
}

function ScheduleEmptyState({ body }: { body: string }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  const [bob] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { duration: 1300, easing: Easing.inOut(Easing.ease), toValue: 1, useNativeDriver: true }),
        Animated.timing(bob, { duration: 1300, easing: Easing.inOut(Easing.ease), toValue: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const rotate = bob.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] });

  return (
    <View style={[styles.empty, { borderColor: EMPTY_BORDER[colorScheme] }]}>
      <Animated.View style={{ transform: [{ translateY }, { rotate }] }}>
        <Image contentFit="contain" source={CHARACTER_IMAGE} style={styles.emptyCharacter} />
      </Animated.View>
      <Text style={[styles.emptyTitle, { color: theme.ink, ...fonts.display }]}>이 조건엔 경기가 없어요</Text>
      <Text style={[styles.emptyBody, { color: theme.muted, ...fonts.regular }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, overflow: 'hidden' },
  empty: { alignItems: 'center', borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, minHeight: 160, paddingHorizontal: 20, paddingVertical: 40 },
  emptyBody: { fontSize: 14, lineHeight: 24, marginTop: 6, textAlign: 'center' },
  emptyCharacter: { height: 80, width: 80 },
  emptyTitle: { fontSize: 17, lineHeight: 25.5, marginTop: 8, textAlign: 'center' },
  heading: { fontSize: 18, lineHeight: 28 },
  headingRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 12 },
  list: { gap: 32 },
  liveBadge: { alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 999, flexDirection: 'row', gap: 4, paddingHorizontal: 6, paddingVertical: 2 },
  liveDot: { backgroundColor: '#ef4444', borderRadius: 3, height: 6, width: 6 },
  liveText: { color: '#ef4444', fontSize: 10, lineHeight: 15 },
  rowTouchable: { alignItems: 'center', columnGap: 10, flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12 },
  score: { fontSize: 15, lineHeight: 22.5, textAlign: 'center', width: 33 },
  scoreMasked: { alignItems: 'center', justifyContent: 'center', width: 33 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 10, lineHeight: 15 },
  teamName: { flexShrink: 1, fontSize: 15, lineHeight: 22.5 },
  teamSideLeft: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
  teamSideRight: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6 },
  teamsColumn: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 4, minWidth: 0 },
  time: { fontSize: 14, letterSpacing: -0.35, lineHeight: 21 },
  timeColumn: { alignItems: 'flex-start', gap: 4, width: 48 },
  todayBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  todayBadgeText: { fontSize: 13, lineHeight: 20.2222 },
});
