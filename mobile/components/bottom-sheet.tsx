import X from 'lucide-react-native/icons/x';
import type { PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMinionTheme } from '@/hooks/use-minion-theme';

export function BottomSheet({ children, onClose, open, title }: PropsWithChildren<{ onClose: () => void; open: boolean; title: string }>) {
  const insets = useSafeAreaInsets();
  const { fonts, theme } = useMinionTheme();

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="닫기" onPress={onClose} style={styles.backdrop} />
        <View accessibilityViewIsModal style={[styles.panel, { backgroundColor: theme.surface, paddingBottom: Math.max(insets.bottom, 18) }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <View style={styles.heading}>
            <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.display }]}>{title}</Text>
            <Pressable accessibilityLabel={`${title} 닫기`} hitSlop={8} onPress={onClose} style={styles.close}>
              <X color={theme.muted} size={22} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.58)' },
  panel: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '82%', paddingHorizontal: 18, paddingTop: 8 },
  handle: { alignSelf: 'center', borderRadius: 999, height: 4, marginBottom: 8, width: 40 },
  heading: { alignItems: 'center', flexDirection: 'row', minHeight: 48 },
  title: { flex: 1, fontSize: 20, letterSpacing: -0.5 },
  close: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
});
