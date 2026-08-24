import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/data/team-logo';
import { tournamentTokens } from '@/constants/tournament-theme';
import { OBJECTIVE_ICON_PATHS } from '@/constants/objective-icons';
import { TEAM_BLUE, TEAM_RED } from '@/constants/team-colors';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileChampionRef, MobileObjectiveCounts, MobileSetDetail, MobileSetDraftSide, MobileTeamSummary } from '@/lib/api-client';
import { ObjectiveIcon } from './objective-icon';

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function TeamCell({ team, name, kills, outcome }: { team: MobileTeamSummary | null; name: string; kills: number | null; outcome: { won: boolean; short: string } }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  return (
    <View style={[styles.teamCell, { backgroundColor: theme.card }]}>
      <TeamLogo plain size={32} team={team} themeAware />
      <View style={styles.teamCellInfo}>
        <Text numberOfLines={1} style={[styles.teamCellName, { color: theme.ink, fontFamily: fonts.medium }]}>{name}</Text>
        <Text style={[styles.teamCellOutcome, { color: outcome.won ? theme.accent : tournamentTokens[colorScheme].muted, fontFamily: fonts.medium }]}>{outcome.short}</Text>
      </View>
      <Text style={[styles.teamCellKills, { color: theme.ink, fontFamily: fonts.bold }]}>{kills ?? '-'}</Text>
    </View>
  );
}

function BanTile({ champion }: { champion: MobileChampionRef | null }) {
  const { colorScheme } = useMinionTheme();
  const uri = champion?.image?.url;
  return (
    <View style={[styles.banTile, { backgroundColor: tournamentTokens[colorScheme].surfaceMuted }]}>
      {uri ? <Image contentFit="cover" source={{ uri }} style={styles.banTileImage} /> : null}
    </View>
  );
}

function DraftBans({ blue, red }: { blue: MobileSetDraftSide; red: MobileSetDraftSide }) {
  const { colorScheme, fonts } = useMinionTheme();
  return (
    <View style={[styles.draftWrap, { backgroundColor: hexToRgba(tournamentTokens[colorScheme].surfaceMuted, 0.2) }]}>
      <View style={styles.draftRow}>
        <View style={styles.draftTiles}>
          {blue.bans.map((item, index) => (
            <BanTile key={item?.id ?? `blue-${index}`} champion={item} />
          ))}
        </View>
        <Text style={[styles.draftLabel, { color: tournamentTokens[colorScheme].muted, fontFamily: fonts.medium }]}>밴</Text>
        <View style={styles.draftTiles}>
          {red.bans.map((item, index) => (
            <BanTile key={item?.id ?? `red-${index}`} champion={item} />
          ))}
        </View>
      </View>
    </View>
  );
}

const OBJECTIVE_METRICS: { key: keyof MobileObjectiveCounts; icon: string }[] = [
  { icon: OBJECTIVE_ICON_PATHS.voidGrub, key: 'voidGrubs' },
  { icon: OBJECTIVE_ICON_PATHS.dragon, key: 'dragons' },
  { icon: OBJECTIVE_ICON_PATHS.herald, key: 'heralds' },
  { icon: OBJECTIVE_ICON_PATHS.baron, key: 'barons' },
  { icon: OBJECTIVE_ICON_PATHS.tower, key: 'towers' },
  { icon: OBJECTIVE_ICON_PATHS.elder, key: 'elders' },
];

function ObjectiveGrid({ counts }: { counts: MobileObjectiveCounts }) {
  const { colorScheme, fonts } = useMinionTheme();
  return (
    <View style={styles.objGrid}>
      {OBJECTIVE_METRICS.map((metric) => {
        const count = counts[metric.key];
        const has = count > 0;
        return (
          <View key={metric.key} style={styles.objItem}>
            <ObjectiveIcon opacity={has ? 1 : 0.35} path={metric.icon} size={20} />
            <Text style={[styles.objCount, { color: has ? tournamentTokens[colorScheme].foreground : tournamentTokens[colorScheme].muted, fontFamily: fonts.medium }]}>{count}</Text>
          </View>
        );
      })}
    </View>
  );
}

function GoldBar({ value, max, align }: { value: number; max: number; align: 'blue' | 'red' }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  const pct = max > 0 ? (value / max) * 100 : 0;
  const numberNode = <Text style={[styles.goldNumber, { color: theme.ink, fontFamily: fonts.bold }]}>{value.toLocaleString('ko-KR')}</Text>;
  const barNode = (
    <View style={[styles.goldBarTrack, { backgroundColor: tournamentTokens[colorScheme].surfaceMuted }]}>
      <View style={[styles.goldBarFill, { backgroundColor: align === 'blue' ? TEAM_BLUE : TEAM_RED, width: `${pct}%`, alignSelf: align === 'blue' ? 'flex-end' : 'flex-start' }]} />
    </View>
  );
  return (
    <View style={[styles.goldSide, { justifyContent: align === 'blue' ? 'flex-end' : 'flex-start' }]}>
      {align === 'blue' ? (
        <>
          {numberNode}
          {barNode}
        </>
      ) : (
        <>
          {barNode}
          {numberNode}
        </>
      )}
    </View>
  );
}

