import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourcePath = new URL('../../mobile/components/community/community-post-content.tsx', import.meta.url);

test('mobile post viewer hydrates YouTube, X, and Instagram embeds', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /if \(node\.type === 'youtube'\)[\s\S]*<YoutubeEmbed href=\{href\}/);
  assert.match(source, /if \(node\.type === 'embed'\)[\s\S]*<SocialEmbed href=\{href\} provider=\{provider\}/);
  assert.match(source, /https:\/\/platform\.twitter\.com\/widgets\.js/);
  assert.match(source, /https:\/\/www\.instagram\.com\/embed\.js/);
  assert.match(source, /new MutationObserver\(report\)/);
  assert.match(source, /new ResizeObserver\(report\)/);
  assert.match(source, /message\.type === 'height'/);
});

test('unknown social links retain the external-link fallback', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /const provider = socialEmbedProvider\(href, node\.attrs\?\.type\)/);
  assert.match(source, /if \(provider\) return <SocialEmbed/);
  assert.match(source, /node\.attrs\?\.title \?\? '외부 콘텐츠 열기'/);
});
