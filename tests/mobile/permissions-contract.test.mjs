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

test('user-driven push request creates Android channels first and skips iOS badge permission', async () => {
  const source = await read('mobile/lib/push-notifications.ts');
  const start = source.indexOf('export async function requestPushPermissionAndRegister');
  const end = source.indexOf('export async function openPushNotificationSettings', start);
  const requestFlow = source.slice(start, end);

  assert.ok(requestFlow.indexOf('await prepareAndroidChannels') < requestFlow.indexOf('requestPermissionsAsync'));
  assert.match(requestFlow, /allowAlert:\s*true/);
  assert.match(requestFlow, /allowBadge:\s*false/);
  assert.match(requestFlow, /allowSound:\s*true/);
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
