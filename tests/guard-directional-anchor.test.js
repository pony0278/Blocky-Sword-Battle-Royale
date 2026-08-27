import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GUARD_DIRECTIONAL_ANCHOR_STAGE,
  GUARD_DIRECTIONAL_COVERAGE_ANCHORS,
  GUARD_DIRECTIONAL_ANCHOR_CALIBRATION,
  assessGuardAnchorCoverage,
  buildGuardDirectionalAnchorThreat,
  getGuardDirectionalAnchor,
  resolveGuardDirectionalAnchorPoint,
} from '../src/combat/guard-directional-anchor.js';
import { CALIBRATED_ENGAGEMENT_SEPARATION_METERS } from '../src/combat/engagement-spacing.js';

const surface = Object.freeze({
  center: Object.freeze({ x: 0, y: 1, z: 0.5 }),
  normal: Object.freeze({ x: 0, y: 0, z: 1 }),
  radius: 0.26,
  thickness: 0.02,
});

test('R18R.5 every attack direction has a measured coverage anchor', () => {
  assert.equal(GUARD_DIRECTIONAL_ANCHOR_STAGE, 'R18R.5');
  assert.deepEqual(Object.keys(GUARD_DIRECTIONAL_COVERAGE_ANCHORS), ['top', 'right', 'left']);
  for (const anchor of Object.values(GUARD_DIRECTIONAL_COVERAGE_ANCHORS)) {
    for (const axis of ['right', 'up', 'forward']) {
      assert.equal(typeof anchor[axis], 'number', `anchor is missing ${axis}`);
    }
  }
  assert.equal(getGuardDirectionalAnchor('LEFT'), GUARD_DIRECTIONAL_COVERAGE_ANCHORS.left);
  assert.equal(getGuardDirectionalAnchor('nonsense'), null);
});

test('R18R.5 LEFT is the low sweep the high guard has to come down for', () => {
  const { top, right, left } = GUARD_DIRECTIONAL_COVERAGE_ANCHORS;
  assert.ok(left.up < right.up, 'LEFT should arrive lower than RIGHT');
  assert.ok(right.up < top.up, 'RIGHT should arrive lower than TOP');
  assert.ok(Math.abs(left.up) > 3 * Math.abs(top.up), 'TOP arrives roughly level with the guard');
});

test('R18R.5 resolves the anchor in the shield frame, depth included', () => {
  // normal = +z, so right = up x normal = (1, 0, 0) and up stays (0, 1, 0).
  const point = resolveGuardDirectionalAnchorPoint({ direction: 'left', bucklerSurface: surface });
  const anchor = GUARD_DIRECTIONAL_COVERAGE_ANCHORS.left;
  assert.ok(Math.abs(point.x - (surface.center.x + anchor.right)) < 1e-9);
  assert.ok(Math.abs(point.y - (surface.center.y + anchor.up)) < 1e-9);
  assert.ok(Math.abs(point.z - (surface.center.z + anchor.forward)) < 1e-9);
  assert.equal(resolveGuardDirectionalAnchorPoint({ direction: 'left' }), null);
  assert.equal(resolveGuardDirectionalAnchorPoint({ direction: 'x', bucklerSurface: surface }), null);
});

test('R18R.5 the anchor threat carries no contact authority', () => {
  const threat = buildGuardDirectionalAnchorThreat({ direction: 'left', bucklerSurface: surface });
  assert.equal(threat.selection, 'directional-anchor');
  assert.equal(threat.direction, 'left');
  assert.equal(threat.futureSeconds, 0);
  assert.equal(threat.surface, surface);
  assert.match(threat.authority, /no-contact-authority/);
  const anchor = GUARD_DIRECTIONAL_COVERAGE_ANCHORS.left;
  const expected = Math.hypot(anchor.right, anchor.up, anchor.forward);
  assert.ok(Math.abs(threat.radialDistance - expected) < 1e-9);
  assert.equal(buildGuardDirectionalAnchorThreat({ direction: 'left' }), null);
});

