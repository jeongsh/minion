import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';

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

function GroupHeader({ team, label, won, stats }: { team: MobileTeamSummary | null; label: string; won: boolean; stats: boolean }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  const { width } = useWindowDimensions();
  const tablet = width >= 720;
  const columns = statColumns(width);
  return (
    <View style={[styles.headerRow, { backgroundColor: theme.card, gap: stats ? (tablet ? 12 : width >= 360 ? 8 : 2) : 8, paddingHorizontal: tablet ? 12 : 10 }]}>
      <View style={[styles.headerIdentity, { flexGrow: !stats && width >= 560 ? 0 : stats && tablet ? 2 : 1, flexShrink: 1, flexBasis: !stats && width >= 560 ? 192 : 0 }]}>
        {team ? <TeamLogo plain size={20} team={team} themeAware /> : null}
        <Text numberOfLines={1} style={[styles.headerIdentityLabel, { color: theme.ink, ...fonts.bold }]}>{label}</Text>
        {won ? <Text style={[styles.headerWin, { color: theme.accent, ...fonts.medium }]}>WIN</Text> : null}
      </View>
      {stats ? <>{(tablet ? ['KDA', '데미지', '시야', 'CS', '골드'] : ['데미지', '시야', 'CS', '골드']).map((label, index) => <Text key={label} style={{ ...fonts.medium, fontSize: tablet ? 14 : 13, lineHeight: 20, textAlign: label === 'KDA' ? 'center' : 'right', color: theme.muted, ...columns[index] }}>{label}</Text>)}</> : <>
        <Text style={[styles.headerCell, { color: tournamentTokens[colorScheme].muted, ...fonts.medium, width: 56, fontSize: tablet ? 14 : 12 }]}>KDA</Text>
        {width >= 480 ? <Text style={{ flex: 1, color: theme.muted, ...fonts.medium, fontSize: 13 }}>데미지</Text> : null}
        <Text style={[styles.headerCell, { color: tournamentTokens[colorScheme].muted, ...fonts.medium, width: tablet ? (width >= 1000 ? 284 : 252) : 84, fontSize: 13 }]}>아이템</Text>
      </>}
    </View>
  );
}

function ItemSlot({ url }: { url: string | null }) {
  const { colorScheme } = useMinionTheme();
  const { width } = useWindowDimensions();
  const size = width >= 1000 ? 32 : width >= 720 ? 28 : 20;
  return (
    <View style={[styles.itemSlot, { width: size, height: size, backgroundColor: tournamentTokens[colorScheme].surfaceMuted, borderColor: hexToRgba(tournamentTokens[colorScheme].border, 0.5) }]}>
      {url ? <Image contentFit="cover" source={{ uri: url }} style={styles.itemSlotImage} /> : null}
    </View>
  );
}

function statColumns(width: number) {
  if (width >= 720) return [{ width: 64 }, { flex: 1.2, minWidth: 80 }, { width: 48 }, { width: 64 }, { width: 64 }];
  return width >= 480 ? [{ width: 80 }, { width: 48 }, { width: 64 }, { width: 64 }] : [{ width: 72 }, { width: 24 }, { width: 26 }, { width: 44 }];
}

