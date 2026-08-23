import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
  buildLiveShieldSwordGripContactPlan,
  evaluateAttackLineClearance,
  evaluateLiveContactInspection,
  mapLiveShieldContactTarget,
  planLiveForearmHiltAssist,
  planLiveWristAttackLineTwist,
  solveLiveSwordContactConstraint,
} from '../src/combat/live-shield-sword-grip-contact-constraint.js';
import {
  LIVE_PARRY_OLD_B3_HANDOFF_STAGE,
  buildLiveParryOldB3Handoff,
  sampleLiveParryOldB3ReleaseBlend,
} from '../src/combat/live-parry-old-b3-handoff.js';

const surface = Object.freeze({
  center: Object.freeze({ x: 0, y: 1.1, z: 0 }),
  normal: Object.freeze({ x: 0, y: 0, z: -1 }),
});

function contact(overrides = {}) {
  return Object.freeze({
    contact: true,
    geometricContact: true,
    eligible: true,
    point: Object.freeze({ x: 0.08, y: 1.16, z: -0.02 }),
    incomingVelocity: Object.freeze({ x: 0.2, y: -0.4, z: 5.2 }),
    surface,
    ...overrides,
  });
}

function planForShieldTranslation(translation = { x: 0.012, y: 0, z: 0 }) {
  return buildLiveShieldSwordGripContactPlan({
    contact: contact(),
    surfaceAtContact: surface,
    wristWorldPoint: { x: -0.42, y: 0.98, z: -0.38 },
    handWorldPoint: { x: -0.31, y: 1.01, z: -0.31 },
    shieldLeadMotion: {
      deltaSeconds: 1 / 60,
      translation,
      angularVelocity: { x: 0, y: 0, z: 0 },
    },
  });
}

test('Step 3A rejects anything except eligible real swept Sword × Shield contact', () => {
  const rejected = buildLiveShieldSwordGripContactPlan({
    contact: contact({ eligible: false }),
    surfaceAtContact: surface,
    wristWorldPoint: { x: -0.42, y: 0.98, z: -0.38 },
    handWorldPoint: { x: -0.31, y: 1.01, z: -0.31 },
  });

  assert.equal(rejected.stage, LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE);
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reason, 'eligible-real-swept-contact-required');
});

test('Step 3A target follows the current shield surface in opposite live directions', () => {
  const plan = planForShieldTranslation();
  const positive = mapLiveShieldContactTarget(plan, {
    ...surface,
    center: { x: 0.11, y: 1.1, z: 0 },
  });
  const negative = mapLiveShieldContactTarget(plan, {
    ...surface,
    center: { x: -0.11, y: 1.1, z: 0 },
  });

  assert.equal(positive.authority, 'current-world-shield-surface');
  assert.ok(positive.displacement.x > 0.1);
  assert.ok(negative.displacement.x < -0.1);
  assert.ok(positive.deflectionDirection.x > 0.5);
  assert.ok(negative.deflectionDirection.x < -0.5);
});

test('Step 3A position constraint turns the sword contact toward the live target', () => {
  const solved = solveLiveSwordContactConstraint({
    pivotWorldPoint: { x: 0, y: 0, z: 0 },
    currentContactPoint: { x: 1, y: 0, z: 0 },
    targetContactPoint: { x: 0.95, y: 0.3, z: 0 },
    maximumDegrees: 90,
  });

  assert.equal(solved.accepted, true);
  assert.ok(solved.appliedDegrees > 15);
  assert.ok(solved.expectedContactPoint.y > 0.28);
  assert.ok(solved.constraintErrorMeters < 0.01);
});

