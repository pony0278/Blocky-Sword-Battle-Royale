import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CLOSE_RANGE_ENGAGEMENT_STAGE,
  CLOSE_RANGE_REFUTED,
  MEASURED_BODY_STRIKE_BLADE_FRACTION,
  MEASURED_GUARD_WORKING_FLOOR_METERS,
  MEASURED_SHIELD_CATCH_BLADE_FRACTION,
  UNDEFENDED_CLOSE_RANGE_BAND_METERS,
  assessCloseRangeEngagement,
} from '../src/combat/close-range-engagement.js';
import { MINIMUM_ENGAGEMENT_SEPARATION_METERS } from '../src/combat/lane-locomotion.js';
import { MEASURED_FULL_COVERAGE_BAND_METERS } from '../src/combat/engagement-spacing.js';

const DIRECTIONS = ['top', 'right', 'left'];

test('R19J.1 the sword never strikes with its base at any separation a body can reach', () => {
  assert.equal(CLOSE_RANGE_ENGAGEMENT_STAGE, 'R19J.1');
  // This is the whole finding. The closest sample in every direction is taken at the body
  // pushbox, and even there the strike lands on the middle of the blade. A "hilt hits do not
  // cut" rule has nothing to fire on.
  for (const direction of DIRECTIONS) {
    const samples = MEASURED_BODY_STRIKE_BLADE_FRACTION[direction];
    const closest = samples[0];
    assert.equal(closest.separationMeters, MINIMUM_ENGAGEMENT_SEPARATION_METERS,
      `${direction} must be sampled at the floor, since that is the case in question`);
    assert.ok(closest.bladeFraction >= 0.4,
      `${direction} strikes at fraction ${closest.bladeFraction} at the floor - mid-blade, not the base`);
  }
  const minimum = Math.min(...DIRECTIONS.map((d) => MEASURED_BODY_STRIKE_BLADE_FRACTION[d][0].bladeFraction));
  assert.equal(minimum, 0.44, 'LEFT at the floor is the worst case measured');
});

test('R19J.1 the strike slides toward the tip as the fighters separate, in every direction', () => {
  // Monotonic is the sanity check on the whole sweep: a non-monotonic curve would mean the
  // measurement caught different moments of the swing rather than one comparable event.
  for (const direction of DIRECTIONS) {
    const samples = MEASURED_BODY_STRIKE_BLADE_FRACTION[direction];
    for (let index = 1; index < samples.length; index += 1) {
      assert.ok(samples[index].separationMeters > samples[index - 1].separationMeters,
        `${direction} samples must be ordered by separation`);
      assert.ok(samples[index].bladeFraction >= samples[index - 1].bladeFraction,
        `${direction} fraction fell from ${samples[index - 1].bladeFraction} to ${samples[index].bladeFraction}`);
    }
    assert.equal(samples[samples.length - 1].bladeFraction, 1, `${direction} reaches with the tip at range`);
  }
});

test('R19J.1 the shield catch slides the other way, to the blade base, as the attacker closes', () => {
  for (const direction of DIRECTIONS) {
    const samples = MEASURED_SHIELD_CATCH_BLADE_FRACTION[direction];
    assert.ok(samples.length >= 3, `${direction} needs enough samples to show the trend`);
    for (let index = 1; index < samples.length; index += 1) {
      assert.ok(samples[index].bladeFraction >= samples[index - 1].bladeFraction);
    }
    // The nearest sample in every direction is the blade base: the attacker is already inside.
    assert.equal(samples[0].bladeFraction, 0, `${direction} catches at the base when closest`);
  }
});

test('R19J.1 the gap is between the pushbox and the guard, and it is computed from both ends', () => {
  // Not two transcribed numbers: moving either end must move the band, because the band is the
  // finding and a stale copy of it would be worse than not recording it.
  assert.equal(UNDEFENDED_CLOSE_RANGE_BAND_METERS.minimum, MINIMUM_ENGAGEMENT_SEPARATION_METERS);
  assert.equal(UNDEFENDED_CLOSE_RANGE_BAND_METERS.maximum, MEASURED_GUARD_WORKING_FLOOR_METERS);
  assert.ok(Math.abs(UNDEFENDED_CLOSE_RANGE_BAND_METERS.widthMeters - 0.65) < 1e-9);
  assert.ok(UNDEFENDED_CLOSE_RANGE_BAND_METERS.widthMeters > 0,
    'a non-positive width would mean the defence covers everything the attack reaches');
  // And the guard's floor agrees with the coverage band measured from the other direction.
  assert.equal(MEASURED_GUARD_WORKING_FLOOR_METERS, MEASURED_FULL_COVERAGE_BAND_METERS.minimum);
});

test('R19J.1 the refutations are recorded with what killed them', () => {
  for (const key of ['hiltStrikeRule', 'raisedPushboxFloor']) {
    const entry = CLOSE_RANGE_REFUTED[key];
    assert.ok(entry.proposal && entry.refutedBy && entry.consequence, `${key} needs all three`);
  }
  assert.match(CLOSE_RANGE_REFUTED.hiltStrikeRule.refutedBy, /0\.44/);
  assert.match(CLOSE_RANGE_REFUTED.hiltStrikeRule.consequence, /polearm/,
    'the rule is deferred to a weapon that needs it, not deleted as an idea');
});

test('R19J.1 the assessment reads the measured curves and claims no authority', () => {
  const atFloor = assessCloseRangeEngagement({ direction: 'left', separationMeters: 0.9 });
  assert.equal(atFloor.known, true);
  assert.equal(atFloor.expectedBodyStrikeBladeFraction, 0.44);
  assert.equal(atFloor.insideGuardWorkingRange, false);
  assert.equal(atFloor.insideUndefendedBand, true);
  assert.match(atFloor.authority, /no-contact-authority/);

  // Between samples it interpolates rather than snapping to one of them.
  const between = assessCloseRangeEngagement({ direction: 'left', separationMeters: 1.1 });
  assert.ok(between.expectedBodyStrikeBladeFraction > 0.5);
  assert.ok(between.expectedBodyStrikeBladeFraction < 0.63);

  // Past the sampled range it holds the nearest observation instead of extrapolating.
  const far = assessCloseRangeEngagement({ direction: 'top', separationMeters: 9 });
  assert.equal(far.expectedBodyStrikeBladeFraction, 1);
  assert.equal(far.insideGuardWorkingRange, true);
  assert.equal(far.insideUndefendedBand, false);

  assert.equal(assessCloseRangeEngagement({ direction: 'thrust' }).known, false);
});
