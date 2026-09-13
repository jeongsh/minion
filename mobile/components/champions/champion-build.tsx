import { Image } from 'expo-image';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { useId } from 'react';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, FeColorMatrix, Filter, Image as SvgImage } from 'react-native-svg';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileChampionBuild, type MobileChampionItem, type MobileChampionItemSequence, type MobileChampionRuneColumn, type MobileChampionRuneOption } from '@/lib/api-client';

function percent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

function AssetImage({ source, size = 36, radius = 6 }: { source?: string | null; size?: number; radius?: number }) {
  const { theme } = useMinionTheme();
  const uri = resolveApiAssetUrl(source) ?? source;
  return uri ? <Image contentFit="cover" source={{ uri }} style={{ borderRadius: radius, height: size, width: size }} /> : <View style={{ backgroundColor: theme.surfaceMuted, borderRadius: radius, height: size, width: size }} />;
}

function BuildStats({ games, winRate }: { games: number; winRate: number }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={styles.stats}>
      <Text style={{ color: theme.ink, ...fonts.medium, fontSize: 12, lineHeight: 18 }}>{percent(winRate)}</Text>
      <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20 }}>{games}세트</Text>
    </View>
  );
}

function Title({ children }: { children: string }) {
  const { fonts, theme } = useMinionTheme();
  return <Text style={{ color: theme.ink, ...fonts.bold, fontSize: 15, lineHeight: 22 }}>{children}</Text>;
}

function Empty({ children = '표본 부족' }: { children?: string }) {
  const { fonts, theme } = useMinionTheme();
  return <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 14, lineHeight: 22, paddingVertical: 12 }}>{children}</Text>;
}

