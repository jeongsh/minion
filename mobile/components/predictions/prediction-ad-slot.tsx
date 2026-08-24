import { StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

/** 앱에는 AdSense가 없어서, 웹 광고 자리를 홈 화면과 동일한 플레이스홀더로 대신한다. */
export function PredictionAdSlot() {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={[styles.ad, { backgroundColor: theme.adSurface }]}>
      <Text style={[styles.text, { fontFamily: fonts.medium }]}>ADVERTISEMENT</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ad: { alignItems: 'center', borderRadius: 16, height: 100, justifyContent: 'center' },
  text: { color: '#96999f', fontSize: 11, letterSpacing: 1.98 },
});
