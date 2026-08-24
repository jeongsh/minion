import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/data/team-logo';
import { tournamentTokens } from '@/constants/tournament-theme';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileSetDetail, MobileSetPlayerStat, MobileTeamSummary } from '@/lib/api-client';

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const POSITION_ORDER: Record<string, number> = { TOP: 0, JGL: 1, MID: 2, BOT: 3, SUP: 4 };

function GroupHeader({ team, label, won }: { team: MobileTeamSummary | null; label: string; won: boolean }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  return (
    <View style={[styles.headerRow, { backgroundColor: theme.card }]}>
      <View style={styles.headerIdentity}>
        {team ? <TeamLogo plain size={20} team={team} themeAware /> : null}
        <Text numberOfLines={1} style={[styles.headerIdentityLabel, { color: theme.ink, fontFamily: fonts.bold }]}>{label}</Text>
        {won ? <Text style={[styles.headerWin, { color: theme.accent, fontFamily: fonts.medium }]}>WIN</Text> : null}
      </View>
      <Text style={[styles.headerCell, { color: tournamentTokens[colorScheme].muted, fontFamily: fonts.medium, width: 56 }]}>KDA</Text>
      <Text style={[styles.headerCell, { color: tournamentTokens[colorScheme].muted, fontFamily: fonts.medium, width: 84 }]}>아이템</Text>
    </View>
  );
}

function ItemSlot({ url }: { url: string | null }) {
  const { colorScheme } = useMinionTheme();
  return (
    <View style={[styles.itemSlot, { backgroundColor: tournamentTokens[colorScheme].surfaceMuted, borderColor: hexToRgba(tournamentTokens[colorScheme].border, 0.5) }]}>
      {url ? <Image contentFit="cover" source={{ uri: url }} style={styles.itemSlotImage} /> : null}
    </View>
  );
}

