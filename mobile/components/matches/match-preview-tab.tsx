import { StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/data/team-logo';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileMatchDetailDto, MobileMatchSummary, MobileTeamSummary } from '@/lib/api-client';

function teamColor(team: MobileTeamSummary | null, fallback: string) {
  return team?.primaryColor && /^#[\da-f]{6}$/i.test(team.primaryColor) ? team.primaryColor : fallback;
}

function oddsLabel(value: number | null) {
  return (value ?? 1).toFixed(2);
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function meetingDate(value: string) {
  const parts = new Intl.DateTimeFormat('ko-KR', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Seoul' }).formatToParts(new Date(value));
  return `${parts.find((part) => part.type === 'month')?.value ?? '--'}. ${parts.find((part) => part.type === 'day')?.value ?? '--'}`;
}

function previewTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('ko-KR', {
    day: 'numeric',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'long',
    timeZone: 'Asia/Seoul',
  }).format(date);
}

function sourceDay(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('ko-KR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).format(date);
}

function PredictionChoice({ odds, percent, reverse, team }: { odds: number | null; percent: number; reverse?: boolean; team: MobileTeamSummary | null }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={[styles.choice, reverse && styles.choiceReverse]}>
      <View style={[styles.choiceIdentity, reverse && styles.choiceReverse]}>
        <TeamLogo plain size={28} team={team} themeAware />
        <View style={[styles.choiceLabel, reverse && styles.choiceReverse]}>
          <Text numberOfLines={1} style={{ color: theme.ink, ...fonts.black, fontSize: 15, lineHeight: 20 }}>{team?.shortName ?? 'TBD'}</Text>
          <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 18 }}>{oddsLabel(odds)} 배</Text>
        </View>
      </View>
      <Text style={{ color: theme.ink, ...fonts.black, fontSize: 17, lineHeight: 20 }}>{percent}<Text style={{ color: theme.muted, ...fonts.medium, fontSize: 12 }}>%</Text></Text>
    </View>
  );
}

function PredictionBar({ data }: { data: MobileMatchDetailDto }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  return (
    <View style={[styles.prediction, { backgroundColor: colorScheme === 'dark' ? theme.surfaceMuted : theme.surface, borderColor: theme.border }]}>
      <PredictionChoice odds={data.preview.prediction.teamAOdds} percent={data.preview.prediction.teamAPercent} team={data.match.teamA} />
      <View style={styles.predictionVs}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>VS</Text></View>
      <PredictionChoice odds={data.preview.prediction.teamBOdds} percent={data.preview.prediction.teamBPercent} reverse team={data.match.teamB} />
    </View>
  );
}

function WatchPoint({ lead, rest }: { lead: string; rest: string }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={styles.watchPointLine}>
      <View style={styles.watchPointLead}>
        <View pointerEvents="none" style={[styles.watchPointHighlight, { backgroundColor: `${theme.accent}38` }]} />
        <Text style={[styles.watchPointText, { color: theme.ink, ...fonts.medium }]}>{lead}</Text>
      </View>
      {rest ? <Text style={[styles.watchPointText, { color: theme.ink, ...fonts.medium }]}> {rest}</Text> : null}
    </View>
  );
}

function BriefingRow({ children, label }: { children: React.ReactNode; label: string }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={[styles.briefingRow, { backgroundColor: theme.card }]}>
      <Text style={{ color: theme.ink, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>{label}</Text>
      {children}
    </View>
  );
}

function MetricCard({ colorA, colorB, label, valueA, valueB }: { colorA: string; colorB: string; label: string; valueA: string; valueB: string }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={[styles.metricCard, { backgroundColor: theme.surface }]}>
      <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{label}</Text>
      <Text numberOfLines={1} style={{ ...fonts.bold, fontSize: 15, lineHeight: 21 }}>
        <Text style={{ color: colorA }}>{valueA}</Text><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 12 }}>vs</Text><Text style={{ color: colorB }}>{valueB}</Text>
      </Text>
    </View>
  );
}

