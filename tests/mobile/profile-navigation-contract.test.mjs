import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const headerPath = new URL('../../mobile/components/minion-screen.tsx', import.meta.url);

test('authenticated header profile uses a guarded push to the root account screen', async () => {
  const source = await readFile(headerPath, 'utf8');

  assert.match(source, /session \? pathname !== '\/me' && router\.push\('\/me'\)/);
  assert.doesNotMatch(source, /session \? router\.navigate\('\/me'\)/);
});
