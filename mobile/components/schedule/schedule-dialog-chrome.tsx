import X from 'lucide-react-native/icons/x';
import type { PropsWithChildren } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

/** 웹 components/responsive/adaptive-dialog.tsx의 모바일 시트(rounded-t-24, 56px 헤더, 44px 닫기)를 그대로 옮긴 공용 껍데기. */
export function ScheduleDialogChrome({ children, compactTitle = false, onClose, open, title }: PropsWithChildren<{ compactTitle?: boolean; onClose: () => void; open: boolean; title: string }>) {
  const { colorScheme, fonts, theme } = useMinionTheme();

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="닫기" onPress={onClose} style={[styles.backdrop, { backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.45)' }]} />
        <View style={[styles.panel, { backgroundColor: theme.surface }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text numberOfLines={1} style={[styles.title, compactTitle && styles.compactTitle, { color: theme.ink, fontFamily: fonts.black }]}>{title}</Text>
            <Pressable accessibilityLabel="닫기" hitSlop={8} onPress={onClose} style={styles.closeButton}>
              <X color={theme.muted} size={21} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} style={styles.scroll}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
  body: { padding: 16 },
  closeButton: { alignItems: 'center', borderRadius: 12, height: 44, justifyContent: 'center', width: 44 },
  compactTitle: { fontSize: 16, lineHeight: 24 },
  header: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', minHeight: 56, paddingHorizontal: 16 },
  panel: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', overflow: 'hidden', width: '100%' },
  root: { flex: 1, justifyContent: 'flex-end' },
  // panel은 height가 아니라 maxHeight만 갖고 있어서, flex:1(flexBasis:0)을 쓰면 내용 기반 크기 산정이 무너져
  // 시트가 헤더만 남고 찌그러진다. flexShrink만 줘서 "내용만큼 크되, maxHeight에 걸리면 줄어들며 스크롤"이 되게 한다.
  scroll: { flexShrink: 1 },
  title: { flex: 1, fontSize: 17, letterSpacing: -0.34, lineHeight: 25.5 },
});
