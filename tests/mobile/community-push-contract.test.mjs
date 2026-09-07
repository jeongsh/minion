import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const serverSource = await readFile(new URL('../../lib/notifications/community.ts', import.meta.url), 'utf8');
const mobileSource = await readFile(new URL('../../mobile/providers/in-app-notifications-provider.tsx', import.meta.url), 'utf8');

test('new community notification rows are sent through the registered Expo push tokens', () => {
  assert.match(serverSource, /ignoreDuplicates:\s*true[\s\S]*?\.select\("id, recipient_user_id, title, description, href"\)/);
  assert.match(serverSource, /\.from\("push_tokens"\)/);
  assert.match(serverSource, /sendExpoPushNotifications/);
  assert.match(serverSource, /channelId:\s*"community"/);
  assert.match(serverSource, /type:\s*"post_activity"/);
  assert.match(serverSource, /notificationId:\s*notification\.id/);
});

test('foreground community pushes refresh the server inbox without creating a duplicate local row', () => {
  assert.match(mobileSource, /kind === 'team_video' \|\| kind === 'team_social' \|\| kind === 'post_activity'/);
  assert.match(mobileSource, /kind === 'post_activity' \? 'community' : 'content'/);
  assert.match(mobileSource, /void loadCommunityNotifications\(\);[\s\S]*?return;/);
});
