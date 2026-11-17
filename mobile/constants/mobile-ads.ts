// AdMob IDs are public identifiers. App IDs are configured per platform in app.json.
export const ANDROID_BANNER_AD_UNIT_ID = 'ca-app-pub-7060554754100656/3660217360';
export const IOS_BANNER_AD_UNIT_ID = 'ca-app-pub-7060554754100656/4562002358';
// Separate home inventory and reporting by platform and placement. All units
// use AdMob's automatic refresh; do not add an application-level reload timer.
const ANDROID_HOME_BANNER_AD_UNIT_IDS: Record<string, string> = {
  'home-top': 'ca-app-pub-7060554754100656/3853965509',
  'home-teams': 'ca-app-pub-7060554754100656/7433730826',
  'home-insights': 'ca-app-pub-7060554754100656/2000781602',
};
const IOS_HOME_BANNER_AD_UNIT_IDS: Record<string, string> = {
  'home-top': 'ca-app-pub-7060554754100656/4036047885',
  'home-teams': 'ca-app-pub-7060554754100656/7400577823',
  'home-insights': 'ca-app-pub-7060554754100656/8905231189',
};
export const getMobileBannerAdUnitId = (platform: 'android' | 'ios', placement: string): string => {
  if (platform === 'ios') return IOS_HOME_BANNER_AD_UNIT_IDS[placement] ?? IOS_BANNER_AD_UNIT_ID;
  return ANDROID_HOME_BANNER_AD_UNIT_IDS[placement] ?? ANDROID_BANNER_AD_UNIT_ID;
};
export const MOBILE_ADS_ENABLED = process.env.EXPO_PUBLIC_ADMOB_ENABLED !== 'false';
export const MOBILE_ADS_TEST_MODE = __DEV__ || process.env.EXPO_PUBLIC_ADMOB_TEST_ADS === 'true';
