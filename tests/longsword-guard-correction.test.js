import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGuardQuaternionOffsets,
  createGuardAuthoringExport,
  normalizeQuaternionArray,
  quaternionAngleDegrees,
  quaternionFromEulerDegrees,
  validateGuardQuaternionOffsets,
} from '../src/combat/longsword-guard-correction.js';

test('G2.5.1 quaternion helpers preserve identity and XYZ authoring semantics', () => {
  assert.deepEqual(normalizeQuaternionArray([0, 0, 0, 0]), [0, 0, 0, 1]);
  assert.ok(quaternionAngleDegrees(quaternionFromEulerDegrees({ x: 10, y: 0, z: 0 })) > 9.999);
  assert.ok(quaternionAngleDegrees(quaternionFromEulerDegrees({ x: 10, y: 0, z: 0 })) < 10.001);
});

test('G2.5.1 accepts in-budget right-arm correction offsets', () => {
  const offsets = buildGuardQuaternionOffsets({
    'upperarm.r': { x: 20, y: 0, z: 0 },
    'lowerarm.r': { x: 0, y: -30, z: 0 },
    'wrist.r': { x: 0, y: 0, z: 45 },
    'handslot.r': { x: 0, y: 10, z: 0 },
  });
  const result = validateGuardQuaternionOffsets(offsets);
  assert.equal(result.valid, true);
  assert.deepEqual(result.overBudget, []);
});

test('G2.5.1 rejects over-budget or forbidden corrections', () => {
  const overBudget = validateGuardQuaternionOffsets(buildGuardQuaternionOffsets({
    'handslot.r': { x: 30, y: 0, z: 0 },
  }));
  assert.equal(overBudget.valid, false);
  assert.deepEqual(overBudget.overBudget, ['handslot.r']);

  const forbidden = validateGuardQuaternionOffsets({
    hips: quaternionFromEulerDegrees({ x: 5 }),
  });
  assert.equal(forbidden.valid, false);
  assert.deepEqual(forbidden.invalidBones, ['hips']);
});

test('G2.5.1 export remains explicitly local-quaternion based', () => {
  const output = createGuardAuthoringExport({
    'upperarm.r': { x: 10, y: -5, z: 3 },
  }, { source: 'authoring-lab' });
  assert.equal(output.authored, true);
  assert.equal(output.baseSample, 0.5);
  assert.equal(output.offsets['upperarm.r'].length, 4);
  assert.equal(output.diagnostics.source, 'authoring-lab');
});