function PlayerRow({ line, isLast }: { line: MobileSetPlayerStat; isLast: boolean }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  const { loadout } = line;
  const items = [...loadout.itemImages, loadout.trinketImage, loadout.roleBoundItemImage];
  const itemRows = [items.slice(0, 4), items.slice(4, 8)];

  return (
    <View
      style={[styles.row, { backgroundColor: theme.surface }, !isLast && { borderBottomColor: hexToRgba(tournamentTokens[colorScheme].border, 0.35), borderBottomWidth: StyleSheet.hairlineWidth }]}
    >
      <View style={styles.loadoutBlock}>
        <View style={styles.iconCluster}>
          <View style={[styles.championBox, { backgroundColor: tournamentTokens[colorScheme].surfaceMuted, borderColor: theme.border }]}>
            {loadout.champion.image?.url ? <Image contentFit="cover" source={{ uri: loadout.champion.image.url }} style={styles.championImage} /> : null}
            {line.championLevel ? (
              <View style={[styles.levelBadge, { backgroundColor: hexToRgba(theme.surface, 0.9) }]}>
                <Text style={[styles.levelBadgeText, { color: theme.ink, fontFamily: fonts.medium }]}>{line.championLevel}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.spellRuneCluster}>
            <View style={styles.spellRuneColumn}>
              {loadout.spellImages.map((spell, index) => (
                <View key={`spell-${index}`} style={[styles.spellIcon, { backgroundColor: tournamentTokens[colorScheme].surfaceMuted, borderColor: hexToRgba(tournamentTokens[colorScheme].border, 0.6) }]}>
                  {spell?.url ? <Image contentFit="cover" source={{ uri: spell.url }} style={styles.spellIconImage} /> : null}
                </View>
              ))}
            </View>
            <View style={styles.spellRuneColumn}>
              {loadout.runeImages.map((rune, index) => (
                <View key={`rune-${index}`} style={styles.runeIcon}>
                  {rune?.url ? <Image contentFit="contain" source={{ uri: rune.url }} style={index === 1 ? styles.runeIconTreeImage : styles.runeIconImage} /> : null}
                </View>
              ))}
            </View>
          </View>
        </View>
        <View style={styles.nameBlock}>
          <Text numberOfLines={1} style={[styles.playerName, { color: theme.text, fontFamily: fonts.bold }]}>{line.playerName}</Text>
          <Text numberOfLines={1} style={[styles.championName, { color: tournamentTokens[colorScheme].muted, fontFamily: fonts.medium }]}>{loadout.champion.name}</Text>
        </View>
      </View>

      <View style={styles.kdaBlock}>
        <Text style={[styles.kdaMain, { color: theme.ink, fontFamily: fonts.bold }]}>{line.kills} / {line.deaths} / {line.assists}</Text>
        <Text style={[styles.kdaSub, { color: tournamentTokens[colorScheme].muted, fontFamily: fonts.medium }]}>{line.kda.toFixed(2)}</Text>
      </View>

      <View style={styles.itemGrid}>
        {itemRows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.itemGridRow}>
            {row.map((item, index) => (
              <ItemSlot key={index} url={item?.url ?? null} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function TeamGroup({ set, side, players }: { set: MobileSetDetail; side: 'blue' | 'red'; players: MobileSetPlayerStat[] }) {
  const teamId = side === 'blue' ? set.blueTeamId : set.redTeamId;
  const team = side === 'blue' ? set.blueTeam : set.redTeam;
  const lines = players
    .filter((line) => line.teamId === teamId)
    .sort((a, b) => (POSITION_ORDER[a.position] ?? 9) - (POSITION_ORDER[b.position] ?? 9));
  const { theme } = useMinionTheme();

  return (
    <View style={[styles.group, { backgroundColor: theme.surface }]}>
      <GroupHeader label={team?.shortName ?? team?.name ?? (side === 'blue' ? '블루' : '레드')} team={team} won={set.winnerTeamId === teamId} />
      {lines.map((line, index) => (
        <PlayerRow isLast={index === lines.length - 1} key={line.playerId} line={line} />
      ))}
    </View>
  );
}

export function MatchPlayerStatTable({ set }: { set: MobileSetDetail }) {
  const { fonts, theme } = useMinionTheme();

  if (set.playerStats.length === 0) {
    return (
      <View style={[styles.emptyBox, { backgroundColor: theme.surface }]}>
        <Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 14 }}>선수 스탯이 아직 연결되지 않았습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.sectionGap}>
      <Text style={[styles.sectionHeading, { color: theme.ink, fontFamily: fonts.display }]}>선수 스탯</Text>
      <View style={[styles.frame, { borderColor: theme.border }]}>
        <TeamGroup players={set.playerStats} set={set} side="blue" />
        <TeamGroup players={set.playerStats} set={set} side="red" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  championBox: { borderRadius: 8, borderWidth: 1, height: 40, overflow: 'hidden', width: 40 },
  championImage: { height: '100%', width: '100%' },
  championName: { fontSize: 12, lineHeight: 16 },
  emptyBox: { borderRadius: 8, padding: 16 },
  frame: { borderRadius: 8, borderWidth: 1, gap: 12, overflow: 'hidden' },
  group: { borderRadius: 8, overflow: 'hidden' },
  headerCell: { fontSize: 12, lineHeight: 16, textAlign: 'center' },
  headerIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 },
  headerIdentityLabel: { flexShrink: 1, fontSize: 14, lineHeight: 20 },
  headerRow: { alignItems: 'center', flexDirection: 'row', gap: 8, height: 40, paddingHorizontal: 10 },
  headerWin: { fontSize: 12, lineHeight: 16 },
  iconCluster: { alignItems: 'center', flexDirection: 'row', gap: 2 },
  itemGrid: { gap: 2, width: 84 },
  itemGridRow: { flexDirection: 'row', gap: 2 },
  itemSlot: { borderRadius: 4, borderWidth: 1, height: 19, overflow: 'hidden', width: 19 },
  itemSlotImage: { height: '100%', width: '100%' },
  kdaBlock: { alignItems: 'center', width: 56 },
  kdaMain: { fontSize: 12, lineHeight: 16 },
  kdaSub: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  levelBadge: { borderTopLeftRadius: 4, bottom: 0, paddingHorizontal: 2, position: 'absolute', right: 0 },
  levelBadgeText: { fontSize: 12, lineHeight: 16 },
  loadoutBlock: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 },
  nameBlock: { flex: 1, minWidth: 0 },
  playerName: { fontSize: 14, lineHeight: 20 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  runeIcon: { alignItems: 'center', backgroundColor: '#0d1117', borderRadius: 10, height: 20, justifyContent: 'center', overflow: 'hidden', width: 20 },
  runeIconImage: { height: '100%', width: '100%' },
  runeIconTreeImage: { height: '72%', width: '72%' },
  sectionGap: { gap: 12 },
  sectionHeading: { fontSize: 16, lineHeight: 21.6 },
  spellIcon: { borderRadius: 4, borderWidth: 1, height: 20, overflow: 'hidden', width: 20 },
  spellIconImage: { height: '100%', width: '100%' },
  spellRuneCluster: { flexDirection: 'row', gap: 0 },
  spellRuneColumn: { flexDirection: 'column', gap: 0 },
});
