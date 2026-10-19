import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { TeamLogo } from '@/components/data/team-logo';
import { tournamentTokens } from '@/constants/tournament-theme';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileBracketMatch, MobileSwissBracketData } from '../../../packages/contracts/src/mobile-v1';
import { SWISS_GROUP_POSITIONS, SWISS_RESULT_POSITIONS } from '../../../packages/contracts/src/tournament-bracket-layout';

export function InlineTournamentMatch({ match }: { match?: MobileBracketMatch }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  const tokens = tournamentTokens[colorScheme];
  const hasScore = match?.teamAScore != null && match?.teamBScore != null;
  return <View style={styles.matchRow}>{[match?.teamA, match?.teamB].map((rawTeam, index) => {
    const team = rawTeam && !/^(tbd|미정)$/i.test(rawTeam.name.trim()) ? rawTeam : null;
    const loser = match?.status === 'completed' && match.winnerTeamId !== team?.id;
    return <Fragment key={index}>
      {index === 1 ? <Text style={{ color: tokens.foreground, fontSize: 13, lineHeight: 19.5, ...fonts.medium }}>{hasScore ? `${match!.teamAScore} : ${match!.teamBScore}` : 'vs'}</Text> : null}
      <View style={[styles.team, index === 1 && { flexDirection: 'row-reverse' }]}>
        <View style={[styles.bar, { backgroundColor: team ? team.primaryColor ?? theme.accent : theme.muted }]} />
        <TeamLogo team={team} size={24} plain themeAware />
        <Text numberOfLines={1} style={{ color: loser ? tokens.muted : tokens.foreground, flexShrink: 1, fontSize: 14, lineHeight: 20, ...fonts.medium }}>{team?.shortName || '미정'}</Text>
      </View>
    </Fragment>;
  })}</View>;
}

export function TournamentSwissBracket({ data }: { data: MobileSwissBracketData }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  const router = useRouter();
  const tokens = tournamentTokens[colorScheme];
  const rects = new Map<string, { x: number; y: number; height: number }>();
  for (const group of data.groups) {
    const position = SWISS_GROUP_POSITIONS[group.key];
    const count = group.matches.length + group.pending;
    const height = 29 + 2 + 16 + count * 40 + Math.max(0, count - 1) * 8 + 36.5;
    rects.set(group.key, { x: (position.column - 1) * 250, y: (position.row - 1) * 15 + (position.span * 15 - height) / 2 + 29, height: height - 29 });
  }
  for (const result of SWISS_RESULT_POSITIONS) rects.set(`${result.wins}-${result.losses}`, { x: (result.column - 1) * 250, y: (result.row - 1) * 15 + (result.span * 15 - 77) / 2 + 29, height: 48 });
  const paths = data.groups.flatMap(group => [ `${group.wins + 1}-${group.losses}`, `${group.wins}-${group.losses + 1}` ].flatMap(key => {
    const from = rects.get(group.key), to = rects.get(key);
    if (!from || !to) return [];
    const x1 = from.x + 218, x2 = to.x, y1 = from.y + from.height / 2, y2 = to.y + to.height / 2, mid = (x1 + x2) / 2;
    return [{ id: `${group.key}-${key}`, d: `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}` }];
  }));
  const text = { color: tokens.foreground, fontSize: 14, lineHeight: 21, ...fonts.medium };
  const meta = { color: tokens.muted, fontSize: 13, lineHeight: 19.5, ...fonts.medium };
  return <View style={[styles.outer, { backgroundColor: tokens.surface, borderColor: tokens.border }]}><ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={{ width: 1468, height: data.unclassified.length ? 850 : 720 }}>
    <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject}>{paths.map(path => <Path key={path.id} d={path.d} stroke={tokens.border} strokeWidth={2} fill="none" />)}</Svg>
    {data.groups.map(group => {
      const rect = rects.get(group.key)!;
      const label = group.wins === 2 && group.losses === 2 ? '최종 진출전' : group.wins === 2 ? '진출 결정전' : group.losses === 2 ? '탈락 결정전' : '';
      return <View key={group.key} style={[styles.node, { left: rect.x, top: rect.y - 29 }]}>
        <View style={styles.heading}><Text style={text}>{group.wins}승 {group.losses}패</Text>{label ? <Text style={meta}>{label}</Text> : null}</View>
        <View style={[styles.group, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <View style={[styles.matches, { backgroundColor: theme.card }]}>
            {group.matches.map(match => <Pressable key={match.id} onPress={() => router.navigate(`/matches/${encodeURIComponent(match.id)}` as never)} style={[styles.match, { backgroundColor: tokens.surface }]}><InlineTournamentMatch match={match} /></Pressable>)}
            {Array.from({ length: group.pending }, (_, index) => <View key={index} style={[styles.match, { backgroundColor: tokens.surface }]}><InlineTournamentMatch /></View>)}
          </View>
          <View style={[styles.footer, { borderTopColor: tokens.border }]}><Text style={[meta, { color: tokens.foreground }]}>BO{group.bestOf}</Text><Text style={meta}>{group.dateLabel}</Text></View>
        </View>
      </View>;
    })}
    {data.results.map(result => {
      const rect = rects.get(result.key)!;
      const qualified = result.wins === 3;
      return <View key={result.key} style={[styles.node, { left: rect.x, top: rect.y - 29 }]}>
        <View style={styles.heading}><Text style={text}>{result.wins}승 {result.losses}패</Text><Text style={meta}>{qualified ? '8강 진출' : '탈락'}</Text></View>
        <View style={[styles.result, { backgroundColor: tokens.surface, borderColor: qualified ? theme.accent : tokens.border }]}>{result.teams.map((team, index) => <View key={index} style={styles.resultTeam}><TeamLogo team={team} size={20} plain themeAware /><Text style={[meta, { color: tokens.foreground }]}>{team?.shortName ?? '–'}</Text></View>)}</View>
      </View>;
    })}
    {data.unclassified.length ? <View style={styles.unclassified}>{data.unclassified.map(match => <Pressable key={match.id} onPress={() => router.navigate(`/matches/${encodeURIComponent(match.id)}` as never)} style={[styles.match, { backgroundColor: tokens.surface, width: 200 }]}><InlineTournamentMatch match={match} /></Pressable>)}</View> : null}
  </View></ScrollView></View>;
}

const styles = StyleSheet.create({
  bar: { borderRadius: 999, height: 20, width: 4 },
  footer: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  group: { borderRadius: 6, borderWidth: 1, overflow: 'hidden' },
  heading: { alignItems: 'baseline', flexDirection: 'row', height: 21, justifyContent: 'space-between', paddingHorizontal: 2 },
  match: { borderRadius: 6, overflow: 'hidden' },
  matches: { gap: 8, padding: 8 },
  matchRow: { alignItems: 'center', flexDirection: 'row', gap: 2, height: 40, paddingHorizontal: 8, paddingVertical: 8 },
  node: { gap: 8, position: 'absolute', width: 218 },
  outer: { borderRadius: 8, borderWidth: 1, padding: 16 },
  result: { alignItems: 'center', borderRadius: 6, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'space-around', minHeight: 48, paddingHorizontal: 8, paddingVertical: 8 },
  resultTeam: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  team: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 2, minWidth: 0 },
  unclassified: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, position: 'absolute', top: 740 },
});
