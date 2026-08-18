import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');

test('G2.5.2 generated standalone bundle contains the fixed Skyrim scale path', async () => {
  const bundle = await read('tools/action-studio/action-studio.bundle.js');
  assert.match(bundle, /Runtime parity stage: G2\.5\.2/);
  assert.match(bundle, /function computeSkyrimTranslationScale\(/);
  assert.doesNotMatch(bundle, /Math\.max\(0\.5,\s*Math\.min\(1\.5,\s*targetHeight\s*\/\s*sourceHeight\)\)/);
  assert.match(bundle, /positionSpace:\s*'root-relative'/);
});

test('G2.5.2 generated index identifies bundle versus module runtime paths', async () => {
  const html = await read('tools/action-studio/index.html');
  assert.match(html, /__ACTION_STUDIO_RUNTIME_STAGE\s*=\s*['"]G2\.5\.2['"]/);
  assert.match(html, /__ACTION_STUDIO_ENTRY_MODE\s*=\s*['"]bundle['"]/);
  assert.match(html, /__ACTION_STUDIO_ENTRY_MODE\s*=\s*['"]module['"]/);
  assert.match(html, /action-studio-runtime-parity\.js/);
});

test('G2.5.2 parity probe uses the real Action Studio character and in-place prepared clip', async () => {
  const source = await read('tools/action-studio/action-studio-runtime-parity.js');
  assert.match(source, /__ACTION_STUDIO_G252_CHARACTER/);
  assert.match(source, /getPreparedClipDiagnostics\(CLIP_ID, true\)/);
  assert.match(source, /character\.playAnimation\(CLIP_ID/);
  assert.match(source, /preparedRootPositionTracks\s*===\s*0/);
  assert.match(source, /translationScale\s*>\s*0\s*&&\s*translationScale\s*<\s*0\.1/);
  assert.match(source, /SAMPLE_COUNT\s*=\s*1201/);
});
