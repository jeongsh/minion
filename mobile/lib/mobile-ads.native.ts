import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform, TurboModuleRegistry } from 'react-native';
import type * as MobileAdsSdk from 'react-native-google-mobile-ads';

import { MOBILE_ADS_ENABLED } from '@/constants/mobile-ads';

export type MobileAdsState = { ready: boolean; privacyOptionsRequired: boolean; revision: number };
let state: MobileAdsState = { ready: false, privacyOptionsRequired: false, revision: 0 };
let sdk: typeof MobileAdsSdk | null = null;
let initialization: Promise<void> | null = null;
let initialized = false;
const listeners = new Set<() => void>();
const publish = (next: Partial<MobileAdsState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

export function getMobileAdsSdk(): typeof MobileAdsSdk | null {
  if (!MOBILE_ADS_ENABLED || Platform.OS !== 'android' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  if (!TurboModuleRegistry.get('RNGoogleMobileAdsModule')) return null;
  // Keep Expo Go and old installed binaries usable until the native SDK is rebuilt.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sdk ??= require('react-native-google-mobile-ads') as typeof MobileAdsSdk;
  return sdk;
}

export const getMobileAdsState = () => state;
export function subscribeMobileAds(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

async function applyConsent() {
  const ads = getMobileAdsSdk();
  if (!ads) return;
  const info = await ads.AdsConsent.getConsentInfo();
  publish({ privacyOptionsRequired: info.privacyOptionsRequirementStatus === ads.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED });
  if (!info.canRequestAds) { publish({ ready: false }); return; }
  if (!initialized) {
    await ads.default().setAppMuted(true);
    await ads.default().initialize();
    initialized = true;
  }
  publish({ ready: true, revision: state.revision + 1 });
}

export function initializeMobileAds(): Promise<void> {
  if (initialization) return initialization;
  const ads = getMobileAdsSdk();
  if (!ads) return Promise.resolve();
  initialization = (async () => {
    try { await ads.AdsConsent.gatherConsent(); }
    catch (error) { if (__DEV__) console.warn('[ads] consent update failed', error); }
    // UMP may permit requests using consent retained from the previous session.
    await applyConsent();
  })().catch((error) => {
    publish({ ready: false });
    initialization = null;
    if (__DEV__) console.warn('[ads] initialization failed', error);
  });
  return initialization;
}

export async function showAdsPrivacyOptions() {
  const ads = getMobileAdsSdk();
  if (!ads || !state.privacyOptionsRequired) return;
  publish({ ready: false });
  try { await ads.AdsConsent.showPrivacyOptionsForm(); }
  finally { await applyConsent(); }
}
