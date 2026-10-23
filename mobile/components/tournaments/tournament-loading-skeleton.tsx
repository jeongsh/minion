import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

function Bone({ style }: { style?: StyleProp<ViewStyle> }) {
  const { theme } = useMinionTheme();
  return <View style={[styles.bone, { backgroundColor: theme.surfaceMuted }, style]} />;
}

export function TournamentLoadingSkeleton() {
  const { theme } = useMinionTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { duration: 850, easing: Easing.inOut(Easing.ease), toValue: 0.9, useNativeDriver: true }),
        Animated.timing(opacity, { duration: 850, easing: Easing.inOut(Easing.ease), toValue: 0.5, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View accessibilityLabel="대회 정보 불러오는 중" accessibilityRole="progressbar" accessibilityState={{ busy: true }} style={[styles.root, { opacity }]}>
      <Bone style={{ height: 28, maxWidth: '100%', width: 240 }} />
      <View style={[styles.bracket, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.rounds}>
          {[4, 2, 1].map((count, round) => (
            <View key={round} style={styles.round}>
              <Bone style={{ height: 20, width: 96 }} />
              <View style={styles.matches}>
                {Array.from({ length: count }, (_, match) => (
                  <View key={match} style={[styles.match, { backgroundColor: theme.surface }]}>
                    <Bone style={{ height: 12, marginBottom: 12, width: 96 }} />
                    <View style={styles.teams}>
                      {[0, 1].map(team => (
                        <View key={team} style={styles.team}>
                          <Bone style={styles.logo} />
                          <Bone style={{ height: 16, width: 80 }} />
                          <Bone style={{ height: 16, marginLeft: 'auto', width: 16 }} />
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bone: { borderRadius: 6 },
  bracket: { borderRadius: 8, borderWidth: 1, overflow: 'hidden', padding: 16 },
  logo: { borderRadius: 12, flexShrink: 0, height: 24, width: 24 },
  match: { borderRadius: 8, padding: 12 },
  matches: { flex: 1, gap: 16, justifyContent: 'space-around' },
  root: { gap: 16 },
  round: { flexShrink: 0, gap: 16, width: 216 },
  rounds: { flexDirection: 'row', gap: 24 },
  team: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  teams: { gap: 8 },
});
