import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

test('mobile app requests no broad media, camera, microphone, or biometric permission', async () => {
  const config = JSON.parse(await read('mobile/app.json'));
  const plugins = config.expo.plugins;
  const plugin = (name) => plugins.find((entry) => Array.isArray(entry) && entry[0] === name);
  const imagePicker = plugin('expo-image-picker');
  const secureStore = plugin('expo-secure-store');

  assert.equal(imagePicker?.[1]?.photosPermission, false);
  assert.equal(imagePicker?.[1]?.cameraPermission, false);
  assert.equal(imagePicker?.[1]?.microphonePermission, false);
  assert.equal(secureStore?.[1]?.faceIDPermission, false);

  const blocked = new Set(config.expo.android.blockedPermissions);
  for (const permission of [
    'android.permission.CAMERA',
    'android.permission.RECORD_AUDIO',
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_MEDIA_VIDEO',
    'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
  ]) assert.ok(blocked.has(permission), `${permission} must stay blocked`);
});

test('login only syncs an existing push grant and never requests permission', async () => {
  const auth = await read('mobile/providers/auth-provider.tsx');
  assert.match(auth, /syncPushTokenIfAuthorized\(\)/);
  assert.doesNotMatch(auth, /requestPushPermissionAndRegister|\bregisterPushToken\s*\(/);
});

test('the native app asks for notification permission once on the first launch', async () => {
  const [layout, source] = await Promise.all([
    read('mobile/app/_layout.tsx'),
    read('mobile/lib/push-notifications.ts'),
  ]);
  const start = source.indexOf('export async function requestInitialPushPermission');
  const end = source.indexOf('export async function syncPushTokenIfAuthorized', start);
  const initialRequestFlow = source.slice(start, end);

  assert.match(layout, /<InitialPushPermissionRequest\s*\/>/);
  assert.match(initialRequestFlow, /AsyncStorage\.getItem\(INITIAL_PERMISSION_REQUESTED_KEY\)/);
  assert.ok(initialRequestFlow.indexOf('AsyncStorage.setItem') < initialRequestFlow.indexOf('requestPermissionsAsync'));
  assert.doesNotMatch(initialRequestFlow, /uploadPushToken/);
});

test('user-driven push request creates Android channels first and skips iOS badge permission', async () => {
  const source = await read('mobile/lib/push-notifications.ts');
  const start = source.indexOf('export async function requestPushPermission()');
  const end = source.indexOf('export async function requestPushPermissionAndRegister', start);
  const requestFlow = source.slice(start, end);

  assert.ok(requestFlow.indexOf('await prepareAndroidChannels') < requestFlow.indexOf('requestPermissionsAsync'));
  assert.match(requestFlow, /allowAlert:\s*true/);
  assert.match(requestFlow, /allowBadge:\s*false/);
  assert.match(requestFlow, /allowSound:\s*true/);
});

test('following a team reoffers push permission and links denied users to system settings', async () => {
  const source = await read('mobile/components/fan/fan-page.tsx');
  const followStart = source.indexOf('async function applyFollow');
  const favoriteStart = source.indexOf('async function applyFavorite', followStart);
  const followFlow = source.slice(followStart, favoriteStart);

  assert.match(followFlow, /if \(result\.following\) void offerDevicePushAfterEnabling\(\)/);
  assert.match(source, /permission\.status === 'denied'/);
  assert.match(source, /openPushNotificationSettings\(\)/);
});

test('high-volume and content pushes are silent while match pushes keep sound', async () => {
  const [matchStart, ratingOpen, matchEvent, teamContent] = await Promise.all([
    read('lib/notify/match-start-automation.ts'),
    read('lib/notify/set-rating-open-push.ts'),
    read('lib/notify/match-event-push.ts'),
    read('lib/notifications/team-content.ts'),
  ]);

  assert.match(matchStart, /channelId:\s*"match"[\s\S]*sound:\s*"default"/);
  assert.match(ratingOpen, /channelId:\s*"match"[\s\S]*sound:\s*"default"/);
  assert.match(matchEvent, /channelId:\s*"live"[\s\S]*sound:\s*null/);
  assert.match(teamContent, /channelId:\s*"content"[\s\S]*sound:\s*null/);
});

test('live match events use web and foreground app toasts without entering either in-app inbox', async () => {
  const [webActivity, nativeProvider, nativePush] = await Promise.all([
    read('components/match-activity/use-match-activity.ts'),
    read('mobile/providers/in-app-notifications-provider.tsx'),
    read('mobile/lib/push-notifications.ts'),
  ]);
  const webLiveEventFlow = webActivity.slice(
    webActivity.indexOf('const newEvents = data.events.filter'),
    webActivity.indexOf('// 라이브 피드가 잠시 끊겨도', webActivity.indexOf('const newEvents = data.events.filter')),
  );
  const nativeLivePollFlow = nativeProvider.slice(
    nativeProvider.indexOf("const liveMatchAlertTeamIds = new Set"),
    nativeProvider.indexOf('const markNotificationRead'),
  );

  assert.match(webLiveEventFlow, /presentNotification\(\{[\s\S]*kind:\s*"match_event"/);
  assert.doesNotMatch(webLiveEventFlow, /publishNotification/);
  assert.match(webActivity, /notification\.kind !== "match_event"/);
  assert.match(nativeProvider, /if \(type === 'match_event'\) \{[\s\S]*presentNotification\(\{[\s\S]*kind:\s*'match_event'[\s\S]*return;/);
  assert.match(nativeProvider, /notification\.kind !== 'match_event'/);
  assert.doesNotMatch(nativeLivePollFlow, /publishNotification|presentNotification|showMatchEventToast/);
  assert.match(nativePush, /shouldShowBanner:\s*false/);
  assert.match(nativePush, /shouldShowList:\s*false/);
});

test('following or favoriting a team does not silently opt into alerts', async () => {
  const sources = await Promise.all([
    read('app/api/mobile/v1/teams/[teamSlug]/fan/route.ts'),
    read('app/api/mobile/v1/teams/[teamSlug]/favorite/route.ts'),
  ]);

  for (const source of sources) {
    assert.match(source, /match_alerts:\s*false/);
    assert.match(source, /instagram_alerts:\s*false/);
    assert.match(source, /video_alerts:\s*false/);
  }
});

test('privacy policy discloses mobile identifiers and push delivery providers', async () => {
  const privacy = await read('app/privacy/page.tsx');
  assert.match(privacy, /앱 설치 식별자/);
  assert.match(privacy, /Expo push token/);
  assert.match(privacy, /650 Industries/);
});