test('R18V.1 binds the anchors to the separation they were measured at', () => {
  // The binding itself: measuredAtMeters is imported, not typed, so it can never disagree with the
  // stance the scene actually builds.
  assert.equal(
    GUARD_DIRECTIONAL_ANCHOR_CALIBRATION.measuredAtMeters,
    CALIBRATED_ENGAGEMENT_SEPARATION_METERS,
  );
  // And the loud half: this literal is what fails when someone moves the fighters apart. The
  // anchors, the servo travel budget, the residual and the crouch were all measured at 2.3m. If
  // that changes, re-measure them and update the table in guard-directional-anchor.js -- do not
  // just update this number.
  assert.equal(
    GUARD_DIRECTIONAL_ANCHOR_CALIBRATION.measuredAtMeters,
    2.3,
    'calibrated separation moved: re-measure GUARD_DIRECTIONAL_COVERAGE_ANCHORS and verifiedCoverage',
  );
  assert.deepEqual(
    Object.keys(GUARD_DIRECTIONAL_ANCHOR_CALIBRATION.verifiedCoverage).sort(),
    Object.keys(GUARD_DIRECTIONAL_COVERAGE_ANCHORS).sort(),
    'every anchored direction needs a measured coverage band',
  );
});

test('R18V.1 records that LEFT does not reach the guard at the calibrated separation', () => {
  // This is a characterisation test, not an aspiration. It states the measured gap so that fixing
  // LEFT is a visible, deliberate change to this file rather than a silent drift.
  const separationMeters = CALIBRATED_ENGAGEMENT_SEPARATION_METERS;
  assert.equal(assessGuardAnchorCoverage({ direction: 'top', separationMeters }).verified, true);
  assert.equal(assessGuardAnchorCoverage({ direction: 'right', separationMeters }).verified, true);

  const left = assessGuardAnchorCoverage({ direction: 'left', separationMeters });
  assert.equal(left.verified, false);
  assert.equal(left.reason, 'beyond-verified-reach');
  assert.equal(left.deltaFromMeasuredMeters, 0);
  assert.equal(left.beyondTestedRange, false);
  assert.ok(
    left.band.toMeters < separationMeters,
    'LEFT was measured to stop reaching the guard before the calibrated separation',
  );
});

test('R18V.1 reports honestly outside the range that was actually tested', () => {
  // R18X.1 swept down to 1.40m and LEFT now clears the bar from 1.50m, so the closer-than-band
  // case has moved in with it.
  assert.equal(assessGuardAnchorCoverage({ direction: 'left', separationMeters: 1.5 }).verified, true);
  const close = assessGuardAnchorCoverage({ direction: 'left', separationMeters: 1.45 });
  assert.equal(close.verified, false);
  assert.equal(close.reason, 'closer-than-verified-band');
  assert.equal(close.beyondTestedRange, false, '1.45m was swept, it just failed');
  assert.equal(assessGuardAnchorCoverage({ direction: 'left', separationMeters: 1.2 }).beyondTestedRange, true);

  const far = assessGuardAnchorCoverage({ direction: 'top', separationMeters: 4 });
  assert.equal(far.verified, false);
  assert.equal(far.reason, 'beyond-verified-reach');
  assert.equal(far.beyondTestedRange, true);

  for (const bad of [
    { direction: 'nonsense', separationMeters: 2.3 },
    { direction: 'left', separationMeters: 'x' },
    {},
  ]) {
    const result = assessGuardAnchorCoverage(bad);
    assert.equal(result.verified, false, JSON.stringify(bad));
    assert.ok(['unknown-direction', 'unknown-separation'].includes(result.reason));
  }
});

test('R18V.1 does not silently correct the anchor for distance', () => {
  // No drift model has been measured, so the anchor itself must stay the same object at every
  // separation. Reporting that it is out of band is the whole contract.
  const nearThreat = buildGuardDirectionalAnchorThreat({ direction: 'left', bucklerSurface: surface });
  assert.deepEqual(nearThreat.point, resolveGuardDirectionalAnchorPoint({ direction: 'left', bucklerSurface: surface }));
  assert.equal(getGuardDirectionalAnchor('left'), GUARD_DIRECTIONAL_COVERAGE_ANCHORS.left);
});
