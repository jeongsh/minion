import EyeOff from 'lucide-react-native/icons/eye-off';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import { useSpoilerFree } from '@/providers/spoiler-free-provider';

export function MatchSpoilerGate({
  children,
  finished,
  matchId,
  teamALabel,
  teamBLabel,
}: {
  children: ReactNode;
  finished: boolean;
  matchId: string;
  teamALabel: string;
  teamBLabel: string;
}) {
  const { fonts, theme } = useMinionTheme();
  const { enabled, isRevealed, reveal } = useSpoilerFree();
  const spoiled = enabled && finished && !isRevealed(matchId);

  if (!spoiled) {
    return <>{children}</>;
  }

  return (
    <View style={[styles.blind, { backgroundColor: theme.surfaceMuted }]}>
      <EyeOff color={theme.muted} size={28} strokeWidth={1.6} />
      <Text style={[styles.blindTitle, { color: theme.ink, ...fonts.bold }]}>이 경기 결과가 가려져 있어요</Text>
      <Text style={[styles.blindSubtitle, { color: theme.muted, ...fonts.regular }]}>{teamALabel} vs {teamBLabel}</Text>
      <Pressable onPress={() => reveal(matchId)} style={[styles.reveal, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={{ color: theme.text, ...fonts.bold, fontSize: 14 }}>결과 보기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  blind: { alignItems: 'center', borderRadius: 16, gap: 10, paddingHorizontal: 24, paddingVertical: 56 },
  blindSubtitle: { fontSize: 13, lineHeight: 19.5, marginTop: -4, textAlign: 'center' },
  blindTitle: { fontSize: 16, textAlign: 'center' },
  reveal: { borderRadius: 8, borderWidth: 1, marginTop: 4, paddingHorizontal: 16, paddingVertical: 10 },
});
