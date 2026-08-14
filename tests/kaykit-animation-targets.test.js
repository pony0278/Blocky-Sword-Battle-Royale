import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { KAYKIT_RIG_MEDIUM_DEFINITION } from '../src/character/kaykit-rig-definition.js';

function parseGlbJson(buffer) {
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF');
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) {
      return JSON.parse(buffer.subarray(offset + 8, offset + 8 + length).toString('utf8').trim());
    }
    offset += 8 + length;
  }
  throw new Error('GLB has no JSON chunk');
}

test('all extracted KayKit animation channels target generated bones', async () => {
  const manifest = JSON.parse(await readFile(new URL('../assets/kaykit/manifest.json', import.meta.url), 'utf8'));
  const boneIds = new Set(KAYKIT_RIG_MEDIUM_DEFINITION.bones.map((bone) => bone.id));
  for (const pack of manifest.packs) {
    const glb = parseGlbJson(await readFile(new URL(`../assets/kaykit/${pack.file}`, import.meta.url)));
    for (const animation of glb.animations || []) {
      for (const channel of animation.channels || []) {
        const targetName = glb.nodes[channel.target.node]?.name;
        assert.ok(boneIds.has(targetName), `${pack.id}/${animation.name} targets ${targetName}`);
        assert.ok(['translation', 'rotation', 'scale'].includes(channel.target.path));
      }
    }
  }
});