function durationLabel(seconds: number | null) {
  if (!seconds) return '-';
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}

export function CompactScoreboard({ set }: { set: MobileSetDetail }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  const blueOutcome = { short: set.winnerTeamId ? (set.winnerTeamId === set.blueTeamId ? '승리' : '패배') : '미정', won: set.winnerTeamId === set.blueTeamId };
  const redOutcome = { short: set.winnerTeamId ? (set.winnerTeamId === set.redTeamId ? '승리' : '패배') : '미정', won: set.winnerTeamId === set.redTeamId };
  const maxGold = Math.max(set.blueGold ?? 0, set.redGold ?? 0, 1);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeadRow}>
        <Text style={[styles.sectionHeading, { color: theme.ink, fontFamily: fonts.display }]}>스코어보드</Text>
        <Text style={[styles.sectionMeta, { color: theme.muted, fontFamily: fonts.medium }]}>{set.setNumber}세트 · {durationLabel(set.durationSeconds)}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: tournamentTokens[colorScheme].surface, borderColor: hexToRgba(tournamentTokens[colorScheme].border, 0.6) }]}>
        <View style={styles.teamCellRow}>
          <TeamCell kills={set.blueKills} name={set.blueTeam?.shortName ?? set.blueTeam?.name ?? '블루'} outcome={blueOutcome} team={set.blueTeam} />
          <TeamCell kills={set.redKills} name={set.redTeam?.shortName ?? set.redTeam?.name ?? '레드'} outcome={redOutcome} team={set.redTeam} />
        </View>

        {set.draft ? <DraftBans blue={set.draft.blue} red={set.draft.red} /> : (
          <View style={styles.noDraft}>
            <Text style={{ color: tournamentTokens[colorScheme].muted, fontFamily: fonts.medium, fontSize: 13 }}>밴픽 데이터 없음</Text>
          </View>
        )}

        <View style={styles.objSection}>
          <ObjectiveGrid counts={set.blueObjectives} />
          <View style={[styles.objCenterPill, { backgroundColor: hexToRgba(tournamentTokens[colorScheme].surfaceMuted, 0.6) }]}>
            <Text style={[styles.objCenterLabel, { color: tournamentTokens[colorScheme].muted, fontFamily: fonts.medium }]}>목표물</Text>
          </View>
          <ObjectiveGrid counts={set.redObjectives} />
        </View>

        <View style={[styles.goldSection, { borderTopColor: hexToRgba(tournamentTokens[colorScheme].border, 0.5) }]}>
          <GoldBar align="blue" max={maxGold} value={set.blueGold ?? 0} />
          <Text style={[styles.goldCenterLabel, { color: tournamentTokens[colorScheme].muted, fontFamily: fonts.medium }]}>골드</Text>
          <GoldBar align="red" max={maxGold} value={set.redGold ?? 0} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banTile: { aspectRatio: 1, borderRadius: 4, flex: 1, overflow: 'hidden' },
  banTileImage: { height: '100%', width: '100%' },
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  section: { gap: 12 },
  sectionHeadRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  sectionHeading: { fontSize: 16, lineHeight: 21.6 },
  sectionMeta: { flexShrink: 0, fontSize: 13, lineHeight: 19.5, paddingBottom: 2 },
  draftLabel: { fontSize: 12, lineHeight: 16, textAlign: 'center', width: 40 },
  draftRow: { alignItems: 'center', flexDirection: 'row' },
  draftTiles: { flex: 1, flexDirection: 'row', gap: 2 },
  draftWrap: { paddingHorizontal: 8, paddingVertical: 12 },
  goldBarFill: { borderRadius: 999, height: '100%' },
  goldBarTrack: { borderRadius: 999, flex: 1, height: 4, overflow: 'hidden' },
  goldCenterLabel: { fontSize: 12, lineHeight: 16, textAlign: 'center', width: 40 },
  goldNumber: { fontSize: 12, lineHeight: 16 },
  goldSection: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 8, paddingVertical: 12 },
  goldSide: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8 },
  noDraft: { alignItems: 'center', paddingVertical: 12 },
  objCenterLabel: { fontSize: 12, lineHeight: 16 },
  objCenterPill: { alignItems: 'center', borderRadius: 999, height: 32, justifyContent: 'center', width: 56 },
  objCount: { fontSize: 12, lineHeight: 16 },
  objGrid: { columnGap: 4, flex: 1, flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  objItem: { alignItems: 'center', flexDirection: 'row', gap: 4, width: '33.33%' },
  objSection: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 8, paddingVertical: 12 },
  teamCell: { alignItems: 'center', borderRadius: 8, flex: 1, flexDirection: 'row', gap: 8, padding: 10 },
  teamCellInfo: { flex: 1, minWidth: 0 },
  teamCellKills: { fontSize: 20, lineHeight: 28 },
  teamCellName: { fontSize: 12, lineHeight: 16 },
  teamCellOutcome: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  teamCellRow: { flexDirection: 'row', gap: 8, padding: 8 },
});
