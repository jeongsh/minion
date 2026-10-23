import { useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { StatRadar } from '@/components/charts/stat-radar';
import { PowerRankingChart } from '@/components/charts/power-ranking-chart';
import { TeamLogo } from '@/components/data/team-logo';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileMatchDetailDto, MobileTeamSummary } from '@/lib/api-client';
import { Accuracy, Card, ChampionMap, Copy, FirstDragon, Gauge, LaneGold, LeagueRecord, Legend, SideRates } from './match-preview-charts';

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
        <Text numberOfLines={1} style={{ color: theme.ink, ...fonts.black, fontSize: 15, lineHeight: 22.5 }}>{team?.shortName ?? 'TBD'}</Text>
      </View>
      <Text style={{ color: theme.ink, ...fonts.black, fontSize: 17, lineHeight: 17 }}>{percent}<Text style={{ color: theme.muted, ...fonts.medium, fontSize: 12, lineHeight: 12 }}>%</Text></Text>
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


function chartColors(teams: (MobileTeamSummary | null)[], ink: string, muted: string) {
  const colors = teams.map((team) => {
    const color = teamColor(team, ink);
    const [r, g, b] = [1, 3, 5].map((i) => {
      const channel = parseInt(color.slice(i, i + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance < 0.04 || luminance > 0.85 ? ink : color;
  });
  if (colors[0] === colors[1]) colors[1] = muted;
  return colors;
}

function HeroTeam({ team, league, rank, right }: { team: MobileTeamSummary | null; league?: string | null; rank?: number | null; right?: boolean }) {
  const { width } = useWindowDimensions();
  const { fonts, theme } = useMinionTheme();
  const desktop = width >= 640;
  const badge = league ? <Copy size={12} muted style={{ flexShrink: 0, borderWidth: 1, borderColor: theme.border, borderRadius: 6, paddingHorizontal: desktop ? 6 : 4, paddingVertical: desktop ? 2 : 0, lineHeight: 16 }}>{league}</Copy> : null;
  return <View style={{ flexDirection: right ? 'row-reverse' : 'row', alignItems: 'center', gap: desktop ? 12 : 8, minWidth: 0, flexShrink: 1 }}>
    <View style={{ height: desktop ? 48 : 40, minWidth: 0, flexShrink: 1, alignItems: right ? 'flex-start' : 'flex-end' }}>
      <View style={{ height: desktop ? 28 : 24, flexDirection: 'row', alignItems: 'center', gap: desktop ? 8 : 6, minWidth: 0 }}>
        {right ? null : badge}
        <Text numberOfLines={1} style={{ color: theme.ink, ...fonts.black, fontSize: desktop ? 24 : 16, lineHeight: desktop ? 28 : 24, flexShrink: 1 }}>{team?.shortName ?? '-'}</Text>
        {right ? badge : null}
      </View>
      {rank != null ? <View style={{ height: desktop ? 20 : 16, flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Copy muted numberOfLines={1} style={{ lineHeight: desktop ? 20 : 16 }}>{desktop ? '글로벌 ' : ''}파워랭킹</Copy>
        <Copy size={desktop ? 14 : 13} style={{ lineHeight: desktop ? 20 : 16, fontVariant: ['tabular-nums'] }}>{rank}위</Copy>
      </View> : null}
    </View>
    <TeamLogo team={team} size={desktop ? 56 : 40} plain themeAware />
  </View>;
}

export function MatchPreviewTab({ data }: { data: MobileMatchDetailDto }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colorScheme, fonts, showToast, theme } = useMinionTheme();
  const { ai, briefing, meetings } = data.preview;
  const charts = briefing?.charts;
  const teams = [data.match.teamA, data.match.teamB];
  const names = teams.map((team) => team?.shortName ?? team?.name ?? 'TBD');
  const colors = chartColors(teams, theme.ink, theme.muted);
  const lineColors = teams.map((team) => mixColor(teamColor(team, theme.ink), theme.ink, colorScheme === 'dark' ? 0.6 : 0.85));
  const series = briefing?.teams.map((stats, i) => ({ label: names[i], color: lineColors[i], scores: charts?.teams[i]?.scores ?? stats.scores, values: charts?.teams[i]?.values ?? stats.values, history: stats.history, dashed: i === 1 })) ?? [];
  const latestDate = briefing?.teams.flatMap((stats) => stats.history.at(-1)?.date ?? []).sort().at(-1);
  const sample = charts ? `${names[0]} ${charts.teams[0].sets}세트, ${names[1]} ${charts.teams[1].sets}세트 기준` : '';
  const openSource = (url: string) => { void Linking.openURL(url).catch(() => showToast('출처를 열지 못했습니다.', 'error')); };
  const pair = { gap: 12, flexDirection: width >= 768 ? 'row' : 'column' } as const;
  return <View style={{ gap: 20 }}>
    <PredictionBar data={data} />
    <View>
      <View style={[styles.between, { marginBottom: 12 }]}><Text accessibilityRole="header" style={{ color: theme.ink, ...fonts.display, fontSize: 20, lineHeight: 27 }}>AI 브리핑</Text>{ai.generatedAt ? <Copy muted>{day(ai.generatedAt)} 기준</Copy> : null}</View>
      <View style={{ gap: 12 }}>
        <Card><View style={{ gap: 16 }}>
          {width < 640 ? <><View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}><HeroTeam team={teams[0]} league={charts?.teams[0]?.league} rank={briefing?.teams[0]?.rank} /><HeroTeam team={teams[1]} league={charts?.teams[1]?.league} rank={briefing?.teams[1]?.rank} right /></View>{ai.winProbabilityA == null ? <Copy size={24} strong style={{ textAlign: 'center' }}>VS</Copy> : <Gauge names={names} colors={colors} probability={ai.winProbabilityA} />}</> : <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 32 }}><View style={{ flex: 1, alignItems: 'flex-end' }}><HeroTeam team={teams[0]} league={charts?.teams[0]?.league} rank={briefing?.teams[0]?.rank} /></View><View style={{ flex: 1, maxWidth: 220 }}>{ai.winProbabilityA == null ? <Copy size={24} strong style={{ textAlign: 'center' }}>VS</Copy> : <Gauge names={names} colors={colors} probability={ai.winProbabilityA} />}</View><View style={{ flex: 1 }}><HeroTeam team={teams[1]} league={charts?.teams[1]?.league} rank={briefing?.teams[1]?.rank} right /></View></View>}
          {charts?.oneLiner ? <Text style={{ color: theme.ink, ...(charts.oneLinerStrong ? fonts.medium : fonts.regular), fontSize: width < 640 ? 14 : 16, lineHeight: width < 640 ? 24 : 28, backgroundColor: theme.card, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 }}>{charts.oneLiner}</Text> : null}
        </View></Card>
        {briefing ? <View style={pair}>
          <Card paired title="팀 성향 레이더" caption={charts ? `수집 팀 내 백분위 ${names[0]} ${charts.teams[0].sets}세트, ${names[1]} ${charts.teams[1].sets}세트` : '최근 5매치 수집 팀 내 백분위'} legend={<Legend names={names} colors={lineColors} line />}><StatRadar axes={charts?.axes ?? briefing.axes} series={series} showComparisonValues label={`${names[0]}와 ${names[1]}의 팀 성향 비교`} /></Card>
          <Card paired title="글로벌 파워랭킹 추이" caption={<Pressable accessibilityRole="link" onPress={() => openSource(briefing.powerRankings.sourceUrl)}><Copy muted>LoL Esports{latestDate ? ` ${day(latestDate)} 기준` : ''}</Copy></Pressable>} legend={<Legend names={names} colors={lineColors} line />}><PowerRankingChart series={series} error={briefing.powerRankings.status === 'error'} /></Card>
        </View> : null}
        {charts ? <>
          <Card title="라인별 15분 골드 격차" caption={`주전 선수 평균 ${sample}`} legend={<Legend names={names} colors={colors} />}><LaneGold teams={charts.teams} colors={colors} /></Card>
          <View style={pair}>
            <Card paired title="첫 드래곤 시점" caption={`경기별 첫 드래곤 처치 시간 ${sample}`}><FirstDragon names={names} colors={colors} teams={charts.teams} /></Card>
            <Card paired title="진영별 승률" caption={sample} legend={<Legend names={['블루', '레드']} colors={['#2262f8', '#ff2f44']} />}><SideRates names={names} teams={charts.teams} logos={teams} /></Card>
          </View>
          {charts.champions.some((item) => item.picksA) && charts.champions.some((item) => item.picksB) ? <Card title="챔피언 우선순위 맵" caption={`원 크기는 두 팀 합계 픽 수 ${sample}`} legend={<Legend names={names} colors={colors} />}><ChampionMap names={names} colors={colors} items={charts.champions} /></Card> : null}
          {charts.leagueRecord ? <Card title="리그 간 전력 비교" caption={`${charts.accuracy.season} 국제 대회 맞대결 ${charts.leagueRecord.winsA + charts.leagueRecord.winsB}세트`}><LeagueRecord record={charts.leagueRecord} colors={colors} /></Card> : null}
          {charts.watchPoints.length ? <Card contentGap={12} title="관전 포인트"><View style={{ gap: 12 }}>{charts.watchPoints.map((point, i) => <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}><View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: theme.card }}><Copy size={14} tabular>{i + 1}</Copy></View><Text style={{ flex: 1, paddingTop: 2, color: theme.text, ...fonts.regular, fontSize: width < 640 ? 14 : 16, lineHeight: 24 }}>{point}</Text></View>)}</View></Card> : null}
        </> : null}
        {meetings.length ? <Card contentGap={12} title="최근 맞대결"><View style={{ gap: 8 }}>{meetings.map((match) => <Pressable key={match.id} accessibilityRole="link" onPress={() => router.push(`/matches/${encodeURIComponent(match.id)}` as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.card }}><Copy muted style={{ width: 48 }}>{day(match.startsAt)}</Copy><View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}><Text numberOfLines={1} style={{ color: theme.ink, flexShrink: 1, ...fonts.medium, fontSize: 15, lineHeight: 22.5 }}>{match.teamA?.shortName ?? '-'}</Text><TeamLogo plain size={20} team={match.teamA} themeAware /></View><Text style={{ color: theme.ink, ...fonts.black, fontSize: 15, lineHeight: 22.5 }}>{match.teamAScore} : {match.teamBScore}</Text><View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}><TeamLogo plain size={20} team={match.teamB} themeAware /><Text numberOfLines={1} style={{ color: theme.ink, flexShrink: 1, ...fonts.medium, fontSize: 15, lineHeight: 22.5 }}>{match.teamB?.shortName ?? '-'}</Text></View></View><Copy size={12} muted style={{ width: 40, textAlign: 'right', lineHeight: 16 }}>BO{match.bestOf}</Copy></Pressable>)}</View></Card> : null}
        {charts ? <Card title="AI 예측 적중률" caption="경기 시작 전 승률이 50%를 넘긴 팀이 이기면 적중"><Accuracy accuracy={charts.accuracy} /></Card> : null}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  prediction: { alignItems: 'stretch', borderRadius: 12, borderWidth: 1, flexDirection: 'row', height: 76, overflow: 'hidden' },
  choice: { alignItems: 'center', alignSelf: 'stretch', flex: 1, flexDirection: 'row', gap: 6, minWidth: 0, paddingHorizontal: 8 }, choiceReverse: { flexDirection: 'row-reverse' },
  choiceIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, minWidth: 0 }, predictionVs: { alignItems: 'center', justifyContent: 'center', width: 34 },
});