function PlayerRow({ line, isFirst, stats, maxDamage, side }: { line: MobileSetPlayerStat; isFirst: boolean; stats: boolean; maxDamage: number; side: 'blue' | 'red' }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  const { width } = useWindowDimensions();
  const tablet = width >= 720;
  const columns = statColumns(width);
  const numberStyle = { ...fonts.medium, color: theme.ink, fontSize: tablet ? 14 : 12, lineHeight: tablet ? 20 : 16, fontVariant: ['tabular-nums'] as ('tabular-nums')[] };
  const helperStyle = { ...numberStyle, color: theme.muted, fontSize: tablet ? 13 : 12, lineHeight: 16 };
  const accent = side === 'blue' ? '#2563eb' : '#f43f5e';
  const { loadout } = line;
  const items = [...loadout.itemImages, loadout.trinketImage, loadout.roleBoundItemImage];
  const itemRows = tablet ? [items] : [items.slice(0, 4), items.slice(4, 8)];

  return (
    <View
      testID={stats ? 'player-stat-row-stats' : 'player-stat-row-basic'}
      style={[styles.row, { backgroundColor: theme.surface, minHeight: (tablet ? 68 : width >= 480 ? 60 : 58) + (isFirst ? 0 : 1), gap: stats ? (tablet ? 12 : width >= 360 ? 8 : 2) : 8, paddingHorizontal: tablet ? 12 : 10 }, !isFirst && { borderTopColor: hexToRgba(tournamentTokens[colorScheme].border, 0.35), borderTopWidth: 1 }]}
    >
      <View style={[styles.loadoutBlock, { flexGrow: !stats && width >= 560 ? 0 : stats && tablet ? 2 : 1, flexShrink: 1, flexBasis: !stats && width >= 560 ? 192 : 0, gap: 6 }]}>
        <View style={styles.iconCluster}>
          <Pressable disabled={!loadout.champion.slug} accessibilityRole="link" accessibilityLabel={`${loadout.champion.name} 챔피언 통계`} onPress={() => { if (loadout.champion.slug) router.push(`/champions/${loadout.champion.slug}`); }} style={[styles.championBox, { backgroundColor: tournamentTokens[colorScheme].surfaceMuted, borderColor: theme.border, width: tablet ? 48 : 40, height: tablet ? 48 : 40 }]}>
            {loadout.champion.image?.url ? <Image contentFit="cover" source={{ uri: loadout.champion.image.url }} style={styles.championImage} /> : null}
            {line.championLevel ? (
              <View style={[styles.levelBadge, { backgroundColor: hexToRgba(theme.surface, 0.9) }]}>
                <Text style={[styles.levelBadgeText, { color: theme.ink, ...fonts.medium }]}>{line.championLevel}</Text>
              </View>
            ) : null}
          </Pressable>
          {!stats ? <View style={styles.spellRuneCluster}>
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
          </View> : null}
        </View>
        <View style={styles.nameBlock}>
          <Text numberOfLines={1} style={[styles.playerName, { color: theme.text, ...fonts.medium }]}>{line.playerName}</Text>
          <Text numberOfLines={1} style={[styles.championName, { color: tournamentTokens[colorScheme].muted, ...fonts.regular, fontSize: stats && !tablet ? 12 : 13 }]}>{stats && !tablet ? `${line.kills}/${line.deaths}/${line.assists}` : loadout.champion.name}</Text>
        </View>
      </View>

      {stats ? <>
        {tablet ? <View style={[columns[0], { alignItems: 'center' }]}><Text style={numberStyle}>{line.kills}/{line.deaths}/{line.assists}</Text><Text style={helperStyle}>{line.kda.toFixed(2)}</Text></View> : null}
        <View style={[columns[tablet ? 1 : 0], { height: tablet ? 48 : width >= 480 ? 44 : 40, alignItems: 'flex-end' }]}>
          <Text style={numberStyle}>{line.damage.toLocaleString('en-US')}</Text>
          {tablet ? <View style={{ height: 4, width: '100%', borderRadius: 4, marginTop: 4, backgroundColor: theme.surfaceMuted, overflow: 'hidden' }}><View style={{ height: 4, width: `${Math.min(100, Math.max(0, line.damage / maxDamage * 100))}%`, backgroundColor: accent }} /></View> : null}
          <Text numberOfLines={1} style={helperStyle}>DPM {line.dpm.toLocaleString('en-US')}</Text>
        </View>
        <View style={[columns[tablet ? 2 : 1], { height: width >= 480 ? 44 : 40, alignItems: 'flex-end' }]}><Text style={numberStyle}>{line.visionScore.toLocaleString('en-US')}</Text></View>
        <View style={[columns[tablet ? 3 : 2], { height: width >= 480 ? 44 : 40, alignItems: 'flex-end' }]}><Text style={numberStyle}>{line.cs.toLocaleString('en-US')}</Text><Text style={helperStyle}>{line.csm.toFixed(1)}</Text></View>
        <View style={[columns[tablet ? 4 : 3], { height: width >= 480 ? 44 : 40, alignItems: 'flex-end' }]}><Text style={numberStyle}>{line.gold.toLocaleString('en-US')}</Text></View>
      </> : <>
      <View style={styles.kdaBlock}>
        <Text numberOfLines={1} style={[styles.kdaMain, numberStyle]}>{tablet ? `${line.kills}/${line.deaths}/${line.assists}` : `${line.kills} / ${line.deaths} / ${line.assists}`}</Text>
        <Text style={[styles.kdaSub, helperStyle]}>{line.kda.toFixed(2)}</Text>
      </View>
      {width >= 480 ? <View style={{ flex: 1, minHeight: 44 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text style={numberStyle}>{line.damage.toLocaleString('en-US')}</Text><Text style={helperStyle}>DPM {line.dpm.toLocaleString('en-US')}</Text></View>{tablet ? <View style={{ height: 4, borderRadius: 4, marginTop: 4, backgroundColor: theme.surfaceMuted, overflow: 'hidden' }}><View style={{ height: 4, width: `${Math.max(4, line.damage / maxDamage * 100)}%`, backgroundColor: accent }} /></View> : null}<Text style={[numberStyle, { color: theme.muted, textAlign: 'right', marginTop: 4 }]}>{line.cs} CS</Text></View> : null}
      <View style={[styles.itemGrid, tablet && { width: width >= 1000 ? 284 : 252 }]}>
        {itemRows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.itemGridRow}>
            {row.map((item, index) => (
              <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: tablet && index >= 6 ? 2 : 0 }}>{tablet && index >= 6 ? <View style={{ width: 1, height: 20, marginHorizontal: 2, backgroundColor: theme.border }} /> : null}<ItemSlot url={item?.url ?? null} /></View>
            ))}
          </View>
        ))}
      </View></>}
    </View>
  );
}

