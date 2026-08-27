import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type KeyboardLayoutState = {
  behavior: 'height' | 'padding';
  bottomInset: number;
  keyboardVisible: boolean;
};

export function useKeyboardLayout(minimumBottomInset = 0): KeyboardLayoutState {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible());

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

  return {
    behavior: Platform.OS === 'ios' ? 'padding' : 'height',
    bottomInset: keyboardVisible ? minimumBottomInset : Math.max(insets.bottom, minimumBottomInset),
    keyboardVisible,
  };
}
