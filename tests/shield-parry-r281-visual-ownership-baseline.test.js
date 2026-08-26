import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  R18N_VISUAL_OWNERSHIP_BASELINE_STAGE,
  R18N_VISUAL_OWNERSHIP_WRITERS,
  captureVisualOwnershipPose,
  createVisualOwnershipBaselineRecorder,
  diffVisualOwnershipPose,
  quaternionAngularDistanceDegrees,
} from '../tools/action-studio/shield-parry-r281/visual-ownership-baseline.js';

function yaw(degrees) {
  const radians = degrees * Math.PI / 180;
  return { x: 0, y: Math.sin(radians / 2), z: 0, w: Math.cos(radians / 2) };
}

function fakeRig() {
  return {
    bones: {
      root: { quaternion: yaw(0) },
      chest: { quaternion: yaw(0) },
      'upperarm.l': { quaternion: yaw(0) },
      'lowerarm.l': { quaternion: yaw(0) },
      head: { quaternion: yaw(0) },
    },
  };
}

test('R18N.4.1 quaternion diff treats q and -q as the same rotation', () => {
  const q = yaw(42);
  const negated = { x: -q.x, y: -q.y, z: -q.z, w: -q.w };
  assert.ok(quaternionAngularDistanceDegrees(q, negated) < 1e-6);
});

test('R18N.4.1 capture is observer-only and returns detached quaternion values', () => {
  const rig = fakeRig();
  const pose = captureVisualOwnershipPose(rig, ['chest']);
  assert.deepEqual(pose.chest, yaw(0));
  rig.bones.chest.quaternion = yaw(30);
  assert.deepEqual(pose.chest, yaw(0));
  assert.ok(Object.isFrozen(pose));
  assert.ok(Object.isFrozen(pose.chest));
});

test('R18N.4.1 diff reports only rotations above the telemetry epsilon', () => {
  const before = { chest: yaw(0), 'upperarm.l': yaw(0) };
  const after = { chest: yaw(0.01), 'upperarm.l': yaw(3) };
  const diff = diffVisualOwnershipPose(before, after, { epsilonDegrees: 0.05 });
  assert.deepEqual(diff.changedBones, ['upperarm.l']);
  assert.ok(diff.deltasDegrees['upperarm.l'] > 2.9);
});

test('R18N.4.1 recorder identifies the final writer per bone without writing the rig', () => {
  const rig = fakeRig();
  const recorder = createVisualOwnershipBaselineRecorder({
    boneIds: ['root', 'chest', 'upperarm.l', 'lowerarm.l', 'head'],
  });
  recorder.beginFrame({ sequence: 7, attackPhase: 'attack_active', elapsedSeconds: 0.21, rig });

  rig.bones.head.quaternion = yaw(4);
  recorder.record(R18N_VISUAL_OWNERSHIP_WRITERS.GUARD_RUNTIME, { rig });

  rig.bones.chest.quaternion = yaw(6);
  rig.bones['upperarm.l'].quaternion = yaw(8);
  recorder.record(R18N_VISUAL_OWNERSHIP_WRITERS.PREDICTIVE_PRESENTATION, { rig });

  rig.bones['upperarm.l'].quaternion = yaw(12);
  rig.bones['lowerarm.l'].quaternion = yaw(9);
  recorder.record(R18N_VISUAL_OWNERSHIP_WRITERS.ACTIVE_INTERCEPT_PRIMARY, { rig });

  rig.bones.chest.quaternion = yaw(7);
  recorder.record(R18N_VISUAL_OWNERSHIP_WRITERS.RESIDUAL_BODY_REACH, { rig });

  recorder.record(R18N_VISUAL_OWNERSHIP_WRITERS.PRE_CONTACT_FINAL, { rig });
  const report = recorder.finish({ contact: false });

  assert.equal(report.stage, R18N_VISUAL_OWNERSHIP_BASELINE_STAGE);
  assert.equal(report.orderValid, true);
  assert.equal(report.authority, 'observer-only-no-rig-write-no-contact-authority');
  assert.equal(report.lastWriterByBone.head, R18N_VISUAL_OWNERSHIP_WRITERS.GUARD_RUNTIME);
  assert.equal(report.lastWriterByBone['upperarm.l'], R18N_VISUAL_OWNERSHIP_WRITERS.ACTIVE_INTERCEPT_PRIMARY);
  assert.equal(report.lastWriterByBone['lowerarm.l'], R18N_VISUAL_OWNERSHIP_WRITERS.ACTIVE_INTERCEPT_PRIMARY);
  assert.equal(report.lastWriterByBone.chest, R18N_VISUAL_OWNERSHIP_WRITERS.RESIDUAL_BODY_REACH);
  assert.equal(recorder.active, false);
});

test('R18N.4.1 recorder makes writer-order regressions explicit instead of silently accepting them', () => {
  const rig = fakeRig();
  const recorder = createVisualOwnershipBaselineRecorder({ boneIds: ['chest'] });
  recorder.beginFrame({ rig });
  recorder.record(R18N_VISUAL_OWNERSHIP_WRITERS.PREDICTIVE_PRESENTATION, { rig });
  recorder.record(R18N_VISUAL_OWNERSHIP_WRITERS.GUARD_RUNTIME, { rig });
  const report = recorder.finish();
  assert.equal(report.orderValid, false);
  assert.equal(report.orderViolations.length, 1);
  assert.equal(report.orderViolations[0].writer, R18N_VISUAL_OWNERSHIP_WRITERS.GUARD_RUNTIME);
});

test('R18N.4.1 telemetry module has no production mutation or contact authority', async () => {
  const source = await readFile(
    new URL('../tools/action-studio/shield-parry-r281/visual-ownership-baseline.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /\.quaternion\.(?:copy|set|premultiply|multiply|slerp)/);
  assert.doesNotMatch(source, /combat\.resolveContact|parryGate\.(?:arm|confirm)|probeSweptSwordBucklerContact/);
  assert.match(source, /observer-only-no-rig-write-no-contact-authority/);
});