function TeamGroup({ set, side, players, stats }: { set: MobileSetDetail; side: 'blue' | 'red'; players: MobileSetPlayerStat[]; stats: boolean }) {
  const teamId = side === 'blue' ? set.blueTeamId : set.redTeamId;
  const team = side === 'blue' ? set.blueTeam : set.redTeam;
  const lines = players
    .filter((line) => line.teamId === teamId)
    .sort((a, b) => (POSITION_ORDER[a.position] ?? 9) - (POSITION_ORDER[b.position] ?? 9));
  const { theme } = useMinionTheme();

  return (
    <View style={[styles.group, { backgroundColor: theme.surface }]}>
      <GroupHeader label={team?.shortName ?? team?.name ?? (side === 'blue' ? '블루' : '레드')} team={team} won={set.winnerTeamId === teamId} stats={stats} />
      {lines.map((line, index) => (
        <PlayerRow isFirst={index === 0} key={line.playerId} line={line} stats={stats} maxDamage={Math.max(...set.playerStats.map((player) => player.damage), 1)} side={side} />
      ))}
    </View>
  );
}

export function MatchPlayerStatTable({ set }: { set: MobileSetDetail }) {
  const { fonts, theme, colorScheme } = useMinionTheme();
  const [stats, setStats] = useState(false);

  if (set.playerStats.length === 0) {
    return (
      <View style={[styles.emptyBox, { backgroundColor: theme.surface }]}>
        <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 14 }}>선수 스탯이 아직 연결되지 않았습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.sectionGap}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={[styles.sectionHeading, { color: theme.ink, ...fonts.display }]}>선수 스탯</Text>
        <View accessibilityLabel="선수 스탯 보기" style={{ flexDirection: 'row', gap: 2, borderRadius: 10, padding: 3, backgroundColor: theme.card }}>{[false, true].map((value) => <Pressable key={String(value)} accessibilityRole="button" accessibilityState={{ selected: stats === value }} onPress={() => setStats(value)} style={{ height: 32, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: stats === value ? theme.border : 'transparent', backgroundColor: stats === value ? colorScheme === 'dark' ? theme.border : theme.surface : 'transparent' }}><Text style={{ ...fonts.medium, fontSize: 14, lineHeight: 20, color: stats === value ? theme.ink : theme.muted }}>{value ? '통계' : '기본'}</Text></Pressable>)}</View>
      </View>
      <View style={[styles.frame, { borderColor: theme.border }]}>
        <TeamGroup players={set.playerStats} set={set} side="blue" stats={stats} />
        <TeamGroup players={set.playerStats} set={set} side="red" stats={stats} />
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
  headerIdentity: { alignItems: 'center', flexDirection: 'row', gap: 8, minWidth: 0 },
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
  loadoutBlock: { alignItems: 'center', flexDirection: 'row', gap: 8, minWidth: 0 },
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
