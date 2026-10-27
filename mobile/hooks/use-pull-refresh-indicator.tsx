import { useCallback, useRef } from 'react';
import { ActivityIndicator, Animated, type NativeScrollEvent, type NativeSyntheticEvent, Platform } from 'react-native';

/** Follow the empty space exposed by iOS overscroll, without moving content. */
export function usePullRefreshIndicator(refreshing: boolean, top: number, color: string) {
  const distance = useRef(new Animated.Value(0)).current;
  const onPullScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (Platform.OS === 'ios') distance.setValue(Math.max(0, -event.nativeEvent.contentOffset.y));
  }, [distance]);
  const indicator = Platform.OS === 'ios' ? <Animated.View
    pointerEvents="none"
    accessibilityElementsHidden={!refreshing}
    style={{
      position: 'absolute', left: 0, right: 0, top, zIndex: 40,
      alignItems: 'center', justifyContent: 'center',
      height: distance.interpolate({ inputRange: [0, 72, 10000], outputRange: [72, 72, 10000], extrapolate: 'clamp' }),
      opacity: refreshing ? 1 : distance.interpolate({ inputRange: [0, 24, 72], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    }}>
    <ActivityIndicator accessibilityLabel="새로고침 중" color={color} size="large" />
  </Animated.View> : null;
  return { onPullScroll, indicator };
}
