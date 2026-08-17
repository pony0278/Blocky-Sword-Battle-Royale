import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SKYRIM_BONE_RETARGETS,
  resolveSkyrimSourceNodes,
  validateSkyrimTargetRig,
} from '../src/animation/skyrim-animation-retarget.js';

class FakeNode {
  constructor(name = '') {
    this.name = name;
    this.children = [];
  }

  add(child) {
    this.children.push(child);
    return this;
  }

  traverse(visitor) {
    visitor(this);
    this.children.forEach((child) => child.traverse(visitor));
  }

  getObjectByName(name) {
    let found = null;
    this.traverse((node) => {
      if (!found && node.name === name) found = node;
    });
    return found;
  }
}

function fullSkyrimHierarchy(useFallbackAliases = false) {
  const root = new FakeNode('SOURCE');
  for (const mapping of SKYRIM_BONE_RETARGETS) {
    const alias = useFallbackAliases
      ? mapping.sourceAliases[Math.min(1, mapping.sourceAliases.length - 1)]
      : mapping.sourceAliases[0];
    root.add(new FakeNode(alias));
  }
  return root;
}

test('Skyrim retarget map targets the canonical Action Studio humanoid rig', () => {
  const targets = SKYRIM_BONE_RETARGETS.map((entry) => entry.target);
  assert.equal(SKYRIM_BONE_RETARGETS.length, 19);
  assert.equal(new Set(targets).size, targets.length);
  assert.deepEqual(targets.slice(0, 5), ['root', 'hips', 'spine', 'chest', 'head']);
  assert.ok(targets.includes('upperarm.l'));
  assert.ok(targets.includes('lowerarm.r'));
  assert.ok(targets.includes('upperleg.l'));
  assert.ok(targets.includes('toes.r'));
});

test('Skyrim mapping keeps root and pelvis translation while limbs are rotation driven', () => {
  const positional = SKYRIM_BONE_RETARGETS.filter((entry) => entry.position).map((entry) => entry.target);
  assert.deepEqual(positional, ['root', 'hips']);
  assert.equal(SKYRIM_BONE_RETARGETS.find((entry) => entry.target === 'upperarm.r').position, undefined);
});

test('Skyrim source resolver accepts canonical Skyrim bone names', () => {
  const report = resolveSkyrimSourceNodes(fullSkyrimHierarchy(false));
  assert.equal(report.valid, true);
  assert.deepEqual(report.missing, []);
  assert.equal(Object.keys(report.nodes).length, SKYRIM_BONE_RETARGETS.length);
  assert.equal(report.nodes.root.name, 'NPC Root [Root]');
  assert.equal(report.nodes.pelvis.name, 'NPC Pelvis [Pelv]');
  assert.equal(report.nodes['upperarm.l'].name, 'NPC L UpperArm [LUar]');
});

test('Skyrim source resolver accepts common exporter aliases after HKX conversion', () => {
  const report = resolveSkyrimSourceNodes(fullSkyrimHierarchy(true));
  assert.equal(report.valid, true);
  assert.deepEqual(report.missing, []);
});

test('Skyrim source resolver reports semantic bones instead of decoder-specific names', () => {
  const root = fullSkyrimHierarchy(false);
  root.children = root.children.filter((node) => node.name !== 'NPC R Forearm [RLar]');
  const report = resolveSkyrimSourceNodes(root);
  assert.equal(report.valid, false);
  assert.deepEqual(report.missing, ['lowerarm.r']);
});

test('Action Studio target validation fails clearly when a required target bone is absent', () => {
  const completeBones = Object.fromEntries(SKYRIM_BONE_RETARGETS.map(({ target }) => [target, {}]));
  assert.deepEqual(validateSkyrimTargetRig({ bones: completeBones }), { valid: true, missing: [] });

  delete completeBones['wrist.l'];
  const report = validateSkyrimTargetRig({ bones: completeBones });
  assert.equal(report.valid, false);
  assert.deepEqual(report.missing, ['wrist.l']);
});