test('TOP and RIGHT recruit a bounded lowerarm assist before the wrist contact solve', () => {
  const plan = planForShieldTranslation();
  const assistInput = {
    forearmPivotPoint: { x: 0, y: -0.3, z: 0 },
    initialGripPoint: { x: 0, y: 0, z: 0 },
    initialSwordBasePoint: { x: 0, y: 0, z: 0 },
    initialSwordTipPoint: { x: 0, y: 0, z: 1 },
    contactTargetOffset: { x: 0.075, y: 0, z: 0 },
  };
  const top = planLiveForearmHiltAssist({ ...assistInput, attackDirection: 'top' });
  const right = planLiveForearmHiltAssist({ ...assistInput, attackDirection: 'right' });
  const left = planLiveForearmHiltAssist({ ...assistInput, attackDirection: 'left' });

  assert.equal(plan.gripChainOnly, true);
  assert.equal(plan.modifiedBone, 'wrist.r');
  assert.deepEqual(plan.propagatedBones, ['hand.r', 'handslot.r']);
  assert.equal(plan.elbowPropagationActive, false);
  assert.equal(plan.shoulderPropagationActive, false);
  assert.equal(plan.b3ClockFrozen, true);
  assert.equal(top.accepted, true);
  assert.equal(right.accepted, true);
  assert.ok(top.targetHiltOfflineTravelMeters > 0.03);
  assert.ok(right.targetHiltOfflineTravelMeters > 0.03);
  assert.ok(top.estimatedOfflineTravelMeters >= 0.025);
  assert.ok(top.appliedDegrees <= 8);
  assert.ok(top.targetGripPoint.x > 0.024);
  assert.equal(left.accepted, false);
  assert.equal(left.reason, 'attack-direction-deferred');
});

test('TOP and RIGHT can clear the sword axis by twisting around the wrist-to-contact axis', () => {
  const radians = 6 * Math.PI / 180;
  const twist = planLiveWristAttackLineTwist({
    initialSwordAxis: { x: 1, y: 0, z: 0 },
    currentSwordAxis: { x: Math.cos(radians), y: Math.sin(radians), z: 0 },
    initialWristGripAxis: { x: 1, y: 0, z: 0 },
    currentWristGripAxis: { x: Math.cos(radians), y: Math.sin(radians), z: 0 },
    wristPoint: { x: 0, y: 0, z: 0 },
    contactPoint: { x: 0, y: 0, z: 1 },
  });

  assert.equal(twist.accepted, true);
  assert.equal(twist.reason, 'bounded-wrist-attack-line-twist-ready');
  assert.ok(Math.abs(twist.appliedDegrees) <= 6);
  assert.ok(twist.predictedClearanceDegrees >= 7);
  assert.ok(twist.predictedWristGripClearanceDegrees >= 7);
});

test('TOP contact-axis twist can preserve a clear sword while correcting only the wrist-grip line', () => {
  const swordRadians = 12 * Math.PI / 180;
  const wristRadians = 5 * Math.PI / 180;
  const twist = planLiveWristAttackLineTwist({
    initialSwordAxis: { x: 1, y: 0, z: 0 },
    currentSwordAxis: { x: Math.cos(swordRadians), y: Math.sin(swordRadians), z: 0 },
    initialWristGripAxis: { x: 1, y: 0, z: 0 },
    currentWristGripAxis: { x: Math.cos(wristRadians), y: Math.sin(wristRadians), z: 0 },
    wristPoint: { x: 0, y: 0, z: 0 },
    contactPoint: { x: 0, y: 0, z: 1 },
  });

  assert.equal(twist.reason, 'bounded-wrist-attack-line-twist-ready');
  assert.ok(twist.predictedClearanceDegrees >= 7);
  assert.ok(twist.predictedWristGripClearanceDegrees >= 7);
});

