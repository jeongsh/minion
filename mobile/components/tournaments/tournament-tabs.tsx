import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import { minionSize } from '@/constants/minion-theme';

export type TournamentTabItem = { key: string; label: string };

/** 웹 components/ui/tabs.tsx의 SegmentedControl(회색 트랙 위 흰 알약)을 그대로 옮김. 스플릿/브래킷 스테이지 선택에 쓴다. */
export function TournamentSegmentedControl({ activeKey, items, onSelect }: { activeKey: string; items: TournamentTabItem[]; onSelect: (key: string) => void }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  if (items.length <= 1) return null;

  return (
    <View style={[styles.track, { backgroundColor: theme.card }]}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            onPress={() => onSelect(item.key)}
            style={[styles.pill, active && { backgroundColor: colorScheme === 'dark' ? theme.border : theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
            <Text style={[styles.pillText, { color: active ? theme.ink : theme.muted, ...fonts.medium }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 웹 UnderlineNav. POM/순위표/브래킷 같은 1차 뷰 전환에 쓴다. */
export function TournamentUnderlineNav({ activeKey, bordered = true, items, onSelect }: { activeKey: string; bordered?: boolean; items: TournamentTabItem[]; onSelect: (key: string) => void }) {
  const { fonts, theme } = useMinionTheme();
  if (items.length === 0) return null;

  return (
    <ScrollView contentContainerStyle={[styles.underlineContent, bordered && { borderBottomColor: theme.border, borderBottomWidth: 1 }]} horizontal showsHorizontalScrollIndicator={false}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable key={item.key} onPress={() => onSelect(item.key)} style={[styles.underlineItem, { borderBottomColor: active ? theme.accent : 'transparent' }]}>
            <Text style={[styles.underlineText, { color: active ? theme.ink : theme.muted, ...fonts.medium }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pill: { alignItems: 'center', borderRadius: 6, height: minionSize.control - 4, justifyContent: 'center', paddingHorizontal: 10 },
  pillText: { fontSize: 14, lineHeight: 20 },
  track: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 8, flexDirection: 'row', gap: 2, height: minionSize.control, padding: 2 },
  underlineContent: { flexDirection: 'row', gap: 16, height: minionSize.control },
  underlineItem: { alignItems: 'center', borderBottomWidth: 2, height: '100%', justifyContent: 'center' },
  underlineText: { fontSize: 14, lineHeight: 21 },
});
