// AdMob IDs are public identifiers. Only Android has a registered production app.
export const ANDROID_BANNER_AD_UNIT_ID = 'ca-app-pub-7060554754100656/3660217360';
export const MOBILE_ADS_ENABLED = process.env.EXPO_PUBLIC_ADMOB_ENABLED !== 'false';
export const MOBILE_ADS_TEST_MODE = __DEV__ || process.env.EXPO_PUBLIC_ADMOB_TEST_ADS === 'true';
