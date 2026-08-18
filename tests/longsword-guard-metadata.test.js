import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LONGSWORD_GUARD_AUTHORING_STATE,
  LONGSWORD_GUARD_BASE,
  LONGSWORD_GUARD_CORRECTION_SCOPE,
  LONGSWORD_GUARD_CORRECTION_ORDER,
  LONGSWORD_TRIANGLE_GUARD_TARGETS,
  evaluateLongswordTriangleGuardTargets,
  getLongswordGuardCorrectionBones,
} from '../src/combat/longsword-guard-metadata.js';

test('G2.5 freezes shd_blockidle as ADOPT WITH CORRECTIONS', () => {
  assert.equal(LONGSWORD_GUARD_BASE.clipId, 'SKYRIM_GUARD/shd_blockidle');
  assert.equal(LONGSWORD_GUARD_BASE.adoptionDecision, 'ADOPT WITH CORRECTIONS');
  assert.equal(LONGSWORD_GUARD_BASE.lowLevelRetargetFrozen, true);
  assert.equal(LONGSWORD_GUARD_AUTHORING_STATE.authored, false);
  assert.deepEqual(LONGSWORD_GUARD_AUTHORING_STATE.offsets, {});
});

test('G2.5 correction scope cannot overwrite root or lower body', () => {
  const allowed = new Set(getLongswordGuardCorrectionBones());
  for (const bone of LONGSWORD_GUARD_CORRECTION_SCOPE.forbiddenBones) {
    assert.equal(allowed.has(bone), false, `${bone} must remain source-authored`);
  }

  assert.deepEqual(LONGSWORD_GUARD_CORRECTION_SCOPE.requiredBones, [
    'upperarm.r',
    'lowerarm.r',
    'wrist.r',
  ]);
  assert.equal(LONGSWORD_GUARD_CORRECTION_SCOPE.policy.equipmentTrimOnly, true);
  assert.equal(LONGSWORD_GUARD_CORRECTION_SCOPE.policy.equipmentTrimMaxDegrees, 15);
});

test('G2.5 canonical pre-correction shape isolates the three known failures', () => {
  const result = evaluateLongswordTriangleGuardTargets({
    weaponHandHeight: 0.41,
    offHandHeight: 0.73,
    weaponHandCenterDistance: 0.57,
    offHandCenterDistance: 0.58,
    swordTipHeight: 0.28,
    swordForwardDot: -0.80,
    triangleArea: 0.06,
    torsoYawDegrees: 35.9,
  });

  assert.equal(result.status, 'needs-correction');
  assert.deepEqual(result.failures, [
    'weaponHandHeight',
    'swordTipHeight',
    'swordForwardDot',
  ]);
});

test('G2.5 corrected Triangle Forward candidate passes the authored target contract', () => {
  const result = evaluateLongswordTriangleGuardTargets({
    weaponHandHeight: 0.62,
    offHandHeight: 0.72,
    weaponHandCenterDistance: 0.50,
    offHandCenterDistance: 0.55,
    swordTipHeight: 0.88,
    swordForwardDot: 0.82,
    triangleArea: 0.075,
    torsoYawDegrees: 32,
  });

  assert.equal(result.status, 'good');
  assert.deepEqual(result.failures, []);
});

test('G2.5 target contract is intentionally tighter than the generic G2.4 suitability gate', () => {
  assert.equal(LONGSWORD_TRIANGLE_GUARD_TARGETS.weaponHandHeight.min, 0.50);
  assert.equal(LONGSWORD_TRIANGLE_GUARD_TARGETS.swordTipHeight.min, 0.70);
  assert.equal(LONGSWORD_TRIANGLE_GUARD_TARGETS.swordForwardDot.min, 0.65);
  assert.deepEqual(LONGSWORD_TRIANGLE_GUARD_TARGETS.torsoYawDegrees, { min: 20, max: 38 });
  assert.equal(LONGSWORD_GUARD_CORRECTION_ORDER.includes('apply-g2.4.5-weapon-bind-calibration'), true);
});
