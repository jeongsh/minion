import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/data/team-logo';
import { TournamentDataTable } from '@/components/tournaments/tournament-data-table';
import { tournamentTokens } from '@/constants/tournament-theme';
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

function DataText({ children, medium = false, italic = false }: { children: React.ReactNode; medium?: boolean; italic?: boolean }) {
  const { fonts, theme } = useMinionTheme();
  return <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20, ...(medium ? fonts.medium : fonts.regular), ...(italic ? { fontStyle: 'italic' } : {}) }}>{children}</Text>;
}

function TeamIdentity({ team, size = 28 }: { team: MobileStandingRow['team']; size?: number }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  return <Pressable onPress={() => router.navigate(`/teams?team=${encodeURIComponent(team.fanSiteHost || team.slug)}` as never)} style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
    {team.logo?.url ? <TeamLogo plain size={size} team={team} themeAware /> : null}
    <Text numberOfLines={1} style={{ color: theme.text, fontSize: 14, lineHeight: 20, ...fonts.medium }}>{team.name}</Text>
  </Pressable>;
}

function GroupStandingsCard({ group }: { group: MobileStandingsGroup }) {
  const { fonts, theme } = useMinionTheme();
  return <View style={styles.groupBlock}>
    <View style={styles.groupTitleRow}><View style={[styles.groupTitleBar, { backgroundColor: theme.accent }]} /><Text style={[styles.groupTitleText, { color: theme.ink, ...fonts.display }]}>{group.title}</Text></View>
    {group.rows.length === 0 ? <DataListEmptyState message="표시할 데이터가 없습니다." /> : <TournamentDataTable rows={group.rows} columns={[
      { key: 'rank', label: '순위', width: 56, render: row => <DataText medium italic>{row.rank}</DataText> },
      { key: 'team', label: '팀', width: 112, flex: true, render: row => <TeamIdentity team={row.team} /> },
      { key: 'diff', label: '득실차', width: 65.25, align: 'center', render: row => <DataText>{row.setDiff >= 0 ? '+' : ''}{row.setDiff}</DataText> },
      { key: 'record', label: '전적', width: 74.59375, align: 'center', render: row => <DataText>{row.matchWins}승 {row.matchLosses}패</DataText> },
    ]} />}
  </View>;
}

function RegularStandingsList({ rows }: { rows: MobileStandingRow[] }) {
  if (rows.length === 0) return <DataListEmptyState message="아직 등록된 경기가 없습니다." />;
  return <TournamentDataTable rows={rows} columns={[
    { key: 'team', label: '팀 순위', width: 288, flex: true, render: row => <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}><View style={{ alignItems: 'center', width: 24 }}><DataText medium italic>{row.rank}</DataText></View><TeamIdentity team={row.team} size={24} /></View> },
    { key: 'wins', label: '승', width: 44, align: 'center', render: row => <DataText medium>{row.matchWins}</DataText> },
    { key: 'losses', label: '패', width: 44, align: 'center', render: row => <DataText>{row.matchLosses}</DataText> },
    { key: 'diff', label: '득실차', width: 65.25, align: 'center', render: row => <DataText>{row.setDiff}</DataText> },
    { key: 'rate', label: '승률', width: 74, align: 'center', render: row => <DataText>{row.winRate}</DataText> },
  ]} />;
}