function RuneAsset({ url, size, padding = 0, muted = false }: { url?: string | null; size: number; padding?: number; muted?: boolean }) {
  const filterId = `build-gray-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  // iOS does not implement React Native's grayscale View filter.
  if (Platform.OS === 'ios' && muted && url) return <View style={{ width: size, height: size, padding, opacity: 0.32 }}><Svg width={size - padding * 2} height={size - padding * 2}><Defs><Filter id={filterId}><FeColorMatrix type="saturate" values="0" /></Filter></Defs><SvgImage href={{ uri: url }} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" filter={`url(#${filterId})`} /></Svg></View>;
  return <View style={{ height: size, width: size, padding, opacity: muted ? 0.32 : 1, filter: muted ? 'grayscale(1)' : undefined }}>{url ? <Image source={{ uri: url }} contentFit="contain" style={{ width: '100%', height: '100%' }} /> : null}</View>;
}

function RuneRow({ row, large = false, shard = false }: { row: MobileChampionRuneOption[]; large?: boolean; shard?: boolean }) {
  const { colorScheme } = useMinionTheme();
  const { width } = useWindowDimensions();
  const sm = width >= 640;
  const size = large ? (sm ? 40 : 36) : shard ? (sm ? 32 : 28) : (sm ? 34 : 30);
  return (
    <View style={[styles.runeRow, { gap: sm ? 8 : 4, minHeight: large ? (sm ? 48 : 44) : shard ? (sm ? 38 : 34) : (sm ? 42 : 38) }]}>
      {row.map((rune) => (
        <View key={rune.name} accessibilityLabel={rune.name} style={{ backgroundColor: colorScheme === 'dark' ? '#24272d' : shard ? '#cdd0d6' : '#d9dce2', borderRadius: size / 2, overflow: 'hidden' }}>
          <RuneAsset size={size} padding={large ? 4 : 2} muted={!rune.selected} url={resolveApiAssetUrl(rune.image?.url)} />
        </View>
      ))}
    </View>
  );
}

function RuneColumn({ column, primary = false }: { column: MobileChampionRuneColumn; primary?: boolean }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={{ minWidth: 0 }}>
      <View style={styles.runeTitle}><RuneAsset size={18} url={resolveApiAssetUrl(column.image?.url)} /><Text style={{ color: theme.text, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>{column.name}</Text></View>
      <View style={{ marginTop: 4 }}>{column.rows.map((row, index) => <RuneRow key={`${column.name}-${index}`} large={primary && index === 0} row={row} />)}</View>
    </View>
  );
}

function RunePanel({ build }: { build: MobileChampionBuild }) {
  const { theme, fonts } = useMinionTheme();
  const { width } = useWindowDimensions();
  const sm = width >= 640;
  const count = build.runes.primary?.rows[0]?.length ?? 3;
  return (
    <View style={[styles.largePanel, { backgroundColor: theme.card, padding: sm ? 16 : 12 }]}>
      <Text style={{ color: theme.ink, ...fonts.bold, fontSize: sm ? 18 : 15, lineHeight: 22, marginBottom: 4 }}>선호 룬</Text>
      {build.runes.primary && build.runes.secondary ? (
        <View style={styles.runeGrid}>
          <View style={{ flex: 1.2, minWidth: count * (sm ? 40 : 36) + (count - 1) * (sm ? 8 : 4) }}><RuneColumn column={build.runes.primary} primary /></View>
          <View style={{ flex: 1, minWidth: sm ? 118 : 98 }}><RuneColumn column={build.runes.secondary} /><View accessibilityLabel="능력치 파편" style={{ marginTop: 8 }}>{build.runes.shards.map((row, index) => <RuneRow key={`shard-${index}`} row={row} shard />)}</View></View>
        </View>
      ) : <Empty>룬 기록이 없습니다.</Empty>}
    </View>
  );
}

function SpellPanel({ build }: { build: MobileChampionBuild }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={[styles.compactPanel, { backgroundColor: theme.card }]}>
      <Title>소환사 주문</Title>
      {build.spells.length ? build.spells.map((spell) => (
        <View key={spell.items.map((item) => item.id).join(':')} style={styles.spellRow}>
          <View style={styles.assetRow}>{spell.items.map((item) => <AssetImage key={item.id} size={24} source={item.image?.url} />)}</View>
          <Text numberOfLines={1} style={{ color: theme.ink, flex: 1, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>{spell.items.map((item) => item.name).join(' + ')}</Text>
          <BuildStats games={spell.games} winRate={spell.winRate} />
        </View>
      )) : <Empty>주문 기록이 없습니다.</Empty>}
    </View>
  );
}

const SKILLS = [1, 2, 3, 4];
const SKILL_KEY: Record<number, string> = { 1: 'Q', 2: 'W', 3: 'E', 4: 'R' };

function SkillTimeline({ build }: { build: MobileChampionBuild }) {
  const { fonts, theme } = useMinionTheme();
  const skill = build.skill;
  if (!skill) return <Empty>스킬 레벨업 표본이 부족합니다.</Empty>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeline}>
      <View style={styles.timelineRow}>
        <Text style={[styles.timelineLabel, { color: theme.muted, ...fonts.medium }]}>레벨</Text>
        {Array.from({ length: 18 }, (_, index) => <Text key={index} style={[styles.level, { color: theme.muted, ...fonts.medium }]}>{index + 1}</Text>)}
      </View>
      {SKILLS.map((slot) => (
        <View key={slot} style={styles.timelineRow}>
          <View style={styles.skillIcon}><AssetImage radius={5} size={24} source={skill.icons[String(slot)]?.url} /><Text style={[styles.skillKey, { ...fonts.medium }]}>{SKILL_KEY[slot]}</Text></View>
          {Array.from({ length: 18 }, (_, index) => {
            const learned = skill.order[index] === slot;
            return <View key={index} style={[styles.levelCell, { backgroundColor: learned ? theme.accent : theme.surface }]}>{learned ? <Text style={{ color: theme.accentForeground, ...fonts.medium, fontSize: 12, lineHeight: 26 }}>{index + 1}</Text> : null}</View>;
          })}
        </View>
      ))}
    </ScrollView>
  );
}

function SkillPanel({ build }: { build: MobileChampionBuild }) {
  const { theme } = useMinionTheme();
  return (
    <View style={[styles.largePanel, { backgroundColor: theme.card }]}>
      <View style={styles.panelHeading}><Title>스킬 빌드</Title>{build.skill ? <BuildStats games={build.skill.games} winRate={build.skill.winRate} /> : null}</View>
      <SkillTimeline build={build} />
    </View>
  );
}

function Sequence({ row, minutes = false }: { row: MobileChampionItemSequence; minutes?: boolean }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={styles.sequence}>
      <View style={styles.sequenceItems}>{row.items.map((item, index) => <View key={`${item.id}-${index}`} style={styles.sequenceUnit}>{index ? <ChevronRight color={theme.muted} size={12} /> : null}<View><AssetImage size={24} source={item.image?.url} />{minutes && item.minute != null ? <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 18, textAlign: 'center' }}>{Math.round(item.minute)}분</Text> : null}</View></View>)}</View>
      <BuildStats games={row.games} winRate={row.winRate} />
    </View>
  );
}

function PopularItems({ items }: { items: MobileChampionItem[] }) {
  const { fonts, theme } = useMinionTheme();
  return items.length ? <View style={styles.popular}>{items.map((item) => <View key={item.id} style={styles.popularItem}><AssetImage size={24} source={item.image?.url} /><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 12, lineHeight: 18 }}>{percent(item.selectionRate, 0)}</Text></View>)}</View> : <Empty />;
}

