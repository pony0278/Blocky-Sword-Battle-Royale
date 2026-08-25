import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_PARRY_INTERCEPT_INTENT_STAGE,
  createActiveParryInterceptIntent,
} from '../src/combat/active-parry-intercept-intent.js';

const surface = Object.freeze({
  center: Object.freeze({ x: 0, y: 1, z: 0 }),
  normal: Object.freeze({ x: 0, y: 0, z: -1 }),
  radius: 0.26,
  thickness: 0.075,
});

function predictive(requiredDistance = 1.44, point = { x: 1, y: 1.5, z: 0 }) {
  return Object.freeze({
    threat: Object.freeze({ point: Object.freeze({ ...point }) }),
    trackingPlan: Object.freeze({ requiredDistance }),
  });
}

function magnitude(value) {
  return Math.hypot(value.x, value.y, value.z);
}

test('R18N.1 clamps the F-latched intercept to a reachable visible lead instead of preserving the raw prediction', () => {
  const intent = createActiveParryInterceptIntent();
  const armed = intent.arm({
    sequence: 2,
    direction: 'top',
    bucklerSurface: surface,
    predictiveAnalysis: predictive(1.44),
  });
  assert.equal(armed.accepted, true);
  assert.equal(armed.intent.stage, ACTIVE_PARRY_INTERCEPT_INTENT_STAGE);
  assert.equal(armed.intent.rawRequiredDistanceMeters, 1.44);
  assert.equal(armed.intent.leadMeters, 0.12);
  assert.ok(Math.abs(magnitude(armed.intent.correction) - 0.12) < 1e-9);

  const plan = intent.plan({ sequence: 2, bucklerSurface: surface });
  assert.equal(plan.reason, 'latched-active-shield-intercept');
  assert.equal(plan.reachable, true);
  assert.equal(plan.requiredDistance, 0.12);
  assert.equal(plan.appliedDistance, 0.12);
});

test('R18N.1 preserves one world-space lead vector across changing prediction/surface frames', () => {
  const intent = createActiveParryInterceptIntent();
  intent.arm({
    sequence: 3,
    direction: 'right',
    bucklerSurface: surface,
    predictiveAnalysis: predictive(0.95, { x: 0.8, y: 0.6, z: 0 }),
  });
  const first = intent.plan({ sequence: 3, bucklerSurface: surface });
  const movedSurface = { ...surface, center: { x: 0.02, y: 1.03, z: 0.01 } };
  const second = intent.plan({ sequence: 3, bucklerSurface: movedSurface });
  assert.deepEqual(second.correction, first.correction);
  assert.equal(second.requiredDistance, first.requiredDistance);
  assert.equal(intent.report.stableAcrossFrames, true);
});

test('R18N.1 still creates a distinct active lead when the existing guard already covers the predicted threat', () => {
  const intent = createActiveParryInterceptIntent();
  const armed = intent.arm({
    sequence: 4,
    direction: 'right',
    bucklerSurface: surface,
    predictiveAnalysis: predictive(0, { x: 0.4, y: 1, z: 0 }),
  });
  assert.equal(armed.accepted, true);
  assert.equal(armed.intent.leadMeters, 0.07);
  assert.ok(magnitude(armed.intent.correction) >= 0.07 - 1e-9);
});

test('R18N.1 keeps LEFT deferred and never creates contact authority', () => {
  const intent = createActiveParryInterceptIntent();
  const result = intent.arm({
    sequence: 5,
    direction: 'left',
    bucklerSurface: surface,
    predictiveAnalysis: predictive(),
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'direction-deferred');
  assert.equal(intent.active, false);
  assert.equal(intent.plan({ sequence: 5, bucklerSurface: surface }), null);
});
