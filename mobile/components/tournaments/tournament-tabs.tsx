import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

export type TournamentTabItem = { key: string; label: string };

/** 웹 components/ui/tabs.tsx의 SegmentedControl(회색 트랙 위 흰 알약)을 그대로 옮김. 스플릿/브래킷 스테이지 선택에 쓴다. */
export function TournamentSegmentedControl({ activeKey, items, onSelect }: { activeKey: string; items: TournamentTabItem[]; onSelect: (key: string) => void }) {
  const { fonts, theme } = useMinionTheme();
  if (items.length <= 1) return null;

  return (
    <View style={[styles.track, { backgroundColor: theme.card }]}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            onPress={() => onSelect(item.key)}
            style={[styles.pill, active && { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
            <Text style={[styles.pillText, { color: active ? theme.ink : theme.muted, fontFamily: active ? fonts.black : fonts.bold }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 웹 UnderlineNav(파페로치 볼드 + 3px 언더라인)를 그대로 옮김. POM/순위표/브래킷 같은 1차 뷰 전환에 쓴다. */
export function TournamentUnderlineNav({ activeKey, bordered = true, items, onSelect }: { activeKey: string; bordered?: boolean; items: TournamentTabItem[]; onSelect: (key: string) => void }) {
  const { fonts, theme } = useMinionTheme();
  if (items.length === 0) return null;

  return (
    <ScrollView contentContainerStyle={[styles.underlineContent, bordered && { borderBottomColor: theme.border, borderBottomWidth: 1 }]} horizontal showsHorizontalScrollIndicator={false}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable key={item.key} onPress={() => onSelect(item.key)} style={[styles.underlineItem, { borderBottomColor: active ? theme.accent : 'transparent' }]}>
            <Text style={[styles.underlineText, { color: active ? theme.ink : theme.muted, fontFamily: fonts.display }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pill: { alignItems: 'center', borderRadius: 8, height: 32, justifyContent: 'center', paddingHorizontal: 14 },
  pillText: { fontSize: 13, lineHeight: 19.5 },
  track: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 10, flexDirection: 'row', gap: 2, padding: 3 },
  underlineContent: { flexDirection: 'row', gap: 20 },
  underlineItem: { alignItems: 'center', borderBottomWidth: 3, justifyContent: 'center', paddingVertical: 10 },
  underlineText: { fontSize: 15, lineHeight: 22.5 },
});
