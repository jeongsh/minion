import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

export type MatchTabKey = 'preview' | 'live' | 'data' | 'rating' | 'video';

const TAB_LABELS: Record<MatchTabKey, string> = {
  data: '세트',
  live: '실시간',
  preview: '프리뷰',
  rating: '평가',
  video: '영상',
};

/** 웹 매치 상세 TabNav(rounded-[10px] bg-[var(--ui-card-bg)] p-[3px] 알약 그리드)와 동일. 아직 구현되지 않은 탭은 목록에서 뺀다. */
export function MatchTabNav({ activeTab, availableTabs, onSelect }: { activeTab: MatchTabKey; availableTabs: MatchTabKey[]; onSelect: (tab: MatchTabKey) => void }) {
  const { fonts, theme } = useMinionTheme();

  return (
    <View style={[styles.track, { backgroundColor: theme.pageBackground, borderBottomColor: theme.border }]}>
      {availableTabs.map((tab) => {
        const active = tab === activeTab;
        return (
          <Pressable
            key={tab}
            onPress={() => onSelect(tab)}
            style={[styles.pill, { borderBottomColor: active ? theme.accent : 'transparent' }]}
          >
            <Text style={[styles.pillText, { color: active ? theme.ink : theme.muted, fontFamily: fonts.medium }]}>{TAB_LABELS[tab]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignItems: 'center', borderBottomWidth: 2, flex: 1, height: 36, justifyContent: 'center', outlineColor: 'transparent', outlineStyle: 'solid', outlineWidth: 0, paddingHorizontal: 8 },
  pillText: { fontSize: 14, lineHeight: 21 },
  track: { borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', marginHorizontal: -16 },
});
