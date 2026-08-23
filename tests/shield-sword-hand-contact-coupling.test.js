import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
  buildLiveShieldSwordGripContactPlan,
  evaluateAttackLineClearance,
  evaluateLiveContactInspection,
  mapLiveShieldContactTarget,
  solveLiveSwordContactConstraint,
} from '../src/combat/live-shield-sword-grip-contact-constraint.js';

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

test('Step 3A modifies wrist.r so hand, socket, hilt, and sword follow while B3 stays frozen', () => {
  const plan = planForShieldTranslation();

  assert.equal(plan.gripChainOnly, true);
  assert.equal(plan.modifiedBone, 'wrist.r');
  assert.deepEqual(plan.propagatedBones, ['hand.r', 'handslot.r']);
  assert.equal(plan.elbowPropagationActive, false);
  assert.equal(plan.shoulderPropagationActive, false);
  assert.equal(plan.b3ClockFrozen, true);
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

test('Step 3A source has no scheduled deflection curve and never writes elbow or shoulder bones', () => {
  const source = readFileSync(
    new URL('../src/combat/live-shield-sword-grip-contact-constraint.js', import.meta.url),
    'utf8',
  );

  assert.match(source, /bones\?\.\['wrist\.r'\]/);
  assert.match(source, /propagatedBones: Object\.freeze\(\['hand\.r', 'handslot\.r'\]\)/);
  assert.doesNotMatch(source, /bones\?\.\['lowerarm\.r'\]/);
  assert.doesNotMatch(source, /bones\?\.\['upperarm\.r'\]/);
  assert.doesNotMatch(source, /smoothstep|driveDurationMs|minimumHandDegrees|targetHandDegrees|attackDirection/);
});
