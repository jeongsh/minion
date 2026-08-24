import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useMinionTheme } from '@/hooks/use-minion-theme';
export default function AuthCallbackScreen() { const { fonts, theme } = useMinionTheme(); return <View style={[styles.root, { backgroundColor: theme.pageBackground }]}><ActivityIndicator color={theme.accent} size="large" /><Text style={{ color: theme.text, fontFamily: fonts.medium }}>로그인을 마무리하고 있습니다…</Text></View>; }
const styles = StyleSheet.create({ root: { alignItems: 'center', flex: 1, gap: 14, justifyContent: 'center' } });
