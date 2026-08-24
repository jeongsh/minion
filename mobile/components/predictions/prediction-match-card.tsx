import Clock3 from 'lucide-react-native/icons/clock-3';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/data/team-logo';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobilePredictionMatch } from '@/lib/api-client';
import { deadlineLabel, predictionTimeLabel } from '@/lib/prediction-dates';

export function PredictionMatchCard({ match, now, onChooseTeam }: { match: MobilePredictionMatch; now: number; onChooseTeam: (teamId: string) => void }) {
  const { colorScheme, fonts, theme } = useMinionTheme();

  return (
    <View>
      <View style={styles.metaRow}>
        <Text style={[styles.metaTime, { color: theme.ink, fontFamily: fonts.bold }]}>{predictionTimeLabel(match.startsAt)}</Text>
        <View style={styles.metaRight}>
          <Clock3 color={theme.muted} size={13} />
          <Text style={[styles.metaDeadline, { color: theme.muted, fontFamily: fonts.bold }]}>{deadlineLabel(match.startsAt, match.closed, now)}</Text>
        </View>
      </View>
      <View style={[styles.card, { backgroundColor: colorScheme === 'dark' ? theme.surfaceMuted : theme.surface, borderColor: theme.border }]}>
        <TeamChoice disabled={match.closed} onPress={() => match.teamA && onChooseTeam(match.teamA.id)} percent={match.market.teamAPercent} team={match.teamA} odds={match.market.teamAOdds} />
        <View style={styles.vsColumn}>
          <Text style={[styles.vsText, { color: theme.muted, fontFamily: fonts.black }]}>VS</Text>
        </View>
        <TeamChoice disabled={match.closed} onPress={() => match.teamB && onChooseTeam(match.teamB.id)} percent={match.market.teamBPercent} team={match.teamB} odds={match.market.teamBOdds} right />
      </View>
    </View>
  );
}

function TeamChoice({
  disabled,
  odds,
  onPress,
  percent,
  right = false,
  team,
}: {
  disabled: boolean;
  odds: number | null;
  onPress: () => void;
  percent: number;
  right?: boolean;
  team: MobilePredictionMatch['teamA'];
}) {
  const { fonts, theme } = useMinionTheme();

  return (
    <Pressable disabled={disabled || !team} onPress={onPress} style={[styles.choice, right && styles.choiceRight]}>
      <View style={[styles.choiceInfo, right && styles.choiceInfoRight]}>
        <TeamLogo plain size={28} team={team} themeAware />
        <View style={[styles.choiceNameRow, right && styles.choiceNameRowRight]}>
          <Text numberOfLines={1} style={[styles.choiceName, { color: theme.ink, fontFamily: fonts.black }]}>{team?.shortName ?? 'TBD'}</Text>
          <Text style={[styles.choiceOdds, { color: theme.muted, fontFamily: fonts.medium }]}>
            {odds === null ? '1.00' : odds.toFixed(2)}
            <Text style={styles.choiceOddsUnit}> 배</Text>
          </Text>
        </View>
      </View>
      <Text style={[styles.choicePercent, { color: theme.ink, fontFamily: fonts.black }]}>
        {percent}
        <Text style={[styles.choicePercentSign, { color: theme.muted }]}>%</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'stretch', borderRadius: 12, borderWidth: 1, flexDirection: 'row', minHeight: 76, overflow: 'hidden' },
  choice: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'space-between', minWidth: 0, paddingHorizontal: 8 },
  choiceInfo: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, minWidth: 0 },
  choiceInfoRight: { flexDirection: 'row-reverse' },
  choiceName: { flexShrink: 1, fontSize: 15, lineHeight: 21 },
  choiceNameRow: { alignItems: 'baseline', flexDirection: 'row', gap: 4, minWidth: 0 },
  choiceNameRowRight: { flexDirection: 'row-reverse' },
  choiceOdds: { flexShrink: 0, fontSize: 11, lineHeight: 16.5 },
  choiceOddsUnit: { fontSize: 10 },
  choicePercent: { flexShrink: 0, fontSize: 17, lineHeight: 17 },
  choicePercentSign: { fontSize: 12 },
  choiceRight: { flexDirection: 'row-reverse' },
  metaDeadline: { fontSize: 13, lineHeight: 19.5 },
  metaRight: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  metaRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 },
  metaTime: { fontSize: 14, lineHeight: 21 },
  vsColumn: { alignItems: 'center', justifyContent: 'center', width: 34 },
  vsText: { fontSize: 13, lineHeight: 19.5 },
});
