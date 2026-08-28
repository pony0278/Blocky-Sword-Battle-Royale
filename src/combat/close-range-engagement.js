import { MINIMUM_ENGAGEMENT_SEPARATION_METERS } from './lane-locomotion.js';

export const CLOSE_RANGE_ENGAGEMENT_STAGE = 'R19J.1';

// R19J.1: what actually happens when the two of them are close, measured rather than assumed.
//
// The question that prompted this was "at very close range the attack passes through the
// defender - should there be a personal-space radius, or should a swing become a shove?" Both
// proposals assume the same thing: that a sword at close range is being swung from too close to
// work, so the swing should be prevented or converted. The measurement below says that assumption
// is false for this weapon, and it is recorded here because a plausible-but-false premise is the
// expensive kind - a "hilt hits do not cut" rule built on it would have been dead code from the
// day it shipped, and a raised pushbox floor would have banned a distance whose attack geometry is
// perfectly healthy.
//
// Method: the defender is left in R19I.1's neutral stance so nothing intercepts, one attack per
// direction is fired at each separation, and the blade fraction where the swept probe FIRST meets
// a body band is recorded. Fraction 0 is the blade base at the guard and 1 is the tip
// (lab-geometry samples the sword as [bladeBase, bladeMid, tip]). The strike lands before the
// authored contact time, so the attack advance has not accumulated yet and the separations below
// are the separations the swing started from.
//
// The headline: at 0.9m - the closest two bodies can stand - the blade meets the body at fraction
// 0.44 to 0.63. That is mid-blade. There is no separation this fighter can reach at which the
// sword strikes with its base, because the body pushbox already prevents it. The same rule WILL
// have work to do when a polearm exists (a 2.5m haft at 0.9m is all haft), which is why the
// concept belongs to a weapon rather than to the lane - but it belongs to that weapon's arrival,
// not to this one's geometry.
export const MEASURED_BODY_STRIKE_BLADE_FRACTION = Object.freeze({
  top: Object.freeze([
    Object.freeze({ separationMeters: 0.9, bladeFraction: 0.63, band: 'chest' }),
    Object.freeze({ separationMeters: 1.0, bladeFraction: 0.69, band: 'chest' }),
    Object.freeze({ separationMeters: 1.2, bladeFraction: 0.81, band: 'chest' }),
    Object.freeze({ separationMeters: 1.4, bladeFraction: 0.94, band: 'chest' }),
    Object.freeze({ separationMeters: 1.6, bladeFraction: 1.0, band: 'chest' }),
    Object.freeze({ separationMeters: 2.4, bladeFraction: 1.0, band: 'head' }),
  ]),
  right: Object.freeze([
    Object.freeze({ separationMeters: 0.9, bladeFraction: 0.63, band: 'chest' }),
    Object.freeze({ separationMeters: 1.0, bladeFraction: 0.75, band: 'chest' }),
    Object.freeze({ separationMeters: 1.2, bladeFraction: 0.88, band: 'chest' }),
    Object.freeze({ separationMeters: 1.4, bladeFraction: 1.0, band: 'chest' }),
    Object.freeze({ separationMeters: 1.6, bladeFraction: 1.0, band: 'head' }),
    Object.freeze({ separationMeters: 2.4, bladeFraction: 1.0, band: 'head' }),
  ]),
  left: Object.freeze([
    Object.freeze({ separationMeters: 0.9, bladeFraction: 0.44, band: 'head' }),
    Object.freeze({ separationMeters: 1.0, bladeFraction: 0.5, band: 'head' }),
    Object.freeze({ separationMeters: 1.2, bladeFraction: 0.63, band: 'head' }),
    Object.freeze({ separationMeters: 1.4, bladeFraction: 0.75, band: 'head' }),
    Object.freeze({ separationMeters: 1.6, bladeFraction: 0.94, band: 'head' }),
    Object.freeze({ separationMeters: 2.4, bladeFraction: 1.0, band: 'head' }),
  ]),
});

// The other half of the same sweep, with the guard up: where on the blade the shield catches. It
// slides toward the base as the fighters close, and below the working floor it stops catching at
// all. A shield meeting the blade at its base is not a shield that mistimed anything - it is the
// geometry of an attacker who is already inside, which is the finding that reframes close range as
// a state needing its own defence rather than a distance where defence merely fails.
export const MEASURED_SHIELD_CATCH_BLADE_FRACTION = Object.freeze({
  top: Object.freeze([
    Object.freeze({ separationMeters: 1.66, bladeFraction: 0 }),
    Object.freeze({ separationMeters: 1.86, bladeFraction: 0.08 }),
    Object.freeze({ separationMeters: 2.06, bladeFraction: 0.27 }),
    Object.freeze({ separationMeters: 2.26, bladeFraction: 0.47 }),
  ]),
  right: Object.freeze([
    Object.freeze({ separationMeters: 1.86, bladeFraction: 0 }),
    Object.freeze({ separationMeters: 2.06, bladeFraction: 0.33 }),
    Object.freeze({ separationMeters: 2.26, bladeFraction: 0.5 }),
  ]),
  left: Object.freeze([
    Object.freeze({ separationMeters: 1.66, bladeFraction: 0 }),
    Object.freeze({ separationMeters: 1.86, bladeFraction: 0.23 }),
    Object.freeze({ separationMeters: 2.06, bladeFraction: 0.34 }),
    Object.freeze({ separationMeters: 2.26, bladeFraction: 0.58 }),
  ]),
});

