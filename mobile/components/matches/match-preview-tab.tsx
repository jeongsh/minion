import { useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { StatRadar } from '@/components/charts/stat-radar';
import { PowerRankingChart } from '@/components/charts/power-ranking-chart';
import { TeamLogo } from '@/components/data/team-logo';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileMatchDetailDto, MobileTeamSummary } from '@/lib/api-client';

type Briefing = NonNullable<MobileMatchDetailDto['preview']['briefing']>;
const day = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).format(new Date(value));

function teamColor(team: MobileTeamSummary | null, fallback: string) {
  return team?.primaryColor && /^#[\da-f]{6}$/i.test(team.primaryColor) ? team.primaryColor : fallback;
}

function mixColor(color: string, ink: string, weight: number) {
  if (!/^#[\da-f]{6}$/i.test(color) || !/^#[\da-f]{6}$/i.test(ink)) return color;
  return '#' + [1, 3, 5].map((i) => Math.round(parseInt(color.slice(i, i + 2), 16) * weight + parseInt(ink.slice(i, i + 2), 16) * (1 - weight)).toString(16).padStart(2, '0')).join('');
}

function PredictionChoice({ percent, reverse, team }: { percent: number; reverse?: boolean; team: MobileTeamSummary | null }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={[styles.choice, reverse && styles.choiceReverse]}>
      <View style={[styles.choiceIdentity, reverse && styles.choiceReverse]}>
        <TeamLogo plain size={28} team={team} themeAware />
        <Text numberOfLines={1} style={{ color: theme.ink, ...fonts.black, fontSize: 15, lineHeight: 20 }}>{team?.shortName ?? 'TBD'}</Text>
      </View>
      <Text style={{ color: theme.ink, ...fonts.black, fontSize: 17, lineHeight: 20 }}>{percent}<Text style={{ color: theme.muted, ...fonts.medium, fontSize: 12 }}>%</Text></Text>
    </View>
  );
}

function PredictionBar({ data }: { data: MobileMatchDetailDto }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  return (
    <View style={[styles.prediction, { backgroundColor: colorScheme === 'dark' ? theme.surfaceMuted : theme.surface, borderColor: theme.border }]}>
      <PredictionChoice percent={data.preview.prediction.teamAPercent} team={data.match.teamA} />
      <View style={styles.predictionVs}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>VS</Text></View>
      <PredictionChoice percent={data.preview.prediction.teamBPercent} reverse team={data.match.teamB} />
    </View>
  );
}


function Legend({ names, colors }: { names: string[]; colors: string[] }) {
  const { fonts, theme } = useMinionTheme();
  return <View style={{ flexDirection: 'row', gap: 12 }}>{names.map((name, i) => <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 16, borderTopWidth: 2, borderColor: colors[i], borderStyle: i ? 'dashed' : 'solid' }} /><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>{name}</Text></View>)}</View>;
}

