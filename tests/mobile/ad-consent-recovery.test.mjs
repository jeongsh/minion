import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';

function runtime() {
  let now = 1000;
  const events = [];
  const info = { status: 'NOT_REQUIRED', canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED' };
  const controls = { gather: async () => {}, read: async () => info, initialize: async () => {}, mute: async () => {}, form: async () => {} };
  const sdk = {
    AdsConsentPrivacyOptionsRequirementStatus: { REQUIRED: 'REQUIRED' },
    AdsConsent: {
      gatherConsent: async () => { events.push('gather'); await controls.gather(); },
      getConsentInfo: async () => { events.push('read'); return controls.read(); },
      showPrivacyOptionsForm: async () => { events.push('form'); await controls.form(); },
    },
    default: () => ({
      initialize: async () => { events.push('initialize'); await controls.initialize(); },
      setAppMuted: async value => { assert.equal(value, true); events.push('mute'); await controls.mute(); },
    }),
  };
  const imports = {
    'expo-constants': { default: { executionEnvironment: 'standalone' }, ExecutionEnvironment: { StoreClient: 'storeClient' } },
    'react-native': { Platform: { OS: 'android' }, TurboModuleRegistry: { get: () => ({}) } },
    '@/constants/mobile-ads': { MOBILE_ADS_ENABLED: true },
    'react-native-google-mobile-ads': sdk,
  };
  class Clock extends Date { static now() { return now; } }
  const load = file => {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, require: name => { assert.ok(name in imports); return imports[name]; }, Date: Clock, console: { info() {}, warn() {} } });
    return exports;
  };
  return { ads: load('mobile/lib/mobile-ads.native.ts'), policy: load('mobile/lib/ad-banner-policy.ts'), info, controls, events, advance: ms => { now += ms; } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const count = (r, event) => r.events.filter(value => value === event).length;

test('all placements share one consent update and one SDK initialization', async () => {
  const r = runtime();
  const first = r.ads.initializeMobileAds();
  assert.equal(first, r.ads.initializeMobileAds());
  await first;
  await r.ads.initializeMobileAds();
  assert.equal(count(r, 'gather'), 1);
  assert.equal(count(r, 'initialize'), 1);
  assert.equal(r.ads.getMobileAdsState().ready, true);
  assert.ok(r.events.indexOf('read') < r.events.indexOf('initialize'));
  assert.ok(r.events.indexOf('initialize') < r.events.indexOf('mute'));
});

test('failed first consent update recovers after cooldown without restarting the app', async () => {
  const r = runtime();
  r.info.canRequestAds = false;
  r.controls.gather = async () => { throw new Error('offline'); };
  await r.ads.initializeMobileAds();
  assert.equal(r.ads.getMobileAdsState().ready, false);
  assert.equal(r.ads.getMobileAdsState().retryAt, 61000);
  assert.equal(count(r, 'initialize'), 0);
  await r.ads.initializeMobileAds();
  assert.equal(count(r, 'gather'), 1);
  r.advance(60000);
  r.controls.gather = async () => {};
  r.info.canRequestAds = true;
  await r.ads.initializeMobileAds();
  assert.equal(count(r, 'gather'), 2);
  assert.equal(r.ads.getMobileAdsState().ready, true);
  assert.equal(r.ads.getMobileAdsState().retryAt, null);
});

test('successful but ineligible consent is not cached permanently or automatically reprompted', async () => {
  const r = runtime();
  r.info.canRequestAds = false;
  await r.ads.initializeMobileAds();
  assert.equal(r.ads.getMobileAdsState().retryAt, null);
  assert.equal(count(r, 'initialize'), 0);
  r.advance(60000);
  r.info.canRequestAds = true;
  await r.ads.initializeMobileAds();
  assert.equal(r.ads.getMobileAdsState().ready, true);
});

test('UMP previous-session eligibility remains usable after a network error', async () => {
  const r = runtime();
  r.controls.gather = async () => { throw new Error('offline'); };
  await r.ads.initializeMobileAds();
  assert.equal(r.ads.getMobileAdsState().ready, true);
});

test('consent read failure stays blocked until a fresh successful read', async () => {
  const r = runtime();
  r.controls.read = async () => { throw new Error('native read failed'); };
  await r.ads.initializeMobileAds();
  assert.equal(r.ads.getMobileAdsState().ready, false);
  assert.equal(count(r, 'initialize'), 0);
  r.advance(60000);
  r.controls.read = async () => r.info;
  await r.ads.initializeMobileAds();
  assert.equal(r.ads.getMobileAdsState().ready, true);
});

test('privacy form is single-flight and revocation blocks every placement before resuming', async () => {
  const r = runtime();
  r.info.privacyOptionsRequirementStatus = 'REQUIRED';
  await r.ads.initializeMobileAds();
  let close;
  r.controls.form = () => new Promise(resolve => { close = resolve; });
  const first = r.ads.showAdsPrivacyOptions();
  assert.equal(first, r.ads.showAdsPrivacyOptions());
  await tick();
  assert.equal(r.ads.getMobileAdsState().ready, false);
  const initializeWhileOpen = r.ads.initializeMobileAds();
  assert.equal(count(r, 'gather'), 1);
  r.info.canRequestAds = false;
  close();
  await Promise.all([first, initializeWhileOpen]);
  assert.equal(count(r, 'form'), 1);
  assert.equal(r.ads.getMobileAdsState().ready, false);
  assert.equal(count(r, 'initialize'), 1);
});

test('privacy form load error rechecks actual eligibility and preserves SDK initialization', async () => {
  const r = runtime();
  r.info.privacyOptionsRequirementStatus = 'REQUIRED';
  await r.ads.initializeMobileAds();
  r.controls.form = async () => { throw new Error('form unavailable'); };
  await assert.rejects(r.ads.showAdsPrivacyOptions(), /form unavailable/);
  assert.equal(r.ads.getMobileAdsState().ready, true);
  assert.equal(count(r, 'initialize'), 1);
});

test('mute failure does not initialize the native SDK twice on recovery', async () => {
  const r = runtime();
  r.controls.mute = async () => { throw new Error('mute failed'); };
  await r.ads.initializeMobileAds();
  assert.equal(r.ads.getMobileAdsState().ready, false);
  r.advance(60000);
  r.controls.mute = async () => {};
  await r.ads.initializeMobileAds();
  assert.equal(r.ads.getMobileAdsState().ready, true);
  assert.equal(count(r, 'initialize'), 1);
});

test('navigation and SDK refresh share the same placement cooldown without blocking other placements', () => {
  const r = runtime();
  r.policy.recordBannerRequest('home-top');
  r.advance(15000);
  assert.equal(r.policy.bannerRequestDelay('home-top'), 45000);
  assert.equal(r.policy.bannerRequestDelay('schedule-1'), 0);
  r.policy.recordBannerFailure('home-top', Object.assign(new Error('no fill'), { code: 'no-fill' }));
  assert.equal(r.policy.bannerRequestDelay('home-top'), 60000);
  r.advance(60000);
  assert.equal(r.policy.bannerRequestDelay('home-top'), 0);
});

test('Expo regeneration preserves UMP release rules without duplicating or replacing existing rules', async () => {
  const module = { exports: {} };
  let contents = '# Existing app rules\n-keep class example.Existing { *; }\n', dangerous;
  const imports = {
    'expo/config-plugins': { withDangerousMod: (config, [, action]) => { dangerous = action; return config; }, withAppBuildGradle: config => config, withGradleProperties: config => config },
    'node:fs/promises': { readFile: async () => contents, writeFile: async (_path, next) => { contents = next; } },
    'node:path': { join: (...parts) => parts.join('/') },
  };
  vm.runInNewContext(fs.readFileSync('mobile/plugins/with-android-release-optimization.js', 'utf8'), { module, require: name => imports[name] });
  module.exports({});
  await dangerous({ modRequest: { platformProjectRoot: '/isolated/android' } });
  const once = contents;
  await dangerous({ modRequest: { platformProjectRoot: '/isolated/android' } });
  assert.equal(contents, once);
  assert.ok(contents.includes('-keep class example.Existing { *; }'));
  assert.ok(contents.includes('-keep class com.google.android.gms.internal.consent_sdk.** { *; }'));
});
