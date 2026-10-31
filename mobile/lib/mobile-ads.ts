import type * as MobileAdsSdk from 'react-native-google-mobile-ads';

export type MobileAdsState = { ready: boolean; privacyOptionsRequired: boolean; revision: number; retryAt: number | null };
const state: MobileAdsState = { ready: false, privacyOptionsRequired: false, revision: 0, retryAt: null };
export const getMobileAdsSdk = (): typeof MobileAdsSdk | null => null;
export const getMobileAdsState = () => state;
export const subscribeMobileAds = (_listener: () => void) => () => {};
export const initializeMobileAds = async () => {};
export const showAdsPrivacyOptions = async () => {};