test('Step 3A LINE CLEAR requires sword axis, hilt, and wrist-grip line to all leave the original attack line', () => {
  const passed = evaluateAttackLineClearance({
    initialSwordBasePoint: { x: 0, y: 0, z: 0 },
    initialSwordTipPoint: { x: 1, y: 0, z: 0 },
    currentSwordBasePoint: { x: 0, y: 0.04, z: 0 },
    currentSwordTipPoint: { x: 0.98, y: 0.21, z: 0 },
    initialWristPoint: { x: 0, y: -0.2, z: 0 },
    initialGripPoint: { x: 0, y: 0, z: 0 },
    currentWristPoint: { x: 0, y: -0.2, z: 0 },
    currentGripPoint: { x: 0.04, y: 0.04, z: 0 },
  });

  assert.equal(passed.pass, true);
  assert.equal(passed.swordAxisPassed, true);
  assert.equal(passed.hiltOfflinePassed, true);
  assert.equal(passed.wristGripLinePassed, true);

  const failed = evaluateAttackLineClearance({
    initialSwordBasePoint: { x: 0, y: 0, z: 0 },
    initialSwordTipPoint: { x: 1, y: 0, z: 0 },
    currentSwordBasePoint: { x: 0, y: 0.01, z: 0 },
    currentSwordTipPoint: { x: 0.995, y: 0.08, z: 0 },
    initialWristPoint: { x: 0, y: -0.2, z: 0 },
    initialGripPoint: { x: 0, y: 0, z: 0 },
    currentWristPoint: { x: 0, y: -0.2, z: 0 },
    currentGripPoint: { x: 0.008, y: 0.01, z: 0 },
  });
  assert.equal(failed.pass, false);
});
test('Step 3A inspection diagnostic separates failed gates from a normal post-peak contact release', () => {
  const assessment = evaluateLiveContactInspection({
    holding: true,
    terminalReason: 'shield-surface-separated-after-live-deflection-peak',
    peakOfflineTravelMeters: 0.08,
    actualHandTravelMeters: 0.005,
    actualGripTravelMeters: 0.025,
    attackLineClearance: {
      swordAxisClearanceDegrees: 5,
      hiltOfflineTravelMeters: 0.03,
      wristGripClearanceDegrees: 8,
    },
    directionAgreement: 0.4,
  });

  assert.equal(assessment.pass, false);
  assert.equal(assessment.terminalIsExpectedHold, true);
  assert.deepEqual(assessment.failedGateKeys, [
    'handTravel',
    'swordAxisClearance',
    'directionAgreement',
  ]);
  assert.equal(assessment.gates.handTravel.actual, 0.005);
  assert.equal(assessment.gates.handTravel.minimum, 0.01);
  assert.equal(assessment.gates.swordAxisClearance.minimum, 7);
});

test('TOP and RIGHT publish measured 7/7 contact release into OLD B3 while LEFT stays deferred', () => {
  const contactReport = {
    accepted: true,
    holding: true,
    inspectionPassed: true,
    elapsedMs: 128,
    actualContactOffset: { x: 0.08, y: 0.015, z: 0.005 },
    actualGripOffset: { x: 0.026, y: 0.004, z: 0.002 },
    targetContactPoint: { x: 0.18, y: 1.2, z: 0.1 },
    plan: {
      contactPoint: { x: 0.1, y: 1.185, z: 0.095 },
      initialSurfaceCenter: { x: 0, y: 1.1, z: 0 },
      initialSurfaceNormal: { x: 0, y: 0, z: -1 },
    },
    inspectionAssessment: { pass: true, failedGateCount: 0 },
  };

  for (const direction of ['top', 'right']) {
    const handoff = buildLiveParryOldB3Handoff({ attackDirection: direction, contactReport });
    assert.equal(handoff.accepted, true);
    assert.equal(handoff.stage, LIVE_PARRY_OLD_B3_HANDOFF_STAGE);
    assert.equal(handoff.couplingReport.complete, true);
    assert.equal(handoff.couplingReport.releaseAttackerRecoil, true);
    assert.equal(handoff.couplingReport.recoilHandoffMode, 'legacy-two-actor-passthrough');
    assert.deepEqual(handoff.couplingReport.attackerWeaponOffset, contactReport.actualContactOffset);
    assert.equal(handoff.couplingReport.inspectionGateCount, 7);
  }

  const deferred = buildLiveParryOldB3Handoff({ attackDirection: 'left', contactReport });
  assert.equal(deferred.accepted, false);
  assert.equal(deferred.reason, 'attack-direction-deferred');

  assert.equal(sampleLiveParryOldB3ReleaseBlend(0, 120).contactPoseWeight, 1);
  assert.equal(sampleLiveParryOldB3ReleaseBlend(60, 120).contactPoseWeight, 0.5);
  assert.equal(sampleLiveParryOldB3ReleaseBlend(120, 120).contactPoseWeight, 0);
});

test('Step 3A has no scheduled deflection curve, recruits only lowerarm.r, and keeps shoulder off', () => {
  const source = readFileSync(
    new URL('../src/combat/live-shield-sword-grip-contact-constraint.js', import.meta.url),
    'utf8',
  );

  assert.match(source, /bones\?\.\['wrist\.r'\]/);
  assert.match(source, /propagatedBones: Object\.freeze\(\['hand\.r', 'handslot\.r'\]\)/);
  assert.match(source, /bones\?\.\['lowerarm\.r'\]/);
  assert.doesNotMatch(source, /bones\?\.\['upperarm\.r'\]/);
  assert.doesNotMatch(source, /smoothstep|driveDurationMs|minimumHandDegrees|targetHandDegrees/);
});
