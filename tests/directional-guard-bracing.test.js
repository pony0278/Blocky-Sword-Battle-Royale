import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIRECTIONAL_GUARD_BRACING_STAGE,
  planDirectionalGuardBracing,
  planFineGuardTracking,
} from '../src/combat/directional-guard-bracing.js';

const surface = {
  center: { x: 0, y: 1, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
  radius: 0.26,
  thickness: 0.075,
};

function blade(z, y, xOffset = 0) {
  return [
    { x: -0.24 + xOffset, y, z },
    { x: xOffset, y, z },
    { x: 0.24 + xOffset, y, z },
  ];
}

test('G4.3A.2 downward TOP threat prefers overhead whole-arm bracing', () => {
  const plan = planDirectionalGuardBracing({
    mode: 'brace-fine',
    attackDirection: 'top',
    previousBlade: blade(-0.1, 1.22),
    currentBlade: blade(-0.02, 1.10),
    bucklerSurface: surface,
    deltaSeconds: 0.05,
    threat: { point: { x: 0, y: 1.08, z: 0 }, bladeFraction: 0.5 },
  });
  assert.equal(DIRECTIONAL_GUARD_BRACING_STAGE, 'G4.3A.2');
  assert.equal(plan.strategy, 'overhead-brace');
  assert.ok(plan.body.shoulderLiftMeters > 0.035);
  assert.ok(plan.body.shoulderBraceDegrees > 5);
  assert.ok(plan.body.crouchMeters < 0.04);
  assert.equal(plan.fineTrackMaxMeters, 0.07);
});

test('G4.3A.2 low LEFT threat primarily crouches instead of rotating the Buckler after it', () => {
  const plan = planDirectionalGuardBracing({
    mode: 'brace-fine',
    attackDirection: 'left',
    previousBlade: blade(-0.12, 0.82),
    currentBlade: blade(-0.02, 0.80),
    bucklerSurface: surface,
    deltaSeconds: 0.05,
    threat: { point: { x: -0.08, y: 0.78, z: 0 }, bladeFraction: 0.55 },
  });
  assert.equal(plan.strategy, 'low-crouch');
  assert.ok(plan.body.crouchMeters > 0.06);
  assert.ok(plan.body.kneeBendDegrees > 10);
  assert.ok(plan.body.shoulderLiftMeters < 0.015);
});

test('G4.3A.2 lateral RIGHT threat uses chest yaw with only a small crouch', () => {
  const plan = planDirectionalGuardBracing({
    mode: 'brace',
    attackDirection: 'right',
    previousBlade: blade(-0.12, 1.02, 0.12),
    currentBlade: blade(-0.02, 1.02, 0.14),
    bucklerSurface: surface,
    deltaSeconds: 0.05,
    threat: { point: { x: 0.22, y: 1.02, z: 0 }, bladeFraction: 0.5 },
  });
  assert.equal(plan.strategy, 'lateral-brace');
  assert.ok(plan.body.chestYawDegrees > 2);
  assert.ok(plan.body.crouchMeters < 0.02);
  assert.equal(plan.fineTrackMaxMeters, 0);
});

test('G4.3A.2 fine hand tracking is capped at 7cm', () => {
  const fine = planFineGuardTracking({
    threat: { point: { x: 0, y: 1.45, z: 0 } },
    bucklerSurface: surface,
    maxCorrectionMeters: 0.07,
  });
  assert.equal(fine.mode, 'guard');
  assert.equal(fine.reachable, false);
  assert.ok(Math.abs(fine.appliedDistance - 0.07) < 1e-9);
  assert.equal(fine.reason, 'fine-track-clamped');
});

test('G4.3A.2 fine tracking leaves already-covered contact alone', () => {
  const fine = planFineGuardTracking({
    threat: { point: { x: 0.02, y: 1.02, z: 0 } },
    bucklerSurface: surface,
    maxCorrectionMeters: 0.07,
  });
  assert.equal(fine.requiredDistance, 0);
  assert.equal(fine.appliedDistance, 0);
  assert.equal(fine.reason, 'already-covered');
});
