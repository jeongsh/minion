import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { BannerAd as BannerAdHandle } from 'react-native-google-mobile-ads';

import { ANDROID_BANNER_AD_UNIT_ID, MOBILE_ADS_TEST_MODE } from '@/constants/mobile-ads';
import { useKeyboardLayout } from '@/hooks/use-keyboard-layout';
import { bannerRetryDelay, recordBannerFailure } from '@/lib/ad-banner-policy';
import { getMobileAdsSdk, getMobileAdsState, initializeMobileAds, subscribeMobileAds } from '@/lib/mobile-ads';

const REQUEST_OPTIONS = { requestNonPersonalizedAdsOnly: true };
const AD_HEIGHT = 100;

type Props = { enabled?: boolean; suspended?: boolean; placement: string; style?: StyleProp<ViewStyle> };

export function ContentBanner({ enabled = true, suspended = false, placement, style }: Props) {
  const focused = useIsFocused();
  const { keyboardVisible } = useKeyboardLayout();
  const state = useSyncExternalStore(subscribeMobileAds, getMobileAdsState, getMobileAdsState);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [width, setWidth] = useState(0);
  const ads = getMobileAdsSdk();
  const active = enabled && focused && foreground && !keyboardVisible && !suspended;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => setForeground(next === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (active) void initializeMobileAds();
  }, [active]);

  if (!enabled || !ads) return null;
  // Reserve the same space before consent, loading, errors and successful loads.
  // Screen position must never change this slot's height or hide its creative.
  return <View onLayout={event => setWidth(Math.floor(event.nativeEvent.layout.width))} style={[styles.slot, style]}>
    {state.ready && width >= 320 ? <BannerSession key={`${state.revision}:${width}:${placement}`} active={active} ads={ads} placement={placement} width={width} /> : null}
  </View>;
}

function BannerSession({ active, ads, placement, width }: { active: boolean; ads: NonNullable<ReturnType<typeof getMobileAdsSdk>>; placement: string; width: number }) {
  const banner = useRef<BannerAdHandle>(null);
  const retries = useRef(0);
  const [started, setStarted] = useState(false);
  const [failure, setFailure] = useState<{ code: string; at: number } | null>(null);
  useEffect(() => { if (active) setStarted(true); }, [active]);
  useEffect(() => {
    if (!active || !failure) return;
    const delay = bannerRetryDelay(failure.code, retries.current);
    if (delay == null) return;
    const timer = setTimeout(() => {
      if (!banner.current) return;
      retries.current += 1;
      setFailure(null);
      banner.current.load();
    }, Math.max(0, failure.at + delay - Date.now()));
    return () => clearTimeout(timer);
  }, [active, failure]);

  if (!started) return null;
  const BannerAd = ads.BannerAd;
  // Keep the loaded native view mounted through scrolling, sheets and app focus.
  // The SDK owns successful-ad refresh. JS only retries transient failures twice.
  return <View pointerEvents={active ? 'auto' : 'none'} style={styles.creative}>
    <BannerAd ref={banner} size={ads.BannerAdSize.INLINE_ADAPTIVE_BANNER} width={width} maxHeight={AD_HEIGHT}
      unitId={MOBILE_ADS_TEST_MODE ? ads.TestIds.BANNER : ANDROID_BANNER_AD_UNIT_ID} requestOptions={REQUEST_OPTIONS}
      onAdLoaded={() => setFailure(null)}
      onAdFailedToLoad={error => {
        const code = recordBannerFailure(placement, error, retries.current);
        setFailure({ code, at: Date.now() });
      }} />
  </View>;
}

const styles = StyleSheet.create({
  slot: { alignItems: 'center', alignSelf: 'stretch', height: AD_HEIGHT, marginVertical: 24, justifyContent: 'center' },
  creative: { alignItems: 'center', justifyContent: 'center', height: AD_HEIGHT },
});
