import { useRouter } from 'expo-router';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

export function HomeSectionHeading({ action, href, title }: { action?: () => void; href?: string; title: string }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  // 웹 globals.css: 640px 미만 홈은 제목 18px, 전체보기 터치 영역(44px)이 줄 높이를 늘리지 않게 위아래 -8.5px.
  const compact = useWindowDimensions().width < 640;
  return <View style={styles.row}><Text accessibilityRole="header" style={{ color: theme.ink, ...fonts.display, fontSize: compact ? 18 : 20, lineHeight: compact ? 24 : 28 }}>{title}</Text>{action || href ? <Pressable accessibilityRole="link" onPress={action ?? (() => router.navigate(href as never))} style={[styles.action, compact && styles.actionCompact]}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>전체보기</Text><ChevronRight color={theme.muted} size={16} /></Pressable> : null}</View>;
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 12 }, action: { flexDirection: 'row', alignItems: 'center', minHeight: 44 }, actionCompact: { marginVertical: -8.5 } });
