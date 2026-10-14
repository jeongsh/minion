import { useRouter } from 'expo-router';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

export function HomeSectionHeading({ action, href, title }: { action?: () => void; href?: string; title: string }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  return <View style={styles.row}><Text accessibilityRole="header" style={{ color: theme.ink, ...fonts.display, fontSize: 20, lineHeight: 28 }}>{title}</Text>{action || href ? <Pressable accessibilityRole="link" onPress={action ?? (() => router.navigate(href as never))} style={styles.action}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>전체보기</Text><ChevronRight color={theme.muted} size={16} /></Pressable> : null}</View>;
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 12 }, action: { flexDirection: 'row', alignItems: 'center', minHeight: 44 } });
