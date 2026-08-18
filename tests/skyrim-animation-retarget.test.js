import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SKYRIM_BONE_RETARGETS,
  classifySkyrimTranslationSafety,
  computeSkyrimTranslationScale,
  measureVectorSampleExcursion,
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

function sanitizedGlbHierarchy() {
  const root = new FakeNode('SOURCE');
  for (const mapping of SKYRIM_BONE_RETARGETS) {
    const sanitized = mapping.sourceAliases[0]
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    root.add(new FakeNode(sanitized));
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

test('Skyrim mapping isolates root motion from pelvis-relative body translation', () => {
  const positional = SKYRIM_BONE_RETARGETS.filter((entry) => entry.position);
  assert.deepEqual(positional.map((entry) => entry.target), ['root', 'hips']);
  assert.equal(positional.find((entry) => entry.target === 'root').positionSpace, 'world-root');
  assert.equal(positional.find((entry) => entry.target === 'hips').positionSpace, 'root-relative');
  assert.equal(SKYRIM_BONE_RETARGETS.find((entry) => entry.target === 'upperarm.r').position, undefined);
});

test('Skyrim translation scale preserves real cross-unit skeleton ratios instead of clamping to 0.5', () => {
  const scale = computeSkyrimTranslationScale(120, 1.24);
  assert.ok(scale > 0.01 && scale < 0.011);
  assert.notEqual(scale, 0.5);
  assert.equal(computeSkyrimTranslationScale(0, 1.24), 1);
});

test('translation excursion catches a mid-clip flight even when start and end positions match', () => {
  const metrics = measureVectorSampleExcursion([
    0, 0, 0,
    0.02, 0.01, 0,
    50, 0, 0,
    0, 0, 0,
  ]);
  assert.equal(metrics.sampleCount, 4);
  assert.ok(metrics.maxExcursion >= 50);
  assert.ok(metrics.maxStep > 49);

  const safety = classifySkyrimTranslationSafety({
    root: metrics,
    hips: measureVectorSampleExcursion([0, 0.4, 0, 0, 0.41, 0]),
  }, 1.24);
  assert.equal(safety.safe, false);
  assert.ok(safety.excursionRatio > 40);
});

test('small guard body motion remains translation-safe', () => {
  const safety = classifySkyrimTranslationSafety({
    root: measureVectorSampleExcursion([0, 0, 0, 0.01, 0, 0, 0, 0, 0]),
    hips: measureVectorSampleExcursion([0, 0.4, 0, 0.01, 0.42, 0, 0, 0.4, 0]),
  }, 1.24);
  assert.equal(safety.safe, true);
  assert.ok(safety.excursionRatio < 0.1);
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

test('Skyrim source resolver accepts GLB-sanitized names with spaces and bracket tags rewritten', () => {
  const report = resolveSkyrimSourceNodes(sanitizedGlbHierarchy());
  assert.equal(report.valid, true);
  assert.deepEqual(report.missing, []);
  assert.equal(report.nodes['upperarm.l'].name, 'NPC_L_UpperArm_LUar');
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
