import X from 'lucide-react-native/icons/x';
import type { PropsWithChildren } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMinionTheme } from '@/hooks/use-minion-theme';

type BottomSheetProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  maxHeight?: DimensionValue;
  onClose: () => void;
  open: boolean;
  panelStyle?: StyleProp<ViewStyle>;
  scrollViewProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;
  scrollable?: boolean;
  title: string;
}>;

export function BottomSheetHandle() {
  const { theme } = useMinionTheme();
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.handle, { backgroundColor: theme.border }]} />;
}

export function BottomSheet({
  children,
  contentStyle,
  maxHeight = '82%',
  onClose,
  open,
  panelStyle,
  scrollViewProps,
  scrollable = false,
  title,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { fonts, theme } = useMinionTheme();

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="닫기" onPress={onClose} style={styles.backdrop} />
        <View accessibilityViewIsModal style={[styles.panel, { backgroundColor: theme.surface, maxHeight, paddingBottom: Math.max(insets.bottom, 18) }, panelStyle]}>
          <BottomSheetHandle />
          <View style={styles.heading}>
            <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.display }]}>{title}</Text>
            <Pressable accessibilityLabel={`${title} 닫기`} hitSlop={8} onPress={onClose} style={styles.close}>
              <X color={theme.muted} size={22} />
            </Pressable>
          </View>
          {scrollable ? (
            <ScrollView
              {...scrollViewProps}
              contentContainerStyle={[styles.body, contentStyle]}
              showsVerticalScrollIndicator={scrollViewProps?.showsVerticalScrollIndicator ?? false}
              style={[styles.scroll, scrollViewProps?.style]}>
              {children}
            </ScrollView>
          ) : <View style={[styles.body, contentStyle]}>{children}</View>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.58)' },
  panel: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', paddingTop: 8, width: '100%' },
  handle: { alignSelf: 'center', borderRadius: 999, height: 4, marginBottom: 8, width: 40 },
  heading: { alignItems: 'center', flexDirection: 'row', minHeight: 48, paddingHorizontal: 18 },
  title: { flex: 1, fontSize: 16, letterSpacing: -0.35 },
  close: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  body: { paddingHorizontal: 18 },
  scroll: { flexShrink: 1 },
});
