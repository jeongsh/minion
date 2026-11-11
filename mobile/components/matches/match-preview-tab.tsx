import Share2 from 'lucide-react-native/icons/share-2';
import { Platform, Pressable, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { StatRadar } from '@/components/charts/stat-radar';
import { PowerRankingChart } from '@/components/charts/power-ranking-chart';
import { TeamLogo } from '@/components/data/team-logo';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { mobileApiOrigin, type MobileMatchDetailDto, type MobileTeamSummary } from '@/lib/api-client';
import { previewTeamColor } from '../../../packages/contracts/src/preview-colors';
import { MatchRecordCards } from './match-preview-records';
import { Accuracy, Card, ChampionMap, Copy, FirstDragon, Gauge, LaneGold, LeagueRecord, Legend, SideRates } from './match-preview-charts';

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


function chartColors(teams: (MobileTeamSummary | null)[], ink: string, muted: string, dark: boolean) {
  const colors = teams.map((team) => previewTeamColor(team?.primaryColor, ink, dark));
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

/** 웹 ShareButton의 터치 기기 동작: OS 공유 시트로 경기 주소를 넘긴다. */
function ShareButton({ title, path }: { title: string; path: string }) {
  const { fonts, theme } = useMinionTheme();
  const share = () => {
    const url = `${mobileApiOrigin}${path}`;
    // Android 공유 시트는 url 필드를 쓰지 않아 주소를 message로 보낸다.
    void Share.share(Platform.OS === 'ios' ? { title, url } : { title, message: url }).catch(() => undefined);
  };
  return (
    <Pressable accessibilityRole="button" onPress={share} style={[styles.share, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Share2 color={theme.text} size={16} strokeWidth={1.8} />
      <Text style={{ color: theme.text, ...fonts.medium, fontSize: 13, lineHeight: 19.5, includeFontPadding: false }}>공유</Text>
    </Pressable>
  );
}

export function MatchPreviewTab({ data }: { data: MobileMatchDetailDto }) {
  const { width } = useWindowDimensions();
  const { colorScheme, fonts, theme } = useMinionTheme();
  const { ai, briefing, meetings } = data.preview;
  const charts = briefing?.charts;
  const teams = [data.match.teamA, data.match.teamB];
  const names = teams.map((team) => team?.shortName ?? team?.name ?? 'TBD');
  const colors = chartColors(teams, theme.ink, theme.muted, colorScheme === 'dark');
  const lineColors = colors;
  const series = briefing?.teams.map((stats, i) => ({ label: names[i], color: lineColors[i], scores: charts?.teams[i]?.scores ?? stats.scores, values: charts?.teams[i]?.values ?? stats.values, history: stats.history, dashed: i === 1 })) ?? [];
  const pair = { gap: 12, flexDirection: width >= 768 ? 'row' : 'column' } as const;
  return <View style={{ gap: 20 }}>
    <PredictionBar data={data} />
    <View>
      <View style={[styles.between, { marginBottom: 12 }]}><Text accessibilityRole="header" style={{ color: theme.ink, ...fonts.display, fontSize: 20, lineHeight: 27 }}>AI 브리핑</Text><ShareButton title={`${names[0]} vs ${names[1]} 승부예측`} path={`/matches/${encodeURIComponent(data.match.id)}`} /></View>
      <View style={{ gap: 12 }}>
        <Card><View style={{ gap: 16 }}>
          {width < 640 ? <><View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}><HeroTeam team={teams[0]} league={charts?.teams[0]?.league} rank={briefing?.teams[0]?.rank} /><HeroTeam team={teams[1]} league={charts?.teams[1]?.league} rank={briefing?.teams[1]?.rank} right /></View>{ai.winProbabilityA == null ? <Copy size={24} strong style={{ textAlign: 'center' }}>VS</Copy> : <Gauge names={names} colors={colors} probability={ai.winProbabilityA} />}</> : <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 32 }}><View style={{ flex: 1, alignItems: 'flex-end' }}><HeroTeam team={teams[0]} league={charts?.teams[0]?.league} rank={briefing?.teams[0]?.rank} /></View><View style={{ flex: 1, maxWidth: 220 }}>{ai.winProbabilityA == null ? <Copy size={24} strong style={{ textAlign: 'center' }}>VS</Copy> : <Gauge names={names} colors={colors} probability={ai.winProbabilityA} />}</View><View style={{ flex: 1 }}><HeroTeam team={teams[1]} league={charts?.teams[1]?.league} rank={briefing?.teams[1]?.rank} right /></View></View>}
          {charts?.oneLiner ? <Text style={{ color: theme.ink, ...(charts.oneLinerStrong ? fonts.medium : fonts.regular), fontSize: width < 640 ? 14 : 16, lineHeight: width < 640 ? 24 : 28, textAlign: width < 640 ? undefined : 'center', backgroundColor: theme.card, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 }}>{charts.oneLiner}</Text> : null}
        </View></Card>
        {charts?.watchPoints.length ? <Card contentGap={12} title="관전 포인트"><View style={{ gap: 12 }}>{charts.watchPoints.map((point, i) => <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}><View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: theme.card }}><Copy size={14} tabular>{i + 1}</Copy></View><Text style={{ flex: 1, paddingTop: 2, color: theme.text, ...fonts.regular, fontSize: width < 640 ? 14 : 16, lineHeight: 24 }}>{point}</Text></View>)}</View></Card> : null}
        {/* 결론(승리 확률, 관전 포인트) 다음에 전적, 팀 단위 지표, 선수와 밴픽, 배경 순으로 내려간다. */}
        <MatchRecordCards names={names} colors={colors} records={charts?.records} meetings={meetings} />
        {briefing ? <View style={pair}>
          <Card paired title="팀 성향 레이더" legend={<Legend names={names} colors={lineColors} line />}><StatRadar axes={charts?.axes ?? briefing.axes} series={series} showComparisonValues label={`${names[0]}와 ${names[1]}의 팀 성향 비교`} /></Card>
          <Card paired title="글로벌 파워랭킹 추이" legend={<Legend names={names} colors={lineColors} line />}><PowerRankingChart series={series} error={briefing.powerRankings.status === 'error'} /></Card>
        </View> : null}
        {charts ? <>
          <View style={pair}>
            <Card paired title="첫 드래곤 시점"><FirstDragon names={names} colors={colors} teams={charts.teams} /></Card>
            <Card paired title="진영별 승률" legend={<Legend names={['블루', '레드']} colors={['#2262f8', '#ff2f44']} />}><SideRates names={names} teams={charts.teams} logos={teams} /></Card>
          </View>
          <Card title="라인별 15분 골드 격차" legend={<Legend names={names} colors={colors} />}><LaneGold teams={charts.teams} colors={colors} /></Card>
          {charts.champions.some((item) => item.picksA) && charts.champions.some((item) => item.picksB) ? <Card title="챔피언 우선순위 맵" legend={<Legend names={names} colors={colors} />}><ChampionMap names={names} colors={colors} items={charts.champions} /></Card> : null}
          {charts.leagueRecord ? <Card title="리그 간 전력 비교"><LeagueRecord record={charts.leagueRecord} colors={colors} /></Card> : null}
          <Card title="AI 예측 적중률"><Accuracy accuracy={charts.accuracy} /></Card>
        </> : null}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  share: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', flexShrink: 0, gap: 6, height: 36, paddingHorizontal: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  prediction: { alignItems: 'stretch', borderRadius: 12, borderWidth: 1, flexDirection: 'row', height: 76, overflow: 'hidden' },
  choice: { alignItems: 'center', alignSelf: 'stretch', flex: 1, flexDirection: 'row', gap: 6, minWidth: 0, paddingHorizontal: 8 }, choiceReverse: { flexDirection: 'row-reverse' },
  choiceIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, minWidth: 0 }, predictionVs: { alignItems: 'center', justifyContent: 'center', width: 34 },
});