function TeamProfile({ team, stats, condition, axes }: { team: MobileTeamSummary | null; stats: Briefing['teams'][number]; condition: string | null; axes: Briefing['axes'] }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  const { width } = useWindowDimensions();
  const strongest = stats.scores.map((score, index) => ({ score, index })).filter((item) => item.score != null).sort((a, b) => b.score! - a.score!).slice(0, 2);
  const muted = { color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 19.5 } as const;
  return <View accessibilityLabel={`${team?.shortName ?? '팀'} 프로필`} style={[styles.card, { backgroundColor: colorScheme === 'dark' ? theme.surfaceMuted : theme.surface, borderColor: theme.border, padding: width >= 640 ? 16 : 14, gap: 16 }]}>
    <View style={styles.between}><View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>{width >= 640 ? <TeamLogo plain size={28} team={team} themeAware /> : null}<View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: theme.ink, ...fonts.black, fontSize: 15, lineHeight: 20 }}>{team?.shortName ?? '-'}</Text><Text numberOfLines={1} style={[muted, { lineHeight: 16 }]}>{team?.name}</Text></View></View><View style={{ alignItems: 'flex-end' }}><Text style={{ color: theme.ink, ...fonts.black, fontSize: 15, lineHeight: 20 }}>{stats.rank != null ? `${stats.rank}위` : '-'}</Text><Text style={[muted, { lineHeight: 16 }]}>세계 순위</Text></View></View>
    <View style={{ flexDirection: width >= 640 ? 'row' : 'column', gap: width >= 640 ? 16 : 12 }}><View style={{ flex: width >= 640 ? 1 : undefined }}><Text style={{ color: theme.ink, ...fonts.black, fontSize: 20, lineHeight: 24 }}>{stats.form.length ? `${stats.wins}승 ${stats.losses}패` : '-'}</Text><Text style={[muted, { marginTop: 2 }]}>최근 {stats.form.length || 5}매치</Text><View accessibilityLabel={stats.form.map((item) => item === 'W' ? '승' : '패').join(' ') || '최근 경기 없음'} style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>{stats.form.map((result, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 999, backgroundColor: result === 'W' ? teamColor(team, theme.ink) : theme.muted, opacity: result === 'W' ? 1 : 0.35 }} />)}</View></View><View style={{ flex: width >= 640 ? 1 : undefined }}><Text style={{ color: theme.ink, ...fonts.black, fontSize: 20, lineHeight: 24 }}>{stats.setWinRate != null ? `${stats.setWinRate}%` : '-'}</Text><Text style={[muted, { marginTop: 2 }]}>세트 승률</Text></View></View>
    <View><Text style={muted}>강점</Text><View style={{ marginTop: 4 }}>{strongest.length ? strongest.map(({ index }) => <Text key={index} style={{ color: theme.text, ...fonts.regular, fontSize: 16, lineHeight: 24 }}>{axes[index].title} <Text style={{ color: theme.ink }}>{stats.values[index]}</Text></Text>) : <Text style={{ color: theme.text, ...fonts.regular, fontSize: 16, lineHeight: 24 }}>수집된 지표 없음</Text>}</View></View>
    <View><Text style={muted}>승리 조건</Text><Text style={{ color: theme.text, ...fonts.regular, fontSize: 16, lineHeight: 24, marginTop: 4 }}>{condition ?? '분석 대기'}</Text></View>
  </View>;
}