export function TournamentPomList({ rows }: { rows: MobilePomRow[] }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  if (rows.length === 0) return <DataListEmptyState message="아직 선정된 POM이 없습니다." />;
  return <TournamentDataTable rows={rows} onPressRow={row => router.navigate(`/players/${encodeURIComponent(row.player.slug)}` as never)} columns={[
    { key: 'player', label: '선수', width: 288, flex: true, render: row => <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
      <View style={{ alignItems: 'center', width: 24 }}><DataText medium italic>{row.rank}</DataText></View>
      {row.player.profileImage?.url ? <Image contentFit="cover" source={{ uri: resolveApiAssetUrl(row.player.profileImage.url) ?? undefined }} style={styles.pomAvatar} /> : null}
      <View style={styles.pomIdentity}><Text numberOfLines={1} style={{ color: theme.text, fontSize: 13, lineHeight: 19.5, ...fonts.medium }}>{row.player.name}</Text><Text numberOfLines={1} style={{ color: theme.muted, fontSize: 13, lineHeight: 19.5, ...fonts.medium }}>{row.team?.shortName ?? '-'}</Text></View>
    </View> },
    { key: 'points', label: '포인트', width: 60.3125, align: 'center', render: row => <DataText medium>{row.points}</DataText> },
  ]} />;
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
      <Text style={[styles.dataEmptyTitle, { color: theme.ink, ...fonts.display }]}>아직 숫자가 안 잡혔어요</Text>
      <Text style={[styles.dataEmptyBody, { color: theme.muted, ...fonts.regular }]}>{message}</Text>
    </View>
  );
}

export function TournamentEmptyNotice({ message }: { message: string }) {
  const tokens = useTokens();
  const { fonts } = useMinionTheme();
  return (
    <View style={[styles.notice, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      <Text style={{ color: tokens.muted, ...fonts.regular, fontSize: 14, lineHeight: 21, textAlign: 'center' }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dataList: { overflow: 'hidden' },
  dataEmpty: { alignItems: 'center', borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, minHeight: 112, paddingHorizontal: 20, paddingVertical: 20 },
  dataEmptyBody: { fontSize: 14, lineHeight: 24, marginTop: 6, textAlign: 'center' },
  dataEmptyCharacter: { height: 56, width: 56 },
  dataEmptyTitle: { fontSize: 15, lineHeight: 22.5, marginTop: 8, textAlign: 'center' },
  dataMain: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10, minWidth: 0 },
  dataMetrics: { alignItems: 'center', flexDirection: 'row', flexShrink: 0, gap: 10 },
  dataRank: { fontSize: 14, fontStyle: 'italic', lineHeight: 21, textAlign: 'center', width: 24 },
  dataRow: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 52, paddingHorizontal: 12, paddingVertical: 8 },
  dataTeam: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 },
  dataTeamName: { flexShrink: 1, fontSize: 13, lineHeight: 19.5 },
  groupBlock: { gap: 10 },
  groupCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  groupDiff: { flexShrink: 0, fontSize: 12, lineHeight: 18, textAlign: 'right' },
  groupEmpty: { alignItems: 'center', borderRadius: 12, borderWidth: 1, justifyContent: 'center', paddingVertical: 32 },
  groupGrid: { gap: 16 },
  groupRank: { fontSize: 13, fontStyle: 'italic', lineHeight: 19.5, width: 24 },
  groupRecord: { flexShrink: 0, fontSize: 12, lineHeight: 18, textAlign: 'right' },
  groupRow: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 52, paddingHorizontal: 12, paddingVertical: 8 },
  groupTeam: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 },
  groupTeamName: { flexShrink: 1, fontSize: 13 },
  groupTitleBar: { borderRadius: 999, height: 14, width: 3 },
  groupTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  groupTitleText: { fontSize: 15, lineHeight: 15 },
  metric: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
  metricCompact: { gap: 4 },
  metricLabel: { fontSize: 11, lineHeight: 16.5 },
  metricLabelCompact: { fontSize: 10, lineHeight: 15 },
  metricValue: { fontSize: 14, lineHeight: 21 },
  metricValueCompact: { fontSize: 13, lineHeight: 19.5 },
  notice: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 40 },
  pomAvatar: { borderRadius: 12, height: 24, width: 24 },
  pomIdentity: { alignItems: 'baseline', flex: 1, flexDirection: 'row', gap: 4, minWidth: 0 },
  pomMain: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 },
  pomName: { flexShrink: 1, fontSize: 13, lineHeight: 19.5 },
  pomPlayer: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 },
  pomRank: { fontSize: 14, fontStyle: 'italic', lineHeight: 21, textAlign: 'center', width: 24 },
  pomRow: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 52, paddingHorizontal: 12, paddingVertical: 8 },
  pomTeam: { flexShrink: 1, fontSize: 11, lineHeight: 16.5 },
});