function DepthItems({ items }: { items: MobileChampionItem[] }) {
  const { theme } = useMinionTheme();
  return items.length ? <View style={styles.depthList}>{items.map((item) => <View key={item.id} style={[styles.depthRow, { backgroundColor: theme.surface }]}><AssetImage size={24} source={item.image?.url} /><View style={styles.grow} /><BuildStats games={item.games} winRate={item.winRate} /></View>)}</View> : <Empty />;
}

function ItemPanel({ build }: { build: MobileChampionBuild }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={[styles.itemShell, { backgroundColor: theme.card }]}>
      <Title>아이템 빌드</Title>
      <View style={[styles.itemCard, { backgroundColor: theme.surface }]}>
        <Text style={{ color: theme.ink, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>시작 아이템</Text>
        {build.startingItems.length ? build.startingItems.map((row, index) => <Sequence key={index} row={row} />) : <Empty>시작 아이템 표본이 부족합니다.</Empty>}
        <View style={styles.preferenceGrid}><View style={styles.grow}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 13, lineHeight: 20, marginBottom: 7 }}>선호 신발</Text><PopularItems items={build.boots} /></View><View style={styles.grow}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 13, lineHeight: 20, marginBottom: 7 }}>선호 장신구</Text><PopularItems items={build.trinkets} /></View></View>
      </View>
      <View style={[styles.itemCard, { backgroundColor: theme.surface }]}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>3코어</Text>{build.core3.length ? build.core3.map((row, index) => <Sequence key={index} minutes row={row} />) : <Empty />}</View>
      {[4, 5, 6].map((count) => {
        const items = count === 4 ? build.core4 : count === 5 ? build.core5 : build.core6;
        return <View key={count} style={[styles.itemCard, { backgroundColor: theme.surface }]}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>{count}코어</Text><DepthItems items={items} /></View>;
      })}
    </View>
  );
}

export function ChampionBuildView({ build }: { build: MobileChampionBuild }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={styles.page}>
      <Text style={{ color: theme.ink, ...fonts.display, fontSize: 16, lineHeight: 22 }}>프로 빌드</Text>
      <RunePanel build={build} />
      <View style={styles.sideStack}>
        <SpellPanel build={build} />
        <SkillPanel build={build} />
      </View>
      <ItemPanel build={build} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 12 },
  sideStack: { gap: 8 },
  largePanel: { borderRadius: 8, padding: 12 },
  compactPanel: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  panelHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  stats: { alignItems: 'baseline', flexDirection: 'row', gap: 6, justifyContent: 'flex-end', minWidth: 80 },
  runeGrid: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', alignSelf: 'center', width: '100%', maxWidth: 440, marginTop: 4 },
  runeTitle: { alignItems: 'center', flexDirection: 'row', gap: 6, height: 32, justifyContent: 'center' },
  runeRow: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center' },
  spellRow: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 42 },
  assetRow: { flexDirection: 'row', gap: 5 },
  timeline: { flexDirection: 'column', gap: 3, paddingTop: 8 },
  timelineRow: { flexDirection: 'row', gap: 3 },
  timelineLabel: { fontSize: 13, lineHeight: 26, textAlign: 'center', width: 28 },
  level: { fontSize: 12, lineHeight: 26, textAlign: 'center', width: 26 },
  levelCell: { alignItems: 'center', borderRadius: 5, height: 26, justifyContent: 'center', width: 26 },
  skillIcon: { height: 24, position: 'relative', width: 24 },
  skillKey: { backgroundColor: 'rgba(0,0,0,.72)', borderTopRightRadius: 3, bottom: 0, color: '#ffffff', fontSize: 12, left: 0, lineHeight: 14, minWidth: 14, paddingHorizontal: 2, position: 'absolute', textAlign: 'center' },
  itemShell: { borderRadius: 8, gap: 8, padding: 12 },
  itemCard: { borderRadius: 8, padding: 11 },
  sequence: { alignItems: 'flex-start', flexDirection: 'row', gap: 6, justifyContent: 'space-between', paddingVertical: 7 },
  sequenceItems: { flexDirection: 'row', flexShrink: 1 },
  sequenceUnit: { alignItems: 'flex-start', flexDirection: 'row', gap: 2 },
  preferenceGrid: { flexDirection: 'row', gap: 16, marginTop: 10 },
  popular: { flexDirection: 'row', gap: 7 },
  popularItem: { alignItems: 'center', gap: 3 },
  depthList: { gap: 4, marginTop: 5 },
  depthRow: { alignItems: 'center', borderRadius: 6, flexDirection: 'row', minHeight: 36, paddingHorizontal: 6, paddingVertical: 4 },
  grow: { flex: 1 },
});