export function MatchPreviewTab({ data }: { data: MobileMatchDetailDto }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colorScheme, fonts, showToast, theme } = useMinionTheme();
  const { ai, briefing, meetings } = data.preview;
  const teams = [data.match.teamA, data.match.teamB];
  const names = teams.map((team) => team?.shortName ?? team?.name ?? 'TBD');
  const colors = teams.map((team) => mixColor(teamColor(team, theme.ink), theme.ink, colorScheme === 'dark' ? 0.6 : 0.85));
  const series = briefing?.teams.map((stats, i) => ({ label: names[i], color: colors[i], scores: stats.scores, values: stats.values, history: stats.history, dashed: i === 1 })) ?? [];
  const latestDate = briefing?.teams.flatMap((stats) => stats.history.at(-1)?.date ?? []).sort().at(-1);
  const openSource = (url: string) => { void Linking.openURL(url).catch(() => showToast('출처를 열지 못했습니다.', 'error')); };
  const card = [styles.card, { backgroundColor: colorScheme === 'dark' ? theme.surfaceMuted : theme.surface, borderColor: theme.border, padding: width >= 640 ? 16 : 14 }];
  return <View style={{ gap: 20 }}>
    <PredictionBar data={data} />
    <View>
      <View style={[styles.between, { marginBottom: 12 }]}><Text accessibilityRole="header" style={{ color: theme.ink, ...fonts.display, fontSize: 20, lineHeight: 28 }}>AI 브리핑</Text>{ai.generatedAt ? <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>{day(ai.generatedAt)} 기준</Text> : null}</View>
      {briefing?.issue || ai.summary ? <View style={[card, { marginBottom: 16 }]}>{briefing?.issue ? <Pressable disabled={!briefing.issueSource} accessibilityRole={briefing.issueSource ? 'link' : undefined} onPress={() => briefing.issueSource && openSource(briefing.issueSource)}><Text style={{ color: theme.ink, ...fonts.black, fontSize: 16, lineHeight: 24 }}>{briefing.issue}</Text></Pressable> : null}{ai.summary ? <Text style={{ color: theme.text, ...fonts.regular, fontSize: 16, lineHeight: 28, marginTop: briefing?.issue ? 6 : 0 }}>{ai.summary}</Text> : null}{ai.narrative?.tags.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>{ai.narrative.tags.map((tag, i) => <Text key={i} style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 20, borderWidth: 1, borderColor: theme.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>#{tag}</Text>)}</View> : null}</View> : null}
      {briefing ? <>
        <View style={{ gap: width >= 640 ? 12 : 10 }}>{briefing.teams.map((stats, i) => <TeamProfile key={stats.teamId} stats={stats} team={teams[i]} axes={briefing.axes} condition={i ? ai.teamBWinCondition : ai.teamAWinCondition} />)}</View>
        <View style={{ marginTop: 10, gap: width >= 640 ? 12 : 10, flexDirection: width >= 768 ? 'row' : 'column' }}>
          <View style={[card, { flex: width >= 768 ? 1 : undefined, gap: 8 }]}><View style={styles.chartHeading}><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 18, lineHeight: 28 }}>팀 지표 비교</Text><Legend names={names} colors={colors} /></View><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>최근 5매치 수집 팀 내 백분위</Text>{briefing.teams.some((item) => item.statSetCount) ? <StatRadar axes={briefing.axes} series={series} showComparisonValues label={`${names[0]}와 ${names[1]}의 최근 5매치 팀 지표 비교`} /> : <View style={styles.emptyChart}><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 16 }}>수집된 팀 지표 없음</Text></View>}</View>
          <View style={[card, { flex: width >= 768 ? 1 : undefined, gap: 8 }]}><View style={styles.chartHeading}><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 18, lineHeight: 28 }}>파워랭킹 추이</Text><Legend names={names} colors={colors} /></View><Pressable accessibilityRole="link" onPress={() => openSource(briefing.powerRankings.sourceUrl)}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>LoL Esports{latestDate ? ` ${day(latestDate)} 기준` : ''}</Text></Pressable><PowerRankingChart series={series} error={briefing.powerRankings.status === 'error'} /></View>
        </View>
      </> : null}
      {meetings.length ? <View style={{ marginTop: 16 }}><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 18, lineHeight: 28, marginBottom: 8 }}>최근 맞대결</Text><View style={{ gap: 8 }}>{meetings.map((match) => <Pressable key={match.id} accessibilityRole="link" onPress={() => router.push(`/matches/${encodeURIComponent(match.id)}` as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.card }}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>{day(match.startsAt)}</Text><View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}><TeamLogo plain size={20} team={match.teamA} themeAware /><Text numberOfLines={1} style={{ color: theme.ink, flexShrink: 1, ...fonts.medium, fontSize: 15 }}>{match.teamA?.shortName ?? '-'}</Text><Text style={{ color: theme.ink, ...fonts.black, fontSize: 15 }}>{match.teamAScore} : {match.teamBScore}</Text><Text numberOfLines={1} style={{ color: theme.ink, flexShrink: 1, ...fonts.medium, fontSize: 15 }}>{match.teamB?.shortName ?? '-'}</Text><TeamLogo plain size={20} team={match.teamB} themeAware /></View><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 12 }}>BO{match.bestOf}</Text></Pressable>)}</View></View> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  card: { borderWidth: 1, borderRadius: 12, minWidth: 0 },
  chartHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  emptyChart: { height: 280, alignItems: 'center', justifyContent: 'center' },
  prediction: { alignItems: 'stretch', borderRadius: 12, borderWidth: 1, flexDirection: 'row', height: 76, overflow: 'hidden' },
  choice: { alignItems: 'center', alignSelf: 'stretch', flex: 1, flexDirection: 'row', gap: 6, minWidth: 0, paddingHorizontal: 8 }, choiceReverse: { flexDirection: 'row-reverse' },
  choiceIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, minWidth: 0 }, predictionVs: { alignItems: 'center', justifyContent: 'center', width: 34 },
});
