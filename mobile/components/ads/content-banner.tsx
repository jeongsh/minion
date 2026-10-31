import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { BannerAd as BannerAdHandle } from 'react-native-google-mobile-ads';

import { ANDROID_BANNER_AD_UNIT_ID, MOBILE_ADS_TEST_MODE } from '@/constants/mobile-ads';
import { useKeyboardLayout } from '@/hooks/use-keyboard-layout';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { bannerRetryDelay, recordBannerFailure } from '@/lib/ad-banner-policy';
import { getMobileAdsSdk, getMobileAdsState, initializeMobileAds, subscribeMobileAds } from '@/lib/mobile-ads';

const REQUEST_OPTIONS = { requestNonPersonalizedAdsOnly: true };
const PLACEHOLDER_HEIGHT = 100;
type BannerDimensions = { width: number; height: number };

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
  // Keep measurement independent of the creative; its height follows SDK events.
  return <View onLayout={event => setWidth(Math.floor(event.nativeEvent.layout.width))} style={[styles.slot, style]}>
    {state.ready && width >= 320 ? <BannerSession key={`${state.revision}:${width}:${placement}`} active={active} ads={ads} placement={placement} width={width} /> : <BannerPlaceholder />}
  </View>;
}

function BannerSession({ active, ads, placement, width }: { active: boolean; ads: NonNullable<ReturnType<typeof getMobileAdsSdk>>; placement: string; width: number }) {
  const banner = useRef<BannerAdHandle>(null);
  const retries = useRef(0);
  const [started, setStarted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
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

  const updateSize = (dimensions: BannerDimensions) => {
    if (Number.isFinite(dimensions.width) && Number.isFinite(dimensions.height) && dimensions.width > 0 && dimensions.height > 0) {
      setHeight(Math.ceil(dimensions.height));
    }
  };

  if (!started) return <BannerPlaceholder />;
  const BannerAd = ads.BannerAd;
  // Keep the loaded native view mounted through scrolling, sheets and app focus.
  // The SDK owns successful-ad refresh. JS only retries transient failures twice.
  // v15.8.3 starts BaseAd at 0x0. Give its native parent a real width and use
  // the standard 320x100 size so initial layout does not depend on inline sizing.
  return <View pointerEvents={active ? 'auto' : 'none'} style={[styles.creative, { width, height: loaded && height !== null ? height : PLACEHOLDER_HEIGHT }]}>
    <BannerAd ref={banner} size={ads.BannerAdSize.LARGE_BANNER}
      unitId={MOBILE_ADS_TEST_MODE ? ads.TestIds.BANNER : ANDROID_BANNER_AD_UNIT_ID} requestOptions={REQUEST_OPTIONS}
      onAdLoaded={dimensions => {
        retries.current = 0;
        setFailure(null);
        updateSize(dimensions);
        setLoaded(true);
        console.info('[ads] banner loaded', { placement, ...dimensions });
      }}
      onSizeChange={updateSize}
      onAdImpression={() => console.info('[ads] banner impression', { placement })}
      onAdFailedToLoad={error => {
        const code = recordBannerFailure(placement, error, retries.current);
        setFailure({ code, at: Date.now() });
      }} />
    {!loaded || height === null ? <BannerPlaceholder overlay /> : null}
  </View>;
}

function BannerPlaceholder({ overlay = false }: { overlay?: boolean }) {
  const { fonts, theme } = useMinionTheme();
  return <View pointerEvents="none" style={[styles.placeholder, overlay ? StyleSheet.absoluteFillObject : { height: PLACEHOLDER_HEIGHT }, { backgroundColor: theme.surfaceMuted }]}>
    <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20 }}>광고영역</Text>
  </View>;
}

const styles = StyleSheet.create({
  slot: { alignItems: 'center', alignSelf: 'stretch', marginVertical: 12 },
  creative: { alignItems: 'center', justifyContent: 'center' },
  placeholder: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});
