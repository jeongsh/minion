import { StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobilePlayerSummary, MobileSetDetail } from '@/lib/api-client';
import { GameTimelineChart } from './game-timeline-chart';

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function SetTimelineSection({ players, set }: { players: MobilePlayerSummary[]; set: MobileSetDetail }) {
  const { fonts, theme } = useMinionTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.ink, fontFamily: fonts.display }]}>타임라인</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: hexToRgba(theme.border, 0.6) }]}>
        <GameTimelineChart
          blueTeamId={set.blueTeamId}
          blueTeamName={set.blueTeam?.shortName ?? set.blueTeam?.name ?? '블루'}
          durationSeconds={set.durationSeconds}
          events={set.timelineEvents}
          frames={set.timelineFrames}
          players={players}
          redTeamId={set.redTeamId}
          redTeamName={set.redTeam?.shortName ?? set.redTeam?.name ?? '레드'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  heading: { fontSize: 16, lineHeight: 21.6 },
  section: { gap: 12 },
});
