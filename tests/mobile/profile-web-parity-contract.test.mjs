import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const read = (path) => fs.readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('native account page keeps the web mobile navigation and content structure', async () => {
  const [account, api, contract, me, profile, web] = await Promise.all([
    read('mobile/components/account/account-sections.tsx'),
    read('app/api/mobile/v1/me/route.ts'),
    read('packages/contracts/src/mobile-v1.ts'),
    read('mobile/app/me.tsx'),
    read('mobile/components/account/profile-form.tsx'),
    read('app/me/page.tsx'),
  ]);

  for (const label of ['프로필', '미니콘', '알림', '차단 관리', '계정·보안']) {
    assert.match(me, new RegExp(`label: '${label}'`));
  }
  assert.match(me, /router\.push\('\/me\/minicons'/);
  assert.match(me, /router\.push\(`\/community\/user\/\$\{data\.profile\.id\}`/);
  assert.match(account, />공통 알림</);
  assert.match(account, />팀별 알림</);
  assert.match(account, /알림 \{enabledCount\(team\)\}개 켜짐/);
  assert.doesNotMatch(account, /getPushPermissionStatus|description="커뮤니티와 팔로우한/);
  assert.doesNotMatch(profile, /닉네임과 프로필 이미지를 변경합니다/);
  assert.match(contract, /teamLogoUrl\?: string \| null/);
  assert.match(api, /select\("id, name, short_name, logo_url"\)/);
  assert.match(web, /className="mb-1 mt-2"><CheckInButton/);
  assert.match(me, /checkIn: \{[^}]*marginBottom: 4/);
});
