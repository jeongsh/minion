import X from 'lucide-react-native/icons/x';
import { useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
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
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMinionTheme } from '@/hooks/use-minion-theme';

type BottomSheetProps = PropsWithChildren<{
  actions?: ReactNode;
  backdropColor?: string;
  contentStyle?: StyleProp<ViewStyle>;
  headingStyle?: StyleProp<ViewStyle>;
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
  actions,
  backdropColor = 'rgba(0,0,0,0.58)',
  children,
  contentStyle,
  headingStyle,
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
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={open}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} enabled={keyboardVisible} style={styles.root}>
        <Pressable accessibilityLabel="닫기" onPress={onClose} style={[styles.backdrop, { backgroundColor: backdropColor }]} />
        <View accessibilityViewIsModal style={[styles.panel, { backgroundColor: theme.surface, maxHeight, paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 18) }, panelStyle]}>
          <BottomSheetHandle />
          <View style={[styles.heading, headingStyle]}>
            <Text style={[styles.title, { color: theme.ink, ...fonts.display }]}>{title}</Text>
            {actions ? <View style={styles.actions}>{actions}</View> : null}
            <Pressable accessibilityLabel={`${title} 닫기`} hitSlop={8} onPress={onClose} style={styles.close}>
              <X color={theme.muted} size={22} />
            </Pressable>
          </View>
          {scrollable ? (
            <ScrollView
              {...scrollViewProps}
              contentContainerStyle={[styles.body, contentStyle]}
              keyboardDismissMode={scrollViewProps?.keyboardDismissMode ?? (Platform.OS === 'ios' ? 'interactive' : 'on-drag')}
              keyboardShouldPersistTaps={scrollViewProps?.keyboardShouldPersistTaps ?? 'handled'}
              showsVerticalScrollIndicator={scrollViewProps?.showsVerticalScrollIndicator ?? false}
              style={[styles.scroll, scrollViewProps?.style]}>
              {children}
            </ScrollView>
          ) : <View style={[styles.body, contentStyle]}>{children}</View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  panel: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', paddingTop: 8, width: '100%' },
  handle: { alignSelf: 'center', borderRadius: 999, height: 4, marginBottom: 8, width: 40 },
  heading: { alignItems: 'center', flexDirection: 'row', minHeight: 48, paddingHorizontal: 18 },
  title: { flex: 1, fontSize: 16, letterSpacing: -0.35 },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 2 },
  close: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  body: { paddingHorizontal: 18 },
  scroll: { flexShrink: 1 },
});
