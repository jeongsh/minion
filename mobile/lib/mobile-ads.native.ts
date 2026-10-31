import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform, TurboModuleRegistry } from 'react-native';
import type * as MobileAdsSdk from 'react-native-google-mobile-ads';

import { MOBILE_ADS_ENABLED } from '@/constants/mobile-ads';

export type MobileAdsState = { ready: boolean; privacyOptionsRequired: boolean; revision: number; retryAt: number | null };
let state: MobileAdsState = { ready: false, privacyOptionsRequired: false, revision: 0, retryAt: null };
let sdk: typeof MobileAdsSdk | null = null;
let initialization: Promise<void> | null = null;
let privacyUpdate: Promise<void> | null = null;
let initialized = false;
let nextAttemptAt = 0;
const CONSENT_RETRY_MS = 60_000;
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
  // Log eligibility, never the TC string, user choices or device identifiers.
  console.info('[ads] consent checked', { status: info.status, canRequestAds: info.canRequestAds, privacyOptions: info.privacyOptionsRequirementStatus });
  publish({ privacyOptionsRequired: info.privacyOptionsRequirementStatus === ads.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED });
  if (!info.canRequestAds) { publish({ ready: false }); return false; }
  if (!initialized) {
    await ads.default().initialize();
    initialized = true;
  }
  // Android throws a fatal native exception if muted before initialization.
  await ads.default().setAppMuted(true);
  publish({ ready: true, retryAt: null, revision: state.revision + 1 });
  return true;
}

function reportConsentError(stage: string, error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
  console.warn('[ads] consent failed', { stage, code });
}

export function initializeMobileAds(): Promise<void> {
  // A privacy form owns eligibility until it closes; never load with stale consent.
  if (privacyUpdate) return privacyUpdate.catch(() => {});
  if (initialization) return initialization;
  if (state.ready || Date.now() < nextAttemptAt) return Promise.resolve();
  const ads = getMobileAdsSdk();
  if (!ads) return Promise.resolve();
  nextAttemptAt = Date.now() + CONSENT_RETRY_MS;
  const operation = (async () => {
    let updateFailed = false;
    try { await ads.AdsConsent.gatherConsent(); }
    catch (error) { updateFailed = true; reportConsentError('update', error); }
    // UMP may permit requests using consent retained from the previous session.
    const ready = await applyConsent();
    // Retry transient errors, but never repeatedly reopen a successfully dismissed form.
    if (!ready) publish({ retryAt: updateFailed ? Date.now() + CONSENT_RETRY_MS : null });
  })().catch((error) => {
    publish({ ready: false, retryAt: Date.now() + CONSENT_RETRY_MS });
    reportConsentError('initialize', error);
  }).finally(() => {
    // Cache in-flight work only. An ineligible/failed attempt must be recoverable.
    if (initialization === operation) initialization = null;
  });
  initialization = operation;
  return operation;
}

export function showAdsPrivacyOptions(): Promise<void> {
  if (privacyUpdate) return privacyUpdate;
  const ads = getMobileAdsSdk();
  if (!ads || !state.privacyOptionsRequired) return Promise.resolve();
  const pendingInitialization = initialization;
  const operation = (async () => {
    await pendingInitialization;
    publish({ ready: false, retryAt: null });
    try { await ads.AdsConsent.showPrivacyOptionsForm(); }
    finally {
      try { await applyConsent(); }
      catch (error) {
        publish({ ready: false, retryAt: Date.now() + CONSENT_RETRY_MS });
        reportConsentError('privacy-options', error);
        throw error;
      }
    }
  })().finally(() => { if (privacyUpdate === operation) privacyUpdate = null; });
  privacyUpdate = operation;
  return operation;
}
