import X from 'lucide-react-native/icons/x';
import { useEffect, type PropsWithChildren, type ReactNode } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type ScrollViewProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { SafeAreaProvider, useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAwareView } from '@/components/keyboard-aware-view';
import { useMinionTheme } from '@/hooks/use-minion-theme';

type BottomSheetProps = PropsWithChildren<{
  actions?: ReactNode;
  backdropColor?: string;
  contentStyle?: StyleProp<ViewStyle>;
  dismissible?: boolean;
  footer?: ReactNode;
  headingStyle?: StyleProp<ViewStyle>;
  maxHeight?: DimensionValue;
  onClose: () => void;
  open: boolean;
  panelStyle?: StyleProp<ViewStyle>;
  placement?: 'bottom' | 'center';
  scrollViewProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;
  scrollable?: boolean;
  showHandle?: boolean;
  title: string;
  titleStyle?: StyleProp<TextStyle>;
}>;

export function BottomSheetHandle() {
  const { theme } = useMinionTheme();
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.handle, { backgroundColor: theme.border }]} />;
}

export function BottomSheet(props: BottomSheetProps) {
  useEffect(() => { if (!props.open) Keyboard.dismiss(); }, [props.open]);
  const close = () => { Keyboard.dismiss(); props.onClose(); };
  return (
    <Modal animationType="fade" navigationBarTranslucent statusBarTranslucent onRequestClose={props.dismissible === false ? Keyboard.dismiss : close} transparent visible={props.open}>
      <SafeAreaProvider>
        <BottomSheetSurface {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}

function BottomSheetSurface({
  actions,
  backdropColor,
  children,
  contentStyle,
  dismissible = true,
  footer,
  headingStyle,
  maxHeight = '92%',
  onClose,
  panelStyle,
  placement = 'bottom',
  scrollViewProps,
  scrollable = true,
  showHandle = true,
  title,
  titleStyle,
}: BottomSheetProps) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const availableHeight = Math.max(0, frame.height - insets.top);
  const panelMaxHeight = typeof maxHeight === 'string' && maxHeight.endsWith('%')
    ? availableHeight * Number.parseFloat(maxHeight) / 100
    : maxHeight;

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  return (
      <KeyboardAwareView style={[styles.root, { paddingTop: insets.top }, placement === 'center' ? styles.centeredRoot : null]}>
        {({ bottomInset }) => <>
          <Pressable accessibilityLabel={dismissible ? '닫기' : undefined} accessibilityRole={dismissible ? 'button' : undefined} disabled={!dismissible} onPress={close} style={[styles.backdrop, { backgroundColor: backdropColor ?? (colorScheme === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.45)') }]} />
          <View accessibilityViewIsModal style={[styles.panel, placement === 'center' ? styles.centeredPanel : null, { backgroundColor: theme.surface }, panelStyle, { maxHeight: panelMaxHeight }]}>
            {showHandle ? <BottomSheetHandle /> : null}
            <View style={[styles.heading, headingStyle]}>
              <Text style={[styles.title, { color: theme.ink, ...fonts.display }, titleStyle]}>{title}</Text>
              {actions ? <View style={styles.actions}>{actions}</View> : null}
              {dismissible ? <Pressable accessibilityLabel={`${title} 닫기`} accessibilityRole="button" hitSlop={8} onPress={close} style={styles.close}><X color={theme.muted} size={18} /></Pressable> : null}
            </View>
            {scrollable ? (
              <ScrollView
                {...scrollViewProps}
                automaticallyAdjustContentInsets={false}
                contentInsetAdjustmentBehavior="never"
                contentContainerStyle={[styles.body, contentStyle]}
                keyboardDismissMode={scrollViewProps?.keyboardDismissMode ?? (Platform.OS === 'ios' ? 'interactive' : 'on-drag')}
                keyboardShouldPersistTaps={scrollViewProps?.keyboardShouldPersistTaps ?? 'handled'}
                showsVerticalScrollIndicator={scrollViewProps?.showsVerticalScrollIndicator ?? false}
                style={[styles.scroll, scrollViewProps?.style]}>
                {children}
              </ScrollView>
            ) : <View style={[styles.body, styles.scroll, contentStyle]}>{children}</View>}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
            {/* Keep the bottom gutter outside the shrinking scroll viewport. */}
            <View pointerEvents="none" style={{ height: 16 + bottomInset, flexShrink: 0 }} />
          </View>
        </>}
      </KeyboardAwareView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  centeredRoot: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  backdrop: { ...StyleSheet.absoluteFillObject },
  panel: { flexShrink: 1, minHeight: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', paddingTop: 8, width: '100%' },
  centeredPanel: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24, maxWidth: 390, paddingTop: 0 },
  handle: { alignSelf: 'center', borderRadius: 999, height: 4, marginBottom: 8, width: 40 },
  heading: { alignItems: 'center', flexDirection: 'row', flexShrink: 0, gap: 4, minHeight: 48, paddingHorizontal: 16 },
  title: { flex: 1, fontSize: 14, letterSpacing: -0.28, lineHeight: 24 },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 2 },
  close: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  body: { paddingHorizontal: 16, paddingTop: 8 },
  scroll: { flexShrink: 1, minHeight: 0 },
  footer: { flexShrink: 0, paddingHorizontal: 16, paddingTop: 8 },
});
