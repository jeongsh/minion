import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileMatchSetSummary } from '@/lib/api-client';

/**
 * 웹의 SetSelector는 position:sticky이지만, 앱은 스크롤 컨테이너가 잠금 파일(minion-screen.tsx)
 * 안에 있어 sticky header를 노출하지 않는다. 일정 화면 주간 탭과 동일하게 이미 안내된 제약이다.
 * 세트가 1개(BO1)여도 웹처럼 알약을 그대로 보여준다(TournamentSegmentedControl은 1개일 때
 * 숨기므로 재사용하지 않음).
 */
export function MatchSetSelector({ activeSetId, onSelect, sets }: { activeSetId: string; onSelect: (setId: string) => void; sets: MobileMatchSetSummary[] }) {
  const { fonts, theme } = useMinionTheme();
  if (sets.length === 0) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: theme.pageBackground, borderBottomColor: theme.border }]}>
      <View style={[styles.track, { backgroundColor: theme.card }]}>
        {sets.map((set) => {
          const active = set.id === activeSetId;
          return (
            <Pressable
              key={set.id}
              onPress={() => onSelect(set.id)}
              style={[styles.pill, active && { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
            >
              <Text style={[styles.pillText, { color: active ? theme.ink : theme.muted, fontFamily: active ? fonts.black : fonts.bold }]}>{set.setNumber}세트</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignItems: 'center', borderRadius: 8, height: 32, justifyContent: 'center', paddingHorizontal: 14 },
  pillText: { fontSize: 13, lineHeight: 19.5 },
  track: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 10, flexDirection: 'row', gap: 2, padding: 3 },
  wrap: { borderBottomWidth: 1, marginHorizontal: -16, paddingHorizontal: 16, paddingVertical: 4 },
});
