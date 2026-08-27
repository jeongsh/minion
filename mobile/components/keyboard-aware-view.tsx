import type { ReactNode } from 'react';
import { KeyboardAvoidingView, type KeyboardAvoidingViewProps } from 'react-native';

import { useKeyboardLayout, type KeyboardLayoutState } from '@/hooks/use-keyboard-layout';

type KeyboardAwareViewProps = Omit<KeyboardAvoidingViewProps, 'behavior' | 'children' | 'enabled'> & {
  children: ReactNode | ((state: KeyboardLayoutState) => ReactNode);
  minimumBottomInset?: number;
};

export function KeyboardAwareView({ children, minimumBottomInset = 0, ...props }: KeyboardAwareViewProps) {
  const state = useKeyboardLayout(minimumBottomInset);

  return (
    <KeyboardAvoidingView {...props} behavior={state.behavior} enabled={state.keyboardVisible}>
      {typeof children === 'function' ? children(state) : children}
    </KeyboardAvoidingView>
  );
}
