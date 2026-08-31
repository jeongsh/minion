import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Check from 'lucide-react-native/icons/check';
import Grid2X2 from 'lucide-react-native/icons/grid-2x2';
import Settings from 'lucide-react-native/icons/settings';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileMiniconItem, type MobileMiniconPack } from '@/lib/api-client';

const RECENT_STORAGE_KEY = 'minion:minicon-recents';
const RECENT_LIMIT = 48;

export async function rememberMiniconUse(itemId: string) {
  try {
    const raw = await AsyncStorage.getItem(RECENT_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const current = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
    await AsyncStorage.setItem(
      RECENT_STORAGE_KEY,
      JSON.stringify([itemId, ...current.filter((value) => value !== itemId)].slice(0, RECENT_LIMIT)),
    );
  } catch {
    // 저장소가 막혀도 미니콘 전송은 계속 동작한다.
  }
}

export function MiniconPicker({
  bottom,
  doubleMode,
  onDoubleModeChange,
  onSelect,
  onStartDouble,
  packs,
  selectedIds,
  showDoubleMode = true,
}: {
  bottom: number;
  doubleMode: boolean;
  onDoubleModeChange?: (enabled: boolean) => void;
  onSelect: (item: MobileMiniconItem) => void;
  onStartDouble?: (item: MobileMiniconItem) => void;
  packs: MobileMiniconPack[];
  selectedIds: string[];
  showDoubleMode?: boolean;
}) {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const { fonts, theme } = useMinionTheme();
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState(packs[0]?.id ?? 'recent');
  const longPressTriggered = useRef(false);
  const allItems = useMemo(() => packs.flatMap((pack) => pack.items), [packs]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(RECENT_STORAGE_KEY).then((raw) => {
      if (!active) return;
      try {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        const ids = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
        const available = ids.filter((id) => allItems.some((item) => item.id === id)).slice(0, RECENT_LIMIT);
        setRecentIds(available);
        if (available.length > 0) setActiveTab('recent');
      } catch {
        setRecentIds([]);
      }
    });
    return () => { active = false; };
  }, [allItems]);

  const recentItems = recentIds.flatMap((id) => {
    const item = allItems.find((candidate) => candidate.id === id);
    return item ? [item] : [];
  });
  const activePack = packs.find((pack) => pack.id === activeTab) ?? packs[0];
  const visibleItems = activeTab === 'recent' ? recentItems : activePack?.items ?? [];
  const itemSize = (width - 62) / 5;
  const maxHeight = Math.min(height * 0.62, 430);

  return (
    <View accessibilityLabel="미니콘 선택" accessibilityViewIsModal style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border, bottom, maxHeight }]}>
      <View style={[styles.toolbar, { borderBottomColor: theme.border }]}>
        {showDoubleMode ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: doubleMode }} onPress={() => onDoubleModeChange?.(!doubleMode)} style={styles.doubleButton}>
          <View style={[styles.checkbox, { backgroundColor: doubleMode ? theme.accent : 'transparent', borderColor: doubleMode ? theme.accent : theme.border }]}>
            {doubleMode ? <Check color="#fff" size={12} strokeWidth={2.5} /> : null}
          </View>
          <Text style={{ color: theme.text, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>더블콘</Text>
        </Pressable> : <View />}
        <View style={styles.toolbarActions}>
          <Pressable accessibilityLabel="전체 미니콘 보기" onPress={() => router.push('/minicons' as never)} style={styles.iconButton}><Grid2X2 color={theme.muted} size={18} strokeWidth={1.7} /></Pressable>
          <Pressable accessibilityLabel="내 미니콘 설정" onPress={() => router.push('/me/minicons' as never)} style={styles.iconButton}><Settings color={theme.muted} size={19} strokeWidth={1.7} /></Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.tabsContent} horizontal showsHorizontalScrollIndicator={false} style={[styles.tabs, { borderBottomColor: theme.border }]}>
        {recentItems.length > 0 ? <Tab active={activeTab === 'recent'} label="최근" onPress={() => setActiveTab('recent')} /> : null}
        {packs.map((pack) => <Tab active={activeTab === pack.id} key={pack.id} label={pack.name} onPress={() => setActiveTab(pack.id)} />)}
      </ScrollView>
      <ScrollView contentContainerStyle={visibleItems.length > 0 ? styles.grid : styles.emptyContent} nestedScrollEnabled showsVerticalScrollIndicator style={styles.itemScroll}>
        {visibleItems.length > 0 ? visibleItems.map((item) => (
          <Pressable
            accessibilityLabel={`${item.packName} ${item.name} 선택`}
            key={item.id}
            onLongPress={showDoubleMode ? () => { longPressTriggered.current = true; onStartDouble?.(item); } : undefined}
            onPress={() => { if (!longPressTriggered.current) onSelect(item); }}
            onPressIn={() => { longPressTriggered.current = false; }}
            style={{ backgroundColor: theme.surfaceMuted, height: itemSize, width: itemSize }}>
            <Image accessibilityLabel="" contentFit="cover" source={{ uri: resolveApiAssetUrl(item.imageUrl) ?? item.imageUrl }} style={StyleSheet.absoluteFill} />
            {selectedIds.includes(item.id) ? <View pointerEvents="none" style={[styles.selected, { borderColor: theme.accent }]} /> : null}
          </Pressable>
        )) : <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 14, lineHeight: 21 }}>최근 사용한 미니콘이 없습니다.</Text>}
      </ScrollView>
    </View>
  );
}

function Tab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const { fonts, theme } = useMinionTheme();
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.tab, active ? { backgroundColor: theme.ink } : null]}><Text style={{ color: active ? theme.surface : theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  panel: { borderRadius: 18, borderWidth: 1, elevation: 12, left: 8, overflow: 'hidden', position: 'absolute', right: 8, shadowColor: '#000', shadowOffset: { height: 8, width: 0 }, shadowOpacity: 0.22, shadowRadius: 18, zIndex: 30 },
  toolbar: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 44, paddingHorizontal: 8, paddingVertical: 6 },
  doubleButton: { alignItems: 'center', flexDirection: 'row', gap: 6, height: 32, paddingHorizontal: 6 },
  checkbox: { alignItems: 'center', borderWidth: 1, height: 16, justifyContent: 'center', width: 16 },
  toolbarActions: { alignItems: 'center', flexDirection: 'row', gap: 2 },
  iconButton: { alignItems: 'center', borderRadius: 999, height: 32, justifyContent: 'center', width: 32 },
  tabs: { borderBottomWidth: 1, flexGrow: 0, minHeight: 48 },
  tabsContent: { alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 8 },
  tab: { alignItems: 'center', borderRadius: 999, height: 32, justifyContent: 'center', paddingHorizontal: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10 },
  itemScroll: { flexShrink: 1 },
  emptyContent: { alignItems: 'center', justifyContent: 'center', minHeight: 100, paddingVertical: 32 },
  selected: { ...StyleSheet.absoluteFillObject, borderWidth: 2 },
});
