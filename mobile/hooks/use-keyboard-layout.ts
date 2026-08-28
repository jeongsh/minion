import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type KeyboardLayoutState = {
  behavior: 'padding' | undefined;
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
    // Android는 기본 windowSoftInputMode가 이미 "resize"라 창 자체가 키보드만큼 줄어든다.
    // 여기서 또 'height'로 RN이 한 번 더 줄이면 이중 보정이 되어 키보드가 실제보다 떠
    // 보이고 그 아래에 빈 공간이 남는다. Android는 behavior 없이 네이티브 리사이즈만 쓴다.
    behavior: Platform.OS === 'ios' ? 'padding' : undefined,
    bottomInset: keyboardVisible ? minimumBottomInset : Math.max(insets.bottom, minimumBottomInset),
    keyboardVisible,
  };
}
