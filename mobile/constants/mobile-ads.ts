// AdMob IDs are public identifiers. Only Android has a registered production app.
export const ANDROID_BANNER_AD_UNIT_ID = 'ca-app-pub-7060554754100656/3660217360';
// Separate inventory and reporting for each home placement. All units use
// AdMob's automatic refresh; do not add an application-level reload timer.
const HOME_BANNER_AD_UNIT_IDS: Record<string, string> = {
  'home-top': 'ca-app-pub-7060554754100656/3853965509',
  'home-teams': 'ca-app-pub-7060554754100656/7433730826',
  'home-insights': 'ca-app-pub-7060554754100656/2000781602',
};
export const getAndroidBannerAdUnitId = (placement: string): string =>
  HOME_BANNER_AD_UNIT_IDS[placement] ?? ANDROID_BANNER_AD_UNIT_ID;
export const MOBILE_ADS_ENABLED = process.env.EXPO_PUBLIC_ADMOB_ENABLED !== 'false';
export const MOBILE_ADS_TEST_MODE = __DEV__ || process.env.EXPO_PUBLIC_ADMOB_TEST_ADS === 'true';
