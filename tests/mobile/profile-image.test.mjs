import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../../mobile/lib/profile-image.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function picker({ platform = 'ios', asset, canceled = false, renderError = false, saveError = false } = {}) {
  const calls = [];
  const image = { saveAsync: async (options) => { calls.push(['save', options]); if (saveError) throw Error('save'); return { uri: 'file:///converted.jpg', width: 512, height: 384 }; }, release: () => calls.push(['image.release']) };
  const context = { resize: (size) => calls.push(['resize', size]), renderAsync: async () => { if (renderError) throw Error('render'); return image; }, release: () => calls.push(['context.release']) };
  const modules = {
    'react-native': { Platform: { OS: platform } },
    'expo-image-picker': { UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' }, launchImageLibraryAsync: async (options) => { calls.push(['pick', options]); return { canceled, assets: asset ? [asset] : [] }; } },
    'expo-image-manipulator': { ImageManipulator: { manipulate: (uri) => { calls.push(['manipulate', uri]); return context; } }, SaveFormat: { JPEG: 'jpeg' } },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => modules[name], Error });
  return { pick: exports.pickProfileImage, calls };
}

for (const platform of ['ios', 'android']) {
  test(`${platform}: HEIC or missing MIME metadata is converted, including originals over 5MB`, async () => {
    for (const mimeType of ['image/heic', undefined]) {
      const { pick, calls } = picker({ platform, asset: { uri: 'file:///photo.heic', width: 4032, height: 3024, mimeType, fileSize: 12 * 1024 * 1024, file: { name: 'original.heic' } } });
      const result = await pick();
      assert.equal(result.uri, 'file:///converted.jpg');
      assert.equal(result.mimeType, 'image/jpeg');
      assert.equal(result.fileName, 'profile.jpg');
      assert.equal(result.file, undefined);
      assert.equal(calls[0][1].preferredAssetRepresentationMode, 'compatible');
      assert.equal(calls.find(([name]) => name === 'resize')[1].width, 512);
      assert.equal(calls.find(([name]) => name === 'save')[1].format, 'jpeg');
      assert.deepEqual(calls.slice(-2).map(([name]) => name), ['image.release', 'context.release']);
    }
  });
}

test('cancel does not convert or replace the selected photo', async () => {
  const { pick, calls } = picker({ canceled: true });
  assert.equal(await pick(), null);
  assert.equal(calls.length, 1);
});

test('native failures release resources and report a real error', async () => {
  for (const failure of ['renderError', 'saveError']) {
    const { pick, calls } = picker({ asset: { uri: 'file:///photo.jpg', width: 100, height: 200 }, [failure]: true });
    await assert.rejects(pick(), /사진을 처리하지 못했습니다/);
    assert.equal(calls.at(-1)[0], 'context.release');
    if (failure === 'saveError') assert.equal(calls.at(-2)[0], 'image.release');
  }
});

test('web preserves the actual File and enforces its size', async () => {
  const asset = { file: { size: 100, type: '' }, uri: 'blob:photo', width: 100, height: 100 };
  const { pick } = picker({ platform: 'web', asset });
  assert.equal(await pick(), asset);
  await assert.rejects(picker({ platform: 'web', asset: { ...asset, file: { size: 6 * 1024 * 1024 } } }).pick(), /5MB/);
});
