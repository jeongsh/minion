import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const sourcePath = new URL('../../mobile/components/account/account-sections.tsx', import.meta.url);
const screenPath = new URL('../../mobile/app/me.tsx', import.meta.url);

test('profile sections tolerate the previous mobile me response shape', async () => {
  const source = await fs.readFile(sourcePath, 'utf8');

  assert.match(source, /initialTeams\?: MobileTeamNotificationSettings\[\]/);
  assert.match(source, /Array\.isArray\(initialTeams\) \? initialTeams : \[\]/);
  assert.match(source, /Array\.isArray\(blockedUsers\) \? blockedUsers : \[\]/);
  assert.match(source, /Array\.isArray\(blockedGuests\) \? blockedGuests : \[\]/);
  assert.match(source, /team\.teamShortName \|\| team\.teamName \|\| '\?'/);
});

test('profile section layout snapshots the synthetic event before updating state', async () => {
  const source = await fs.readFile(screenPath, 'utf8');

  assert.match(source, /const y = event\.nativeEvent\.layout\.y;\s*setSectionPositions\(\(current\) => \(\{ \.\.\.current, \[key\]: y \}\)\)/);
  assert.doesNotMatch(source, /setSectionPositions\([^\n]*event\.nativeEvent/);
});
