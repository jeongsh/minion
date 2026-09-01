import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileMatchSetSummary } from '@/lib/api-client';

/** 세트가 1개(BO1)여도 웹처럼 현재 세트를 알약으로 명확히 보여준다. */
export function MatchSetSelector({ activeSetId, onSelect, sets }: { activeSetId: string; onSelect: (setId: string) => void; sets: MobileMatchSetSummary[] }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  if (sets.length === 0) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: theme.pageBackground, borderBottomColor: theme.border }]}>
      <View style={[styles.track, { backgroundColor: theme.card }]}>
        {sets.map((set) => {
          const active = set.id === activeSetId;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={set.id}
              onPress={() => onSelect(set.id)}
              style={[styles.pill, active && { backgroundColor: colorScheme === 'dark' ? theme.border : theme.surface, borderColor: theme.border, borderWidth: 1 }]}
            >
              <Text style={[styles.pillText, { color: active ? theme.ink : theme.muted, ...fonts.medium }]}>{set.setNumber}세트</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignItems: 'center', borderRadius: 8, height: 32, justifyContent: 'center', paddingHorizontal: 14 },
  pillText: { fontSize: 14, lineHeight: 21 },
  track: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 10, flexDirection: 'row', gap: 2, padding: 3 },
  wrap: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', marginHorizontal: -16, paddingHorizontal: 16, paddingVertical: 12 },
});
