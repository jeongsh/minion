import { Image } from 'expo-image';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { useId, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, FeColorMatrix, Filter, Image as SvgImage } from 'react-native-svg';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileSetPlayerBuild } from '@/lib/api-client';

type Rune = NonNullable<MobileSetPlayerBuild['runeGrid']>['primaryRows'][number][number];
const SLOTS = [1, 2, 3, 4] as const;
const KEYS = { 1: 'Q', 2: 'W', 3: 'E', 4: 'R' };

function Asset({ url, size, padding = 0, muted = false }: { url?: string | null; size: number; padding?: number; muted?: boolean }) {
  const filterId = `build-gray-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  // iOS does not implement React Native's grayscale View filter.
  if (Platform.OS === 'ios' && muted && url) return <View style={{ width: size, height: size, padding, opacity: 0.32 }}><Svg width={size - padding * 2} height={size - padding * 2}><Defs><Filter id={filterId}><FeColorMatrix type="saturate" values="0" /></Filter></Defs><SvgImage href={{ uri: url }} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" filter={`url(#${filterId})`} /></Svg></View>;
  return <View style={{ height: size, width: size, padding, opacity: muted ? 0.32 : 1, filter: muted ? 'grayscale(1)' : undefined }}>{url ? <Image source={{ uri: url }} contentFit="contain" style={{ width: '100%', height: '100%' }} /> : null}</View>;
}

function Title({ children }: { children: ReactNode }) {
  const { fonts, theme } = useMinionTheme();
  const { width } = useWindowDimensions();
  return <Text style={{ ...fonts.bold, color: theme.ink, fontSize: width >= 640 ? 18 : 15, lineHeight: 22, marginBottom: 12 }}>{children}</Text>;
}

function RuneRow({ row, keystone = false, shard = false }: { row: Rune[]; keystone?: boolean; shard?: boolean }) {
  const { width } = useWindowDimensions();
  const { colorScheme } = useMinionTheme();
  const sm = width >= 640;
  const size = keystone ? (sm ? 40 : 36) : shard ? (sm ? 32 : 28) : (sm ? 34 : 30);
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sm ? 8 : 4, minHeight: keystone ? (sm ? 48 : 44) : shard ? (sm ? 38 : 34) : (sm ? 42 : 38) }}>
    {row.map((rune, index) => <View key={`${rune.name}-${index}`} accessibilityLabel={rune.name} style={{ borderRadius: size / 2, backgroundColor: colorScheme === 'dark' ? '#24272d' : shard ? '#cdd0d6' : '#d9dce2', overflow: 'hidden' }}><Asset url={rune.url} size={size} padding={keystone ? 4 : 2} muted={!rune.selected} /></View>)}
  </View>;
}