function MeetingSide({ match, side }: { match: MobileMatchSummary; side: 'a' | 'b' }) {
  const { fonts, theme } = useMinionTheme();
  const team = side === 'a' ? match.teamA : match.teamB;
  const score = side === 'a' ? match.teamAScore : match.teamBScore;
  const won = match.winnerTeamId === team?.id;
  return (
    <View style={[styles.meetingSide, side === 'a' && styles.meetingSideA]}>
      <Text style={{ color: won ? theme.ink : theme.muted, ...fonts.bold, fontSize: 15, lineHeight: 20 }}>{score ?? '-'}</Text>
      <Text numberOfLines={1} style={{ color: won ? theme.ink : theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>{team?.shortName ?? 'TBD'}</Text>
      <TeamLogo plain size={20} team={team} themeAware />
    </View>
  );
}

function MeetingRow({ match }: { match: MobileMatchSummary }) {
  const { fonts, theme } = useMinionTheme();
  const winner = match.winnerTeamId === match.teamA?.id ? match.teamA : match.teamB;
  const winnerColor = teamColor(winner, theme.ink);
  return (
    <View style={[styles.meetingRow, { backgroundColor: theme.surface }]}>
      <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 20, width: 40 }}>{meetingDate(match.startsAt)}</Text>
      <View style={styles.meetingPair}>
        <MeetingSide match={match} side="a" />
        <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>:</Text>
        <MeetingSide match={match} side="b" />
      </View>
      <Text accessibilityLabel={`${winner?.shortName ?? '-'} 승리`} style={{ color: winnerColor, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>승리</Text>
    </View>
  );
}

export function MatchPreviewTab({ data }: { data: MobileMatchDetailDto }) {
  const { fonts, theme } = useMinionTheme();
  const { ai, meetings, metrics } = data.preview;
  const colorA = teamColor(data.match.teamA, theme.ink);
  const colorB = teamColor(data.match.teamB, theme.muted);
  const leadMatch = ai.liveCheck.match(/^[^.!?]*[.!?]/);
  const lead = leadMatch?.[0] ?? ai.liveCheck;
  const rest = leadMatch ? ai.liveCheck.slice(lead.length).trim() : '';
  const generatedLabel = ai.generatedAt && ai.generationPhase !== 'legacy' ? `${previewTime(ai.generatedAt)} 기준` : null;
  const teamAName = data.match.teamA?.shortName ?? data.match.teamA?.name ?? 'TBD';
  const teamBName = data.match.teamB?.shortName ?? data.match.teamB?.name ?? 'TBD';
  const bodyText = { color: theme.text, ...fonts.regular, fontSize: 14, lineHeight: 22 } as const;
  return (
    <View style={styles.root}>
      <PredictionBar data={data} />
      <View>
        <View style={styles.briefingHeadingRow}>
          <Text style={[styles.briefingHeading, { color: theme.ink, ...fonts.display }]}>AI 브리핑</Text>
          {generatedLabel ? <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>{generatedLabel}</Text> : null}
        </View>

        {ai.narrative ? (
          <View style={[styles.narrativeCard, { backgroundColor: theme.card }]}>
            <View style={styles.tagRow}>
              <Text style={{ color: theme.ink, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>오늘의 서사</Text>
              {ai.narrative.tags.map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 18 }}>{tag}</Text>
                </View>
              ))}
            </View>
            <Text style={{ color: theme.ink, ...fonts.bold, fontSize: 15, lineHeight: 23, marginTop: 8 }}>{ai.narrative.title}</Text>
            <Text style={[bodyText, styles.narrativeBody]}>{ai.narrative.body}</Text>
            {ai.matchMeaning ? (
              <View style={[styles.meaningBlock, { borderTopColor: theme.border }]}>
                <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>이 경기의 의미</Text>
                <Text style={[bodyText, styles.meaningBody]}>{ai.matchMeaning}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <BriefingRow label="전력 흐름">
          {!ai.narrative ? <Text style={{ color: theme.ink, ...fonts.bold, fontSize: 15, lineHeight: 23, marginBottom: 4 }}>{ai.headline}</Text> : null}
          <Text style={bodyText}>{ai.summary}</Text>
        </BriefingRow>

        {!ai.narrative && ai.matchMeaning ? <BriefingRow label="이 경기의 의미"><Text style={bodyText}>{ai.matchMeaning}</Text></BriefingRow> : null}

        {ai.recentView ? (
          <BriefingRow label="최근 평가 온도">
            <Text style={{ color: theme.ink, ...fonts.bold, fontSize: 15, lineHeight: 23 }}>{ai.recentView.title}</Text>
            <Text style={[bodyText, styles.recentViewBody]}>{ai.recentView.body}</Text>
            {ai.recentView.asOf ? <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>{sourceDay(ai.recentView.asOf)} 자료 기준</Text> : null}
          </BriefingRow>
        ) : null}

        {ai.teamAWinCondition || ai.teamBWinCondition ? (
          <BriefingRow label="승리 조건">
            <View style={styles.winConditionList}>
              {ai.teamAWinCondition ? (
                <View style={[styles.winConditionCard, { backgroundColor: theme.surface, borderColor: colorA }]}>
                  <View style={styles.winConditionTitle}><TeamLogo plain size={20} team={data.match.teamA} themeAware /><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 14 }}>{teamAName}</Text></View>
                  <Text style={[bodyText, styles.winConditionBody]}>{ai.teamAWinCondition}</Text>
                </View>
              ) : null}
              {ai.teamBWinCondition ? (
                <View style={[styles.winConditionCard, { backgroundColor: theme.surface, borderColor: colorB }]}>
                  <View style={styles.winConditionTitle}><TeamLogo plain size={20} team={data.match.teamB} themeAware /><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 14 }}>{teamBName}</Text></View>
                  <Text style={[bodyText, styles.winConditionBody]}>{ai.teamBWinCondition}</Text>
                </View>
              ) : null}
            </View>
          </BriefingRow>
        ) : null}

        <BriefingRow label="경기 중 확인">
          <WatchPoint lead={lead} rest={rest} />
        </BriefingRow>

        {ai.winProbabilityA !== null ? (
          <BriefingRow label="예상 승률">
            <View style={styles.winRow}><View style={styles.winTeam}><TeamLogo plain size={20} team={data.match.teamA} themeAware /><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 15 }}>{ai.winProbabilityA}%</Text></View><View style={styles.winTeam}><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 15 }}>{100 - ai.winProbabilityA}%</Text><TeamLogo plain size={20} team={data.match.teamB} themeAware /></View></View>
            <View style={styles.winTrack}><View style={{ backgroundColor: colorA, borderBottomLeftRadius: 999, borderTopLeftRadius: 999, width: `${ai.winProbabilityA}%` }} /><View style={{ backgroundColor: colorB, borderBottomRightRadius: 999, borderTopRightRadius: 999, flex: 1 }} /></View>
          </BriefingRow>
        ) : null}

        <BriefingRow label="전력 지표">
          <View style={styles.metrics}><MetricCard colorA={colorA} colorB={colorB} label="최근 5전" valueA={metrics.recentRecordA} valueB={metrics.recentRecordB} /><MetricCard colorA={colorA} colorB={colorB} label="세트 득실" valueA={signed(metrics.setDiffA)} valueB={signed(metrics.setDiffB)} /><MetricCard colorA={colorA} colorB={colorB} label="평균 킬" valueA={metrics.averageKillsA?.toFixed(1) ?? '-'} valueB={metrics.averageKillsB?.toFixed(1) ?? '-'} /></View>
        </BriefingRow>

        <BriefingRow label="최근 맞대결">
          {meetings.length === 0 ? <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 14, lineHeight: 22 }}>현재 수집된 기록 기준 첫 맞대결입니다. 최근 대진 난이도와 경기력으로 비교했습니다.</Text> : <View style={styles.meetingList}>{meetings.map((match) => <MeetingRow key={match.id} match={match} />)}</View>}
        </BriefingRow>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  briefingHeading: { fontSize: 18, lineHeight: 24 },
  briefingHeadingRow: { alignItems: 'flex-end', flexDirection: 'row', gap: 8, justifyContent: 'space-between', marginBottom: 12 },
  briefingRow: { borderRadius: 8, gap: 4, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10 },
  choice: { alignItems: 'center', alignSelf: 'stretch', flex: 1, flexDirection: 'row', gap: 6, minWidth: 0, paddingHorizontal: 8 },
  choiceIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, minWidth: 0 },
  choiceLabel: { alignItems: 'baseline', flexDirection: 'row', gap: 4, minWidth: 0 },
  choiceReverse: { flexDirection: 'row-reverse' },
  meetingList: { gap: 6 },
  meetingPair: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', minWidth: 0 },
  meetingRow: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
  meetingSide: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, minWidth: 0 },
  meetingSideA: { flexDirection: 'row-reverse' },
  meaningBlock: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10, paddingTop: 10 },
  meaningBody: { marginTop: 4 },
  metricCard: { borderRadius: 8, flex: 1, minWidth: 0, paddingHorizontal: 6, paddingVertical: 8 },
  metrics: { flexDirection: 'row', gap: 6 },
  narrativeBody: { marginTop: 6 },
  narrativeCard: { borderRadius: 8, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10 },
  prediction: { alignItems: 'stretch', borderRadius: 12, borderWidth: 1, flexDirection: 'row', height: 76, overflow: 'hidden' },
  predictionVs: { alignItems: 'center', justifyContent: 'center', width: 34 },
  recentViewBody: { marginTop: 4 },
  root: { gap: 20 },
  tag: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  tagRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  winConditionBody: { marginTop: 6 },
  winConditionCard: { borderRadius: 8, borderWidth: 1, padding: 10 },
  winConditionList: { gap: 8 },
  winConditionTitle: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  winRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  winTeam: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  winTrack: { flexDirection: 'row', gap: 2, height: 8, marginTop: 8, overflow: 'hidden' },
  watchPointHighlight: { bottom: 3, height: 9, left: 0, position: 'absolute', right: 0 },
  watchPointLead: { alignSelf: 'flex-start', maxWidth: '100%', position: 'relative' },
  watchPointLine: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap' },
  watchPointText: { fontSize: 14, lineHeight: 22 },
});
