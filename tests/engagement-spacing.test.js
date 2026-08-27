import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CALIBRATED_ENGAGEMENT_SEPARATION_METERS,
  MEASURED_FULL_COVERAGE_BAND_METERS,
  MEASURED_UNDEFENDED_BODY_REACH_METERS,
  ENGAGEMENT_SPACING_STAGE,
  normalizeEngagementSeparation,
  planEngagementStance,
} from '../src/combat/engagement-spacing.js';

test('R18T.1 the default stance is exactly the one every calibration was measured at', () => {
  assert.equal(ENGAGEMENT_SPACING_STAGE, 'R18T.1');
  assert.equal(CALIBRATED_ENGAGEMENT_SEPARATION_METERS, 2.3);
  const stance = planEngagementStance();
  // The lab stood the fighters at these exact coordinates before this module existed; the default
  // has to reproduce them or every calibration silently shifts.
  assert.deepEqual(stance.attacker.position, { x: 0, y: 0, z: -1.15 });
  assert.deepEqual(stance.defender.position, { x: 0, y: 0, z: 1.15 });
  assert.equal(stance.attacker.facingRadians, 0);
  assert.equal(stance.defender.facingRadians, Math.PI);
  assert.equal(stance.calibrated, true);
  assert.equal(stance.offsetFromCalibrationMeters, 0);
});

test('R18T.1 the fighters stay symmetric about the origin at any separation', () => {
  // Symmetry is not cosmetic: every measurement taken so far assumed the midpoint is the origin.
  for (const separation of [1.2, 2.0, 2.3, 3.4]) {
    const stance = planEngagementStance(separation);
    assert.equal(stance.separationMeters, separation);
    assert.ok(Math.abs(stance.attacker.position.z + stance.defender.position.z) < 1e-9);
    assert.ok(Math.abs(
      (stance.defender.position.z - stance.attacker.position.z) - separation,
    ) < 1e-9);
  }
});

test('R18T.1 a stance away from calibration says so, and by how much', () => {
  const far = planEngagementStance(2.5);
  assert.equal(far.calibrated, false);
  assert.ok(Math.abs(far.offsetFromCalibrationMeters - 0.2) < 1e-9);
  const near = planEngagementStance(2.0);
  assert.equal(near.calibrated, false);
  assert.ok(Math.abs(near.offsetFromCalibrationMeters + 0.3) < 1e-9);
});

test('R18T.1 nonsense separations are clamped rather than allowed to place a fighter inside another', () => {
  assert.equal(normalizeEngagementSeparation(0), 0.2);
  assert.equal(normalizeEngagementSeparation(-5), 0.2);
  assert.equal(normalizeEngagementSeparation(1000), 8);
  assert.equal(normalizeEngagementSeparation('nonsense'), CALIBRATED_ENGAGEMENT_SEPARATION_METERS);
  assert.equal(normalizeEngagementSeparation(undefined), CALIBRATED_ENGAGEMENT_SEPARATION_METERS);
});

test('R18T.1 the lab places its fighters from the module and can only move them between exchanges', async () => {
  const scene = await readFile(
    new URL('../tools/action-studio/shield-parry-r281/lab-scene.js', import.meta.url),
    'utf8',
  );
  const entry = await readFile(
    new URL('../tools/action-studio/shield-driven-contact-coupling-lab-r281.js', import.meta.url),
    'utf8',
  );
  assert.match(scene, /planEngagementStance\(/);
  assert.doesNotMatch(scene, /position\.set\(0, 0, -?1\.15\)/, 'the coordinates belong to the module now');
  assert.match(scene, /function setEngagementSeparation\(meters\)/);
  // Moving a fighter mid-exchange would move the geometry the swept contact probe is measuring.
  assert.match(entry, /if \(combat\.active \|\| attackRuntime\.active\) return null;/);
  assert.match(entry, /labScene\.setEngagementSeparation\(meters\)/);
});

test('R18V.1 replaces the provisional band with the measured one', () => {
  const band = MEASURED_FULL_COVERAGE_BAND_METERS;
  assert.ok(band.minimum < band.maximum, 'a placeholder band collapses to a point; a measured one does not');
  assert.equal(band.limitedBy.maximum, 'left');
  assert.equal(band.limitedBy.minimum, 'right');
  // The measured band does not contain the calibrated separation, and that is the finding rather
  // than a bug in the constant: at 2.3m only two of the three directions reach the guard. This
  // assertion is what makes fixing LEFT show up as a deliberate edit here.
  assert.ok(
    CALIBRATED_ENGAGEMENT_SEPARATION_METERS > band.maximum,
    'if LEFT now reaches at the calibrated separation, re-measure and widen the band on purpose',
  );
  // Bounds must stay inside what was actually swept; anything else is extrapolation.
  assert.ok(band.minimum >= band.testedRange.minimum);
  assert.ok(band.maximum <= band.testedRange.maximum);
});

test('R18X.1 records where an unopposed attack still reaches the body', () => {
  const reach = MEASURED_UNDEFENDED_BODY_REACH_METERS;
  const coverage = MEASURED_FULL_COVERAGE_BAND_METERS;
  for (const direction of ['top', 'right', 'left']) {
    assert.ok(reach[direction] >= reach.testedRange.minimum, direction);
    assert.ok(reach[direction] <= reach.testedRange.maximum, direction);
  }
  // LEFT is the outlier the whole guard stack exists for: it lands from far enough out that the
  // resting shield never covers it, where TOP and RIGHT finish short.
  assert.ok(reach.left > reach.top && reach.left > reach.right);

  // The two measurements meet at a point rather than over a band, and saying so is the point of
  // keeping them side by side: the guard becomes fully reliable exactly where TOP and RIGHT stop
  // being able to land at all.
  assert.equal(coverage.minimum, reach.top);
  assert.equal(coverage.minimum, reach.right);
  // Past that, only LEFT still threatens anything, and it does so right up to the far end of the
  // guard's own band.
  assert.equal(reach.left, coverage.maximum);
});
