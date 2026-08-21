import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PREDICTIVE_INTERCEPT_PARRY_STAGE,
  PREDICTIVE_PARRY_INPUT_GRADES,
  analyzePredictiveInterceptParry,
  classifyPredictiveParryTiming,
  getPredictiveParryTriggerTtcSeconds,
} from '../src/combat/predictive-intercept-parry.js';

const surface = {
  center: { x: 0, y: 0, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
  radius: 0.26,
  thickness: 0.075,
};

function blade(z, y = 0.30) {
  return [
    { x: -0.24, y, z },
    { x: 0, y, z },
    { x: 0.24, y, z },
  ];
}

function close(actual, expected, epsilon = 0.02) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

test('G4.3B.5R grades Parry input by predicted time-to-contact', () => {
  assert.equal(PREDICTIVE_INTERCEPT_PARRY_STAGE, 'G4.3B.5R');
  assert.equal(classifyPredictiveParryTiming(0.30), PREDICTIVE_PARRY_INPUT_GRADES.TOO_EARLY);
  assert.equal(classifyPredictiveParryTiming(0.18), PREDICTIVE_PARRY_INPUT_GRADES.EARLY);
  assert.equal(classifyPredictiveParryTiming(0.10), PREDICTIVE_PARRY_INPUT_GRADES.PERFECT);
  assert.equal(classifyPredictiveParryTiming(0.05), PREDICTIVE_PARRY_INPUT_GRADES.LATE);
  assert.equal(classifyPredictiveParryTiming(0.01), PREDICTIVE_PARRY_INPUT_GRADES.TOO_LATE);
});

test('G4.3B.5R normal Parry begins earlier than Perfect Parry', () => {
  assert.ok(getPredictiveParryTriggerTtcSeconds('parry') > getPredictiveParryTriggerTtcSeconds('perfect'));
  close(getPredictiveParryTriggerTtcSeconds('parry'), 0.135, 1e-9);
  close(getPredictiveParryTriggerTtcSeconds('perfect'), 0.065, 1e-9);
});

test('G4.3B.5R tracks a future intercept before physical Sword × Buckler contact', () => {
  const plan = analyzePredictiveInterceptParry({
    previousBlade: blade(0.20),
    currentBlade: blade(0.10),
    bucklerSurface: surface,
    deltaSeconds: 0.10,
    requestedGrade: 'parry',
  });

  assert.equal(plan.available, true);
  assert.equal(plan.interceptable, true);
  assert.equal(plan.shouldTrigger, true);
  assert.equal(plan.reason, 'predictive-parry-trigger-window');
  assert.ok(plan.timeToContactSeconds > 0.06 && plan.timeToContactSeconds < 0.14);
  assert.equal(plan.trackingPlan.mode, 'parry');
  assert.equal(plan.parryTrackingProfile.maxCorrectionMeters, 0.18);
  assert.ok(plan.trackingPlan.appliedDistance > 0.10);
});

test('G4.3B.5R sees the threat before the rhythm trigger window and waits', () => {
  const plan = analyzePredictiveInterceptParry({
    previousBlade: blade(0.30),
    currentBlade: blade(0.20),
    bucklerSurface: surface,
    deltaSeconds: 0.10,
    requestedGrade: 'parry',
  });

  assert.equal(plan.available, true);
  assert.equal(plan.interceptable, true);
  assert.equal(plan.shouldTrigger, false);
  assert.ok(plan.timeToContactSeconds > plan.triggerTtcSeconds);
  assert.equal(plan.reason, 'tracking-future-intercept');
});

test('G4.3B.5R allows cross-body LEFT-like reach within the existing 18cm Parry envelope', () => {
  const plan = analyzePredictiveInterceptParry({
    previousBlade: blade(0.20, 0.32),
    currentBlade: blade(0.10, 0.32),
    bucklerSurface: surface,
    deltaSeconds: 0.10,
    requestedGrade: 'parry',
  });

  assert.equal(plan.interceptable, true);
  assert.equal(plan.trackingPlan.reachable, true);
  assert.ok(plan.trackingPlan.requiredDistance > 0.15);
  assert.ok(plan.trackingPlan.requiredDistance <= 0.18 + 1e-6);
});

test('G4.3B.5R refuses to magnetize the defender to an unreachable attack', () => {
  const plan = analyzePredictiveInterceptParry({
    previousBlade: blade(0.20, 0.55),
    currentBlade: blade(0.10, 0.55),
    bucklerSurface: surface,
    deltaSeconds: 0.10,
    requestedGrade: 'parry',
  });

  assert.equal(plan.interceptable, false);
  assert.equal(plan.shouldTrigger, false);
  assert.equal(plan.trackingPlan.reachable, false);
  assert.equal(plan.reason, 'predicted-intercept-out-of-parry-reach');
});