// Below this the guard does not intercept at all: nine of nine attempts across the three
// directions resolved with no block and reached the body. It corroborates the band already
// recorded in engagement-spacing (RIGHT blocks 0 of 12 at 1.40m) from the other side.
export const MEASURED_GUARD_WORKING_FLOOR_METERS = 1.55;

// The gap is the finding, and it is computed rather than transcribed so that moving either end
// moves it: every separation between the body pushbox and the guard's working floor is one the
// attack reaches and the defence does not exist in.
export const UNDEFENDED_CLOSE_RANGE_BAND_METERS = Object.freeze({
  minimum: MINIMUM_ENGAGEMENT_SEPARATION_METERS,
  maximum: MEASURED_GUARD_WORKING_FLOOR_METERS,
  get widthMeters() {
    return MEASURED_GUARD_WORKING_FLOOR_METERS - MINIMUM_ENGAGEMENT_SEPARATION_METERS;
  },
  authority: 'measured-close-range-gap-no-contact-authority',
});

// Two proposals this sweep refuted, kept because the reasoning that produced them was sound and
// will be produced again by anyone looking at the same symptom.
export const CLOSE_RANGE_REFUTED = Object.freeze({
  hiltStrikeRule: Object.freeze({
    proposal: 'a swing that connects near the hilt should not cut, as in Mount & Blade or Mordhau',
    refutedBy: 'the minimum measured body-strike fraction is 0.44 at the 0.9m floor - mid-blade',
    consequence: 'the rule would never fire for this weapon; it belongs to the first polearm',
  }),
  raisedPushboxFloor: Object.freeze({
    proposal: 'raise the body pushbox to the guard working floor so close range cannot happen',
    refutedBy: 'the attack geometry is healthy across 0.9-2.4m; only the defence has a floor',
    consequence: 'it would encode one weapon\'s reach into body size and ban a sound distance',
  }),
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

// Linear read of a measured curve, clamped to its ends rather than extrapolated: outside the
// sampled range the honest answer is the nearest thing actually observed.
function interpolate(samples, separationMeters) {
  if (!samples?.length) return null;
  const at = finite(separationMeters, samples[0].separationMeters);
  if (at <= samples[0].separationMeters) return samples[0].bladeFraction;
  const last = samples[samples.length - 1];
  if (at >= last.separationMeters) return last.bladeFraction;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    if (at <= current.separationMeters) {
      const span = current.separationMeters - previous.separationMeters;
      const alpha = span > 1e-9 ? (at - previous.separationMeters) / span : 0;
      return previous.bladeFraction + (current.bladeFraction - previous.bladeFraction) * alpha;
    }
  }
  return last.bladeFraction;
}

// What the measurement says about one separation. Guidance for design work and diagnostics; it
// decides nothing about a live exchange, which the swept probe still owns outright.
export function assessCloseRangeEngagement(input = {}) {
  const direction = String(input.direction || '').toLowerCase();
  const samples = MEASURED_BODY_STRIKE_BLADE_FRACTION[direction];
  if (!samples) {
    return Object.freeze({
      stage: CLOSE_RANGE_ENGAGEMENT_STAGE,
      direction,
      known: false,
      reason: `unmeasured-direction-${direction || 'none'}`,
    });
  }
  const separationMeters = Math.max(0, finite(input.separationMeters));
  const insideGuardWorkingRange = separationMeters >= MEASURED_GUARD_WORKING_FLOOR_METERS;
  return Object.freeze({
    stage: CLOSE_RANGE_ENGAGEMENT_STAGE,
    direction,
    known: true,
    separationMeters,
    insideGuardWorkingRange,
    // Inside the undefended band the defence does not exist yet; that is a gap in the design, not
    // a property of the attack, and naming it that way is the point of this report.
    insideUndefendedBand: separationMeters >= UNDEFENDED_CLOSE_RANGE_BAND_METERS.minimum
      && separationMeters < UNDEFENDED_CLOSE_RANGE_BAND_METERS.maximum,
    expectedBodyStrikeBladeFraction: interpolate(samples, separationMeters),
    expectedShieldCatchBladeFraction: interpolate(
      MEASURED_SHIELD_CATCH_BLADE_FRACTION[direction],
      separationMeters,
    ),
    authority: 'measured-geometry-guidance-only-no-contact-authority',
  });
}
