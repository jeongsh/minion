import { Image } from 'expo-image';
import Inbox from 'lucide-react-native/icons/inbox';
import LoaderCircle from 'lucide-react-native/icons/loader-circle';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

export function LoadingState({ label = '불러오는 중' }: { label?: string }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View accessibilityRole="progressbar" style={styles.state}>
      <ActivityIndicator color={theme.accent} size="small" />
      <Text style={[styles.body, { color: theme.muted, ...fonts.regular }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ description = '표시할 내용이 아직 없습니다.', title = '비어 있어요' }: { description?: string; title?: string }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={styles.state}>
      <Inbox color={theme.muted} size={30} strokeWidth={1.8} />
      <Text style={[styles.title, { color: theme.ink, ...fonts.bold }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.muted, ...fonts.regular }]}>{description}</Text>
    </View>
  );
}

export function ErrorState({ onRetry, title = '내용을 불러오지 못했습니다.' }: { onRetry?: () => void; title?: string }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View accessibilityRole="alert" style={styles.state}>
      <Image contentFit="contain" source={require('@/assets/characters/megapon-1.png')} style={styles.errorCharacter} />
      <Text style={[styles.title, { color: theme.ink, ...fonts.bold }]}>{title}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={[styles.retry, { borderColor: theme.border }]}>
          <RotateCcw color={theme.text} size={17} />
          <Text style={{ color: theme.text, ...fonts.bold, fontSize: 14 }}>다시 시도</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function LoadingSkeleton() {
  const { theme } = useMinionTheme();
  return (
    <View accessibilityLabel="콘텐츠 불러오는 중" style={styles.skeletonWrap}>
      <LoaderCircle color={theme.accent} size={20} />
      <View style={[styles.skeletonLine, { backgroundColor: theme.surfaceMuted, width: '62%' }]} />
      <View style={[styles.skeletonLine, { backgroundColor: theme.surfaceMuted, width: '88%' }]} />
      <View style={[styles.skeletonBlock, { backgroundColor: theme.card }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', gap: 9, justifyContent: 'center', minHeight: 180, paddingHorizontal: 24 },
  title: { fontSize: 16, marginTop: 3, textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  errorCharacter: { height: 112, width: 112 },
  retry: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 7, marginTop: 6, minHeight: 44, paddingHorizontal: 16 },
  skeletonWrap: { gap: 12, minHeight: 180, paddingVertical: 18 },
  skeletonLine: { borderRadius: 6, height: 14 },
  skeletonBlock: { borderRadius: 16, height: 104, marginTop: 5, width: '100%' },
});
