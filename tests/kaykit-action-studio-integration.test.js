import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Action Studio uses the procedural KayKit character as its default character factory', async () => {
  const source = await readFile(new URL('../tools/action-studio/action-studio.js', import.meta.url), 'utf8');
  assert.match(source, /createDefaultCharacter/);
  assert.doesNotMatch(source, /createBlockCharacter/);
  assert.match(source, /loadKayKitAnimationLibrary/);
  assert.match(source, /character\.registerAnimations/);
  assert.match(source, /character\.update\(deltaSeconds, camera\)/);
  assert.doesNotMatch(source, /setCharacterRenderStyle|data-character-style/);
  assert.match(source, /sword\.update\(\)/);
  assert.match(source, /sword\.setNodesVisible/);
  assert.match(source, /sword\.setGlowVisible/);
  assert.match(source, /sword\.trailTip\.getWorldPosition/);
  assert.match(source, /sword\.getSweepSegment/);
});

test('Action Studio exposes explicit KayKit runtime controls and GLTFLoader', async () => {
  const template = await readFile(new URL('../tools/action-studio/index.template.html', import.meta.url), 'utf8');
  assert.match(template, /GLTFLoader\.js/);
  assert.match(template, /id="loadKayKitAnimations"/);
  assert.match(template, /id="kaykitClip"/);
  assert.match(template, /id="playKayKitAnimation"/);
  assert.match(template, /23 generated bones/);
  assert.match(template, /id="toggleRigNodes"/);
  assert.match(template, /id="toggleRigGlow"/);
  assert.doesNotMatch(template, />Hybrid<|>Block<|data-character-style/);
  assert.match(template, /id="weaponRigStatus"/);
  assert.match(template, /11 weapon bones/);
  assert.match(template, /exact v3 edges/);
});

test('default character dependency graph does not import a source KayKit model', async () => {
  const factory = await readFile(new URL('../src/character/default-character.js', import.meta.url), 'utf8');
  const character = await readFile(new URL('../src/character/procedural-kaykit-character.js', import.meta.url), 'utf8');
  const rig = await readFile(new URL('../src/character/procedural-kaykit-rig.js', import.meta.url), 'utf8');
  assert.doesNotMatch(`${factory}\n${character}\n${rig}`, /GLTFLoader|knight\.glb|EMBED\.knight/);
  assert.match(character, /createProceduralKayKitRig/);
  assert.match(rig, /new THREE\.Bone/);
  assert.match(rig, /createKayKitV3LineAppearance/);
  assert.doesNotMatch(rig, /buildProceduralMeshes|BoxGeometry|MeshStandardMaterial/);
});
