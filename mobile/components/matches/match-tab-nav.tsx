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
    <View style={[styles.track, { backgroundColor: theme.card }]}>
      {availableTabs.map((tab) => {
        const active = tab === activeTab;
        return (
          <Pressable
            key={tab}
            onPress={() => onSelect(tab)}
            style={[styles.pill, active && { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
          >
            <Text style={[styles.pillText, { color: active ? theme.ink : theme.muted, fontFamily: active ? fonts.black : fonts.bold }]}>{TAB_LABELS[tab]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignItems: 'center', borderRadius: 8, flex: 1, height: 32, justifyContent: 'center', paddingHorizontal: 14 },
  pillText: { fontSize: 14, lineHeight: 21 },
  track: { borderRadius: 10, flexDirection: 'row', gap: 2, padding: 3 },
});
