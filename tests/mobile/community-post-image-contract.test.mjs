import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mobileSourcePath = new URL('../../mobile/components/community/community-post-content.tsx', import.meta.url);
const webStylesPath = new URL('../../app/globals.css', import.meta.url);

test('mobile post images keep their intrinsic ratio within the body width', async () => {
  const source = await readFile(mobileSourcePath, 'utf8');

  assert.match(source, /Image\.loadAsync\(src\)/);
  assert.match(source, /Math\.min\(sourceWidth, availableWidth\)/);
  assert.match(source, /displayHeight = displayWidth > 0 && aspectRatio > 0 \? displayWidth \/ aspectRatio : 0/);
  assert.doesNotMatch(source, /image: \{ maxHeight:/);
});

test('web post image wrappers cannot exceed the prose width', async () => {
  const source = await readFile(webStylesPath, 'utf8');

  assert.match(source, /\.community-prose > div:has\(> img\) \{ max-width: 100%; \}/);
});