function Runes({ entry }: { entry: MobileSetPlayerBuild }) {
  const { fonts, theme } = useMinionTheme();
  const { width } = useWindowDimensions();
  const grid = entry.runeGrid;
  const emptyRows = (count: number) => Array.from({ length: count }, (_, index) => ({ name: `empty-${index}`, url: '', selected: false }));
  return <View accessibilityLabel={grid ? '룬' : '룬 데이터 없음'} style={{ width: '100%', maxWidth: 440, alignSelf: 'center', marginTop: 4, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
    {[0, 1].map((column) => <View key={column} style={{ flex: column === 0 ? 1.2 : 1, minWidth: column === 0 ? (grid?.primaryRows[0]?.length ?? 3) * (width >= 640 ? 40 : 36) + ((grid?.primaryRows[0]?.length ?? 3) - 1) * (width >= 640 ? 8 : 4) : (width >= 640 ? 118 : 98) }}>
      <View style={{ flexDirection: 'row', height: 32, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Asset url={column === 0 ? grid?.primaryTreeIcon : grid?.secondaryTreeIcon} size={18} muted={grid?.empty} />
        {grid ? <Text style={{ ...fonts.medium, fontSize: 13, lineHeight: 20, color: theme.text }}>{column === 0 ? grid.primaryTreeName : grid.secondaryTreeName}</Text> : null}
      </View>
      <View style={{ marginTop: 4 }}>{(grid ? (column === 0 ? grid.primaryRows : grid.secondaryRows) : Array.from({ length: column === 0 ? 4 : 3 }, () => emptyRows(3))).map((row, index) => <RuneRow key={index} row={row} keystone={column === 0 && index === 0} />)}</View>
      {column === 1 ? <View accessibilityLabel="능력치 파편" style={{ marginTop: 8 }}>{(grid?.shardRows ?? Array.from({ length: 3 }, () => emptyRows(3))).map((row, index) => <RuneRow key={index} row={row} shard />)}</View> : null}
    </View>)}
  </View>;
}

function Items({ entry }: { entry: MobileSetPlayerBuild }) {
  const { fonts, theme } = useMinionTheme();
  const empty = entry.itemPurchaseGroups.length === 0;
  const groups = empty ? [3, 2, 2, 3].map((count) => ({ minute: 0, purchases: Array.from({ length: count }, () => ({ itemId: 0, timestampMs: 0, sold: false })) })) : entry.itemPurchaseGroups;
  return <View accessibilityLabel={empty ? '구매 기록 없음' : '아이템 구매 순서'} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: 8, rowGap: 12, paddingTop: 4, minHeight: empty ? 112 : undefined }}>
    {groups.map((group, index) => {
      const timestamp = group.purchases[0]?.timestampMs ?? 0;
      const time = index === 0 && group.minute === 0 ? '시작' : `${Math.floor(timestamp / 60000)}:${String(Math.floor(timestamp % 60000 / 1000)).padStart(2, '0')}`;
      return <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, maxWidth: '100%', minWidth: 0 }}>
        {index > 0 ? <View style={{ backgroundColor: theme.surface, height: 24, width: 16, borderRadius: 4, justifyContent: 'center' }}><ChevronRight size={16} color={theme.muted} /></View> : null}
        <View style={{ minWidth: 0, flexShrink: 1 }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>{group.purchases.map((purchase, itemIndex) => <View key={itemIndex} accessibilityLabel={purchase.sold ? '판매한 아이템' : undefined} style={{ width: 24, height: 24, backgroundColor: theme.surface, borderRadius: 6, overflow: 'hidden' }}>
          <Asset url={purchase.itemId ? `https://ddragon.leagueoflegends.com/cdn/${entry.version}/img/item/${purchase.itemId}.png` : null} size={24} muted={purchase.sold} />
          {purchase.sold ? <View style={{ height: 1, backgroundColor: '#ffffff', position: 'absolute', top: 12, width: 24, transform: [{ rotate: '-35deg' }] }} /> : null}
        </View>)}</View>{empty ? <View style={{ marginTop: 6, height: 12, width: 32, backgroundColor: theme.surface }} /> : <Text style={{ ...fonts.medium, fontSize: 13, lineHeight: 20, marginTop: 4, color: theme.muted }}>{time}</Text>}</View>
      </View>;
    })}
  </View>;
}

function Skills({ entry }: { entry: MobileSetPlayerBuild }) {
  const { fonts, theme } = useMinionTheme();
  const { width } = useWindowDimensions();
  const [available, setAvailable] = useState(0);
  const gridWidth = Math.max(width >= 640 ? 560 : 548, Math.min(760, available));
  const cell = (gridWidth - 54) / 19;
  const selected = new Set(entry.skillOrder.map(({ slot, level }) => `${slot}-${level}`));
  return <View onLayout={(event) => setAvailable(event.nativeEvent.layout.width)}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={{ flexGrow: 1, paddingBottom: 2 }}>
      <View style={{ width: gridWidth, marginHorizontal: 'auto', gap: 3 }}>
        <View style={{ flexDirection: 'row', gap: 3 }}>{Array.from({ length: 19 }, (_, level) => <Text key={level} style={{ width: cell, fontSize: level ? 12 : 13, lineHeight: 18, textAlign: 'center', color: theme.muted, ...fonts.medium }}>{level || '레벨'}</Text>)}</View>
        {SLOTS.map((slot) => <View key={slot} style={{ flexDirection: 'row', gap: 3 }}>
          <View style={{ width: cell, height: cell, borderRadius: 6, backgroundColor: theme.surface, overflow: 'hidden' }}><Asset url={entry.abilityIcons?.[slot]} size={cell} /><Text style={{ position: 'absolute', bottom: 0, left: 0, minWidth: 16, height: 16, textAlign: 'center', fontSize: 12, lineHeight: 16, ...fonts.medium, color: '#ffffff', backgroundColor: '#000000b3', borderTopRightRadius: 4 }}>{KEYS[slot]}</Text></View>
          {Array.from({ length: 18 }, (_, index) => index + 1).map((level) => { const learned = selected.has(`${slot}-${level}`); return <View key={level} style={{ width: cell, height: cell, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: learned ? theme.accent : theme.surface }}><Text style={{ ...fonts.medium, fontSize: 12, lineHeight: 16, color: learned ? theme.accentForeground : 'transparent' }}>{learned ? level : null}</Text></View>; })}
        </View>)}
      </View>
    </ScrollView>
  </View>;
}

export function MatchPlayerBuildPanel({ entries }: { entries: MobileSetPlayerBuild[] }) {
  const { fonts, theme } = useMinionTheme();
  const { width } = useWindowDimensions();
  const [selectedId, setSelectedId] = useState(entries[0]?.playerId ?? '');
  const selected = entries.find((entry) => entry.playerId === selectedId) ?? entries[0];
  const sm = width >= 640;
  if (!selected) return null;
  const card = { padding: sm ? 16 : 12, backgroundColor: theme.card, borderRadius: 8, minWidth: 0 };
  return <View accessibilityLabel="빌드" style={{ gap: 12 }}>
    <Text style={{ ...fonts.display, fontSize: sm ? 20 : 16, lineHeight: 22, color: theme.ink }}>빌드</Text>
    <View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 12, overflow: 'hidden', backgroundColor: theme.surface }}>
      <View accessibilityLabel="빌드 선수 선택" style={{ flexDirection: sm ? 'row' : 'column', gap: sm ? 16 : 8, paddingHorizontal: sm ? 16 : 12, paddingTop: sm ? 16 : 12, paddingBottom: 12 }}>
        {(['blue', 'red'] as const).map((side) => <View key={side} style={{ flex: sm ? 1 : undefined, flexDirection: 'row', gap: 4 }}>{entries.filter((entry) => entry.side === side).map((entry) => {
          const active = entry.playerId === selected.playerId;
          const accent = side === 'blue' ? '#2563eb' : '#f43f5e';
          return <View key={entry.playerId} style={{ flex: 1, minWidth: 0, alignItems: 'center' }}><Pressable accessibilityRole="button" accessibilityLabel={`${entry.playerName} 빌드 보기`} accessibilityState={{ selected: active }} onPress={() => setSelectedId(entry.playerId)} style={{ width: '100%', maxWidth: 80, height: sm ? 72 : 64, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: active ? `${accent}1a` : 'transparent' }}><View style={{ borderRadius: 6, overflow: 'hidden' }}><Asset url={entry.championImageUrl} size={sm ? 40 : 32} /></View><Text numberOfLines={1} style={{ maxWidth: '100%', marginTop: 4, ...fonts.medium, fontSize: 13, lineHeight: 20, color: active ? accent : theme.muted }}>{entry.playerName}</Text></Pressable></View>;
        })}</View>)}
      </View>
      <View style={{ flexDirection: width >= 1280 ? 'row' : 'column', gap: 12, paddingBottom: 12, paddingHorizontal: sm ? 12 : 0 }}>
        <View style={[card, width >= 1280 && { flex: 0.9 }]}><Title>룬</Title><Runes entry={selected} /></View>
        <View style={{ gap: 12, minWidth: 0, flex: width >= 1280 ? 1.1 : undefined }}>
          <View style={[card, { flexGrow: 1 }]}><Title>아이템 빌드</Title><Items entry={selected} /></View>
          <View style={card}><Title>스킬 빌드</Title><Skills entry={selected} /></View>
        </View>
      </View>
    </View>
  </View>;
}
