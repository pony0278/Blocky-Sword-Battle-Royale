import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GUARD_RECOVERY_PROFILE_IDS,
  blendRecoveryPose,
  resolveGuardRecoveryProfile,
  resolveLocalQuaternionForWorld,
  samplePoseMatchedRecovery,
  sampleRecoveryWorldQuaternion,
} from '../src/combat/guard-recovery-bridge.js';

function transform(positionX, quaternion = { x: 0, y: 0, z: 0, w: 1 }) {
  return Object.freeze({
    position: Object.freeze({ x: positionX, y: 0, z: 0 }),
    quaternion: Object.freeze(quaternion),
    scale: Object.freeze({ x: 1, y: 1, z: 1 }),
  });
}

function pose(positionX, quaternion) {
  return Object.freeze({ spine: transform(positionX, quaternion) });
}

function axisAngleY(degrees) {
  const half = degrees * Math.PI / 360;
  return Object.freeze({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) });
}

function quaternionAngleDegrees(a, b = { x: 0, y: 0, z: 0, w: 1 }) {
  const dot = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w);
  return 2 * Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
}

function multiplyQuaternion(a, b) {
  const value = {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
  const length = Math.hypot(value.x, value.y, value.z, value.w) || 1;
  return { x: value.x / length, y: value.y / length, z: value.z / length, w: value.w / length };
}

test('G3.4.1 recovery preserves the exact source pose at t=0 and exact Guard target at t=1', () => {
  const previous = pose(-0.05);
  const source = pose(0);
  const target = pose(1);

  const start = blendRecoveryPose(previous, source, target, 0, {
    durationMs: 210,
    sampleDeltaMs: 16,
    momentumScale: 0.34,
  });
  assert.deepEqual(start.spine.position, source.spine.position);
  assert.deepEqual(start.spine.quaternion, source.spine.quaternion);

  const end = blendRecoveryPose(previous, source, target, 1, {
    durationMs: 210,
    sampleDeltaMs: 16,
    momentumScale: 0.34,
  });
  assert.ok(Math.abs(end.spine.position.x - 1) < 1e-9);
  assert.ok(Math.abs(end.spine.quaternion.w - 1) < 1e-9);
});

test('G3.4.1 recovery carries source velocity forward before settling instead of snapping to a plain blend', () => {
  const previous = pose(-0.1);
  const source = pose(0);
  const target = pose(1);
  const progress = 0.25;
  const result = blendRecoveryPose(previous, source, target, progress, {
    durationMs: 210,
    sampleDeltaMs: 16,
    momentumScale: 0.34,
  });
  const smooth = progress * progress * (3 - 2 * progress);
  assert.ok(result.spine.position.x > smooth, 'inertial continuation should lead the zero-velocity smoothstep blend');
  assert.ok(result.spine.position.x < 1, 'recovery should still converge toward Guard Hold');
});

test('G3.4.1 disables velocity extrapolation when source samples are too far apart', () => {
  const previous = pose(-0.1);
  const source = pose(0);
  const target = pose(1);
  const snapshot = {
    lastOutcome: 'block',
    lastTransition: { payload: { reactionVariant: 'block-hit' } },
  };
  const result = samplePoseMatchedRecovery(
    snapshot,
    { sequence: 7, elapsedMs: 800, pose: source },
    { sequence: 7, elapsedMs: 600, pose: previous },
    target,
    105,
  );
  assert.equal(result.profile.id, GUARD_RECOVERY_PROFILE_IDS.BLOCK);
  assert.equal(result.momentumActive, false);
});

test('G3.4.1 assigns longer recovery to Perfect Parry and Counter than compact normal Parry', () => {
  const parry = resolveGuardRecoveryProfile({
    lastOutcome: 'parry',
    lastTransition: { payload: { reactionVariant: 'parry' } },
  });
  const perfect = resolveGuardRecoveryProfile({
    lastOutcome: 'parry',
    lastTransition: { payload: { reactionVariant: 'perfect-parry' } },
  });
  const counter = resolveGuardRecoveryProfile({
    lastOutcome: 'counter',
    lastTransition: { payload: { counterProfileId: 'counter' } },
  });
  assert.equal(parry.id, GUARD_RECOVERY_PROFILE_IDS.PARRY);
  assert.equal(perfect.id, GUARD_RECOVERY_PROFILE_IDS.PERFECT_PARRY);
  assert.equal(counter.id, GUARD_RECOVERY_PROFILE_IDS.COUNTER);
  assert.ok(parry.durationMs < perfect.durationMs);
  assert.ok(perfect.durationMs < counter.durationMs);
});

test('G3.4.1.1 world-space sword orientation follows one monotonic shortest path to Guard', () => {
  const source = axisAngleY(158.54);
  const target = axisAngleY(0);
  const progressPoints = [0, 0.05, 0.10, 0.25, 0.50, 0.75, 1];
  const angles = progressPoints.map((progress) => quaternionAngleDegrees(
    sampleRecoveryWorldQuaternion(source, target, progress),
    target,
  ));

  assert.ok(Math.abs(angles[0] - 158.54) < 1e-6);
  assert.ok(angles.at(-1) < 1e-6);
  for (let index = 1; index < angles.length; index += 1) {
    assert.ok(
      angles[index] <= angles[index - 1] + 1e-9,
      `world sword angle must not move away from Guard: ${angles.join(' -> ')}`,
    );
  }
});

test('G3.4.1.1 resolves the local sword quaternion from the current parent world rotation', () => {
  const parentWorld = axisAngleY(72);
  const desiredWorld = axisAngleY(-36);
  const local = resolveLocalQuaternionForWorld(parentWorld, desiredWorld);
  const reconstructedWorld = multiplyQuaternion(parentWorld, local);
  assert.ok(quaternionAngleDegrees(reconstructedWorld, desiredWorld) < 1e-6);
});
