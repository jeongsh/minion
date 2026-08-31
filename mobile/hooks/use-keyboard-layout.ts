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
    // Android의 시스템 resize가 edge-to-edge나 Expo Go 조합에서 전달되지 않아도
    // 하단 입력 UI가 가려지지 않게 공용 뷰가 실제 키보드 겹침만큼 높이를 줄인다.
    // 공용 회피 뷰는 이미 줄어든 창에서는 겹침을 0으로 계산하므로 이중 보정하지 않는다.
    behavior: Platform.OS === 'ios' ? 'padding' : 'height',
    bottomInset: keyboardVisible ? minimumBottomInset : Math.max(insets.bottom, minimumBottomInset),
    keyboardVisible,
  };
}
