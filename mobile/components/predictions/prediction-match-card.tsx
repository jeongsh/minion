import Clock3 from 'lucide-react-native/icons/clock-3';
import { useId, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { TeamLogo } from '@/components/data/team-logo';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobilePredictionMatch } from '@/lib/api-client';
import { deadlineLabel, predictionTimeLabel } from '@/lib/prediction-dates';

export function PredictionMatchCard({ match, now, onChooseTeam, pending = false }: { match: MobilePredictionMatch; now: number; onChooseTeam: (teamId: string) => void; pending?: boolean }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  const selectedTeam = match.myBet?.teamId === match.teamA?.id ? match.teamA : match.myBet?.teamId === match.teamB?.id ? match.teamB : null;

  return (
    <View>
      <View style={styles.metaRow}>
        <Text style={[styles.metaTime, { color: theme.ink, ...fonts.medium }]}>{predictionTimeLabel(match.startsAt)}</Text>
        <View style={styles.metaRight}>
          {match.myBet ? <Text style={[styles.metaDeadline, { color: theme.ink, ...fonts.medium }]}>내 예측 {match.myBet.stake.toLocaleString('ko-KR')} LP</Text> : null}
          <View style={styles.deadline}>
            <Clock3 color={theme.muted} size={13} />
            <Text style={[styles.metaDeadline, { color: theme.muted, ...fonts.medium }]}>{deadlineLabel(match.startsAt, match.closed, now)}</Text>
          </View>
        </View>
      </View>
      <View style={[styles.card, { backgroundColor: colorScheme === 'dark' ? theme.surfaceMuted : theme.surface, borderColor: theme.border }]}>
        {selectedTeam ? <SelectionBackground color={selectedTeam.primaryColor} right={selectedTeam.id === match.teamB?.id} /> : null}
        <TeamChoice disabled={match.closed || pending} onPress={() => match.teamA && onChooseTeam(match.teamA.id)} percent={match.market.teamAPercent} selected={match.myBet?.teamId === match.teamA?.id} team={match.teamA} />
        <View style={styles.vsColumn}>
          <Text style={[styles.vsText, { color: theme.muted, ...fonts.medium }]}>VS</Text>
        </View>
        <TeamChoice disabled={match.closed || pending} onPress={() => match.teamB && onChooseTeam(match.teamB.id)} percent={match.market.teamBPercent} selected={match.myBet?.teamId === match.teamB?.id} team={match.teamB} right />
      </View>
    </View>
  );
}

function SelectionBackground({ color, right }: { color: string; right: boolean }) {
  const { colorScheme } = useMinionTheme();
  const id = useId().replace(/:/g, '');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const width = size.width + 2;
  const height = size.height + 2;
  const dark = colorScheme === 'dark';
  const teamColor = /^#[\da-f]{6}$/i.test(color) ? color : '#3b3f46';
  const origin = right ? width : 0;

  return (
    <View pointerEvents="none" style={styles.background} onLayout={({ nativeEvent: { layout } }) => setSize((size) => size.width === layout.width && size.height === layout.height ? size : { width: layout.width, height: layout.height })}>
      {size.width > 0 && size.height > 0 ? (
        <Svg width={width} height={height} style={styles.backgroundSvg}>
          <Defs>
            <LinearGradient id={`${id}-base`} gradientUnits="userSpaceOnUse" x1={origin} y1={0} x2={right ? 0 : width} y2={0}>
              <Stop offset="0" stopColor={dark ? '#24272c' : '#eef0f2'} />
              <Stop offset="1" stopColor={dark ? '#15161a' : '#ffffff'} />
            </LinearGradient>
            {/* globals.css: circle at the selected edge, farthest-corner radius, transparent at 58%. */}
            <RadialGradient id={`${id}-team`} gradientUnits="userSpaceOnUse" cx={origin} cy={height / 2} r={Math.hypot(width, height / 2)}>
              <Stop offset="0" stopColor={teamColor} stopOpacity={dark ? 0.42 : 0.36} />
              <Stop offset="0.58" stopColor={teamColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={width} height={height} fill={`url(#${id}-base)`} />
          <Rect width={width} height={height} fill={`url(#${id}-team)`} />
        </Svg>
      ) : null}
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
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || !team, selected }} disabled={disabled || !team} onPress={onPress} style={({ pressed }) => [styles.choice, right && styles.choiceRight, pressed && !disabled && { transform: [{ scale: 0.99 }] }]}>
      <View style={[styles.choiceInfo, right && styles.choiceInfoRight]}>
        <TeamLogo plain size={28} team={team} themeAware />
        <Text numberOfLines={1} style={[styles.choiceName, { color: theme.ink, ...fonts.black }]}>{team?.shortName ?? 'TBD'}</Text>
      </View>
      <View style={styles.percentGroup}>
        <Text style={[styles.choicePercent, { color: theme.ink, ...fonts.black }]}>{percent}</Text>
        <Text style={[styles.choicePercentSign, { color: theme.muted, ...fonts.medium }]}>%</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  background: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  backgroundSvg: { left: -1, top: -1 },
  card: { alignItems: 'stretch', borderRadius: 12, borderWidth: 1, flexDirection: 'row', minHeight: 76, overflow: 'hidden' },
  choice: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'space-between', minWidth: 0, paddingHorizontal: 8 },
  choiceInfo: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, minWidth: 0 },
  choiceInfoRight: { flexDirection: 'row-reverse' },
  choiceName: { flexShrink: 1, fontSize: 15, includeFontPadding: false, lineHeight: 22.5 },
  choicePercent: { fontSize: 17, fontVariant: ['tabular-nums'], includeFontPadding: false, lineHeight: 17 },
  choicePercentSign: { fontSize: 12, includeFontPadding: false, lineHeight: 12 },
  choiceRight: { flexDirection: 'row-reverse' },
  deadline: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  metaDeadline: { fontSize: 13, includeFontPadding: false, lineHeight: 19.5 },
  metaRight: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 },
  metaTime: { fontSize: 14, includeFontPadding: false, lineHeight: 20 },
  percentGroup: { alignItems: 'baseline', flexDirection: 'row', flexShrink: 0, gap: 2 },
  vsColumn: { alignItems: 'center', justifyContent: 'center', width: 34 },
  vsText: { fontSize: 13, includeFontPadding: false, lineHeight: 19.5 },
});
