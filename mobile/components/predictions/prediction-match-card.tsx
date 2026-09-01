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
        <Text style={[styles.metaTime, { color: theme.ink, ...fonts.bold }]}>{predictionTimeLabel(match.startsAt)}</Text>
        <View style={styles.metaRight}>
          <Clock3 color={theme.muted} size={13} />
          <Text style={[styles.metaDeadline, { color: theme.muted, ...fonts.bold }]}>{deadlineLabel(match.startsAt, match.closed, now)}</Text>
        </View>
      </View>
      <View style={[styles.card, { backgroundColor: colorScheme === 'dark' ? theme.surfaceMuted : theme.surface, borderColor: match.myBet ? theme.accent : theme.border }]}>
        <TeamChoice disabled={match.closed} onPress={() => match.teamA && onChooseTeam(match.teamA.id)} percent={match.market.teamAPercent} selected={match.myBet?.teamId === match.teamA?.id} team={match.teamA} />
        <View style={styles.vsColumn}>
          <Text style={[styles.vsText, { color: theme.muted, ...fonts.black }]}>VS</Text>
        </View>
        <TeamChoice disabled={match.closed} onPress={() => match.teamB && onChooseTeam(match.teamB.id)} percent={match.market.teamBPercent} selected={match.myBet?.teamId === match.teamB?.id} team={match.teamB} right />
      </View>
    </View>
  );
}

function TeamChoice({
  disabled,
  onPress,
  percent,
  right = false,
  selected,
  team,
}: {
  disabled: boolean;
  onPress: () => void;
  percent: number;
  right?: boolean;
  selected: boolean;
  team: MobilePredictionMatch['teamA'];
}) {
  const { fonts, theme } = useMinionTheme();

  return (
    <Pressable disabled={disabled || !team} onPress={onPress} style={[styles.choice, right && styles.choiceRight, selected && { backgroundColor: `${theme.accent}18` }]}>
      <View style={[styles.choiceInfo, right && styles.choiceInfoRight]}>
        <TeamLogo plain size={28} team={team} themeAware />
        <Text numberOfLines={1} style={[styles.choiceName, { color: theme.ink, ...fonts.black }]}>{team?.shortName ?? 'TBD'}</Text>
      </View>
      <Text style={[styles.choicePercent, { color: theme.ink, ...fonts.black }]}>
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
