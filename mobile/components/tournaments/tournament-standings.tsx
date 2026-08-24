import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/data/team-logo';
import { tournamentTokens, type TournamentTokens } from '@/constants/tournament-theme';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobilePomRow, type MobileStandingRow, type MobileStandingsGroup } from '@/lib/api-client';

const EMPTY_BORDER = { dark: '#26735c', light: '#94dfc4' } as const;
const CHARACTER_IMAGE = require('@/assets/characters/pen-4.png');

function useTokens() {
  const { colorScheme } = useMinionTheme();
  return tournamentTokens[colorScheme];
}

export function TournamentStandingsGroups({ groups }: { groups: MobileStandingsGroup[] }) {
  if (groups.length === 0) {
    return <TournamentEmptyNotice message="아직 등록된 순위가 없습니다." />;
  }
  if (groups.length === 1 && groups[0].title === '') {
    return <RegularStandingsList rows={groups[0].rows} />;
  }
  return (
    <View style={styles.groupGrid}>
      {groups.map((group) => (
        <GroupStandingsCard group={group} key={group.title} />
      ))}
    </View>
  );
}

function GroupStandingsCard({ group }: { group: MobileStandingsGroup }) {
  const { fonts, theme } = useMinionTheme();
  const tokens = useTokens();

  return (
    <View style={styles.groupBlock}>
      <View style={styles.groupTitleRow}>
        <View style={[styles.groupTitleBar, { backgroundColor: theme.accent }]} />
        <Text style={[styles.groupTitleText, { color: theme.ink, fontFamily: fonts.display }]}>{group.title}</Text>
      </View>
      {group.rows.length === 0 ? (
        <View style={[styles.groupEmpty, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <Text style={{ color: tokens.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 }}>아직 등록된 순위가 없습니다.</Text>
        </View>
      ) : (
        <View style={[styles.groupCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          {group.rows.map((row, index) => (
            <GroupRow isLast={index === group.rows.length - 1} key={row.team.id} row={row} tokens={tokens} />
          ))}
        </View>
      )}
    </View>
  );
}

function GroupRow({ isLast, row, tokens }: { isLast: boolean; row: MobileStandingRow; tokens: TournamentTokens; }) {
  const router = useRouter();
  const { fonts } = useMinionTheme();
  const record = `${row.matchWins}승 · ${row.matchLosses}패`;
  const diff = row.setDiff >= 0 ? `+${row.setDiff}` : `${row.setDiff}`;

  return (
    <Pressable
      onPress={() => router.navigate(`/teams/${encodeURIComponent(row.team.slug)}` as never)}
      style={[styles.groupRow, !isLast && { borderBottomColor: tokens.border, borderBottomWidth: 1 }]}>
      <Text style={[styles.groupRank, { color: tokens.foreground, fontFamily: fonts.black }]}>{row.rank}</Text>
      <View style={styles.groupTeam}>
        <TeamLogo plain size={28} team={row.team} themeAware />
        <Text numberOfLines={1} style={[styles.groupTeamName, { color: tokens.foreground, fontFamily: fonts.bold }]}>{row.team.name}</Text>
      </View>
      <Text style={[styles.groupDiff, { color: tokens.muted, fontFamily: fonts.medium }]}>{diff}</Text>
      <Text style={[styles.groupRecord, { color: tokens.foreground, fontFamily: fonts.black }]}>{record}</Text>
    </Pressable>
  );
}

function RegularStandingsList({ rows }: { rows: MobileStandingRow[] }) {
  const tokens = useTokens();
  if (rows.length === 0) return <DataListEmptyState message="아직 등록된 경기가 없습니다." />;

  return (
    <View style={[styles.dataList, { backgroundColor: tokens.surface }]}>
      {rows.map((row, index) => (
        <RegularRow isLast={index === rows.length - 1} key={row.team.id} row={row} tokens={tokens} />
      ))}
    </View>
  );
}

function RegularRow({ isLast, row, tokens }: { isLast: boolean; row: MobileStandingRow; tokens: TournamentTokens }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();

  return (
    <Pressable
      onPress={() => router.navigate(`/teams/${encodeURIComponent(row.team.slug)}` as never)}
      style={[styles.dataRow, !isLast && { borderBottomColor: tokens.border, borderBottomWidth: 1 }]}>
      <View style={styles.dataMain}>
        <Text style={[styles.dataRank, { color: theme.ink, fontFamily: fonts.black }]}>{row.rank}</Text>
        <View style={styles.dataTeam}>
          <TeamLogo plain size={28} team={row.team} themeAware />
          <Text numberOfLines={1} style={[styles.dataTeamName, { color: theme.ink, fontFamily: fonts.bold }]}>{row.team.name}</Text>
        </View>
      </View>
      <View style={styles.dataMetrics}>
        <Metric label="승" theme={theme} value={String(row.matchWins)} />
        <Metric label="패" theme={theme} value={String(row.matchLosses)} />
      </View>
    </Pressable>
  );
}

function Metric({ compact = false, label, theme, value }: { compact?: boolean; label: string; theme: ReturnType<typeof useMinionTheme>['theme']; value: string }) {
  const { fonts } = useMinionTheme();
  return (
    <View style={[styles.metric, compact && styles.metricCompact]}>
      <Text style={[compact ? styles.metricLabelCompact : styles.metricLabel, { color: theme.muted, fontFamily: fonts.medium }]}>{label}</Text>
      <Text style={[compact ? styles.metricValueCompact : styles.metricValue, { color: theme.text, fontFamily: fonts.bold }]}>{value}</Text>
    </View>
  );
}

export function TournamentPomList({ rows }: { rows: MobilePomRow[] }) {
  const tokens = useTokens();
  if (rows.length === 0) return <DataListEmptyState message="아직 선정된 POM이 없습니다." />;

  return (
    <View style={[styles.dataList, { backgroundColor: tokens.surface }]}>
      {rows.map((row, index) => (
        <PomRow isLast={index === rows.length - 1} key={row.player.id} row={row} tokens={tokens} />
      ))}
    </View>
  );
}

function PomRow({ isLast, row, tokens }: { isLast: boolean; row: MobilePomRow; tokens: TournamentTokens }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  const imageUri = resolveApiAssetUrl(row.player.profileImage?.url);

  return (
    <Pressable
      onPress={() => router.navigate(`/players/${encodeURIComponent(row.player.slug)}` as never)}
      style={[styles.pomRow, !isLast && { borderBottomColor: tokens.border, borderBottomWidth: 1 }]}>
      <View style={styles.pomMain}>
        <Text style={[styles.pomRank, { color: theme.ink, fontFamily: fonts.black }]}>{row.rank}</Text>
        <View style={styles.pomPlayer}>
          {imageUri ? <Image contentFit="cover" source={{ uri: imageUri }} style={styles.pomAvatar} /> : null}
          <Text numberOfLines={1} style={[styles.pomName, { color: theme.ink, fontFamily: fonts.bold }]}>{row.player.name}</Text>
          <Text numberOfLines={1} style={[styles.pomTeam, { color: theme.muted, fontFamily: fonts.regular }]}>{row.team?.shortName ?? '-'}</Text>
        </View>
      </View>
      <View style={styles.dataMetrics}>
        <Metric compact label="포인트" theme={theme} value={String(row.points)} />
      </View>
    </Pressable>
  );
}

function DataListEmptyState({ message }: { message: string }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  const bob = useRef(new Animated.Value(0)).current;

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

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const rotate = bob.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] });

  return (
    <View style={[styles.dataEmpty, { borderColor: EMPTY_BORDER[colorScheme] }]}>
      <Animated.View style={{ transform: [{ translateY }, { rotate }] }}>
        <Image contentFit="contain" source={CHARACTER_IMAGE} style={styles.dataEmptyCharacter} />
      </Animated.View>
      <Text style={[styles.dataEmptyTitle, { color: theme.ink, fontFamily: fonts.display }]}>아직 숫자가 안 잡혔어요</Text>
      <Text style={[styles.dataEmptyBody, { color: theme.muted, fontFamily: fonts.regular }]}>{message}</Text>
    </View>
  );
}

export function TournamentEmptyNotice({ message }: { message: string }) {
  const tokens = useTokens();
  const { fonts } = useMinionTheme();
  return (
    <View style={[styles.notice, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      <Text style={{ color: tokens.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, textAlign: 'center' }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dataList: { overflow: 'hidden' },
  dataEmpty: { alignItems: 'center', borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, minHeight: 112, paddingHorizontal: 20, paddingVertical: 20 },
  dataEmptyBody: { fontSize: 14, lineHeight: 24, marginTop: 6, textAlign: 'center' },
  dataEmptyCharacter: { height: 56, width: 56 },
  dataEmptyTitle: { fontSize: 15, lineHeight: 22.5, marginTop: 8, textAlign: 'center' },
  dataMain: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12, minWidth: 0 },
  dataMetrics: { alignItems: 'center', flexDirection: 'row', flexShrink: 0, gap: 12 },
  dataRank: { fontSize: 16, fontStyle: 'italic', lineHeight: 24, textAlign: 'center', width: 28 },
  dataRow: { alignItems: 'center', flexDirection: 'row', gap: 16, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12 },
  dataTeam: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 },
  dataTeamName: { flexShrink: 1, fontSize: 14, lineHeight: 21 },
  groupBlock: { gap: 10 },
  groupCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  groupDiff: { flexShrink: 0, fontSize: 13, lineHeight: 19.5, textAlign: 'right' },
  groupEmpty: { alignItems: 'center', borderRadius: 12, borderWidth: 1, justifyContent: 'center', paddingVertical: 32 },
  groupGrid: { gap: 16 },
  groupRank: { fontSize: 14, fontStyle: 'italic', lineHeight: 20, width: 32 },
  groupRecord: { flexShrink: 0, fontSize: 13, lineHeight: 19.5, textAlign: 'right' },
  groupRow: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 58, paddingHorizontal: 14, paddingVertical: 12 },
  groupTeam: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 },
  groupTeamName: { flexShrink: 1, fontSize: 14 },
  groupTitleBar: { borderRadius: 999, height: 16, width: 3 },
  groupTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  groupTitleText: { fontSize: 16, lineHeight: 16 },
  metric: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
  metricCompact: { gap: 4 },
  metricLabel: { fontSize: 11, lineHeight: 16.5 },
  metricLabelCompact: { fontSize: 10, lineHeight: 15 },
  metricValue: { fontSize: 14, lineHeight: 21 },
  metricValueCompact: { fontSize: 13, lineHeight: 19.5 },
  notice: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 40 },
  pomAvatar: { borderRadius: 12, height: 24, width: 24 },
  pomMain: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 },
  pomName: { flexShrink: 1, fontSize: 13, lineHeight: 19.5 },
  pomPlayer: { alignItems: 'baseline', flex: 1, flexDirection: 'row', gap: 4, minWidth: 0 },
  pomRank: { fontSize: 14, fontStyle: 'italic', lineHeight: 21, textAlign: 'center', width: 24 },
  pomRow: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 52, paddingHorizontal: 12, paddingVertical: 8 },
  pomTeam: { flexShrink: 1, fontSize: 11, lineHeight: 16.5 },
});
