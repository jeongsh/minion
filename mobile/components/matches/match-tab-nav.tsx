import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import { minionSize } from '@/constants/minion-theme';

export type MatchTabKey = 'preview' | 'live' | 'data' | 'rating' | 'video';

const TAB_LABELS: Record<MatchTabKey, string> = {
  data: '세트',
  live: '라이브',
  preview: '프리뷰',
  rating: '평가',
  video: '영상',
};

/** 웹 SegmentedControl과 동일한 탭 트랙. */
export function MatchTabNav({ activeTab, availableTabs, onSelect, setSelector }: { activeTab: MatchTabKey; availableTabs: MatchTabKey[]; onSelect: (tab: MatchTabKey) => void; setSelector?: ReactNode }) {
  const { colorScheme, fonts, theme } = useMinionTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: theme.pageBackground }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.track, { backgroundColor: theme.card }]} contentContainerStyle={styles.trackContent}>
      {availableTabs.map((tab) => {
        const active = tab === activeTab;
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(tab)}
            style={[styles.pill, { borderColor: active ? theme.border : 'transparent', backgroundColor: active ? colorScheme === 'dark' ? theme.border : theme.surface : 'transparent' }]}
          >
            <Text numberOfLines={1} style={[styles.pillText, { color: active ? theme.ink : theme.muted, ...fonts.medium }]}>{TAB_LABELS[tab]}</Text>
          </Pressable>
        );
      })}
      </ScrollView>
      {setSelector}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignItems: 'center', borderWidth: 1, borderRadius: 8, flexBasis: 0, flexGrow: 1, flexShrink: 0, minWidth: 60, height: minionSize.control - 6, justifyContent: 'center', outlineColor: 'transparent', outlineStyle: 'solid', outlineWidth: 0, paddingHorizontal: 10 },
  pillText: { fontSize: 14, lineHeight: 21, minWidth: 36, textAlign: 'center' },
  track: { borderRadius: 10, flex: 1, height: minionSize.control, minWidth: 0 },
  trackContent: { flexGrow: 1, flexDirection: 'row', gap: 2, padding: 3 },
  wrap: { alignItems: 'center', flexDirection: 'row', gap: 8, marginHorizontal: -16, paddingHorizontal: 16, paddingVertical: 8, zIndex: 30 },
});
