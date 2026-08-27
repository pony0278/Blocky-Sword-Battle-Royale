export const ENGAGEMENT_SPACING_STAGE = 'R18T.1';

// R18T.1: How far apart the two fighters stand.
//
// Until now this was two hardcoded z coordinates in the lab scene, and every calibration in the
// combat set was measured against it without anyone saying so out loud: the per-direction contact
// times, the directional coverage anchors, the reach budgets, the whole question of whether a
// given attack arrives at the shield at all. They are not distance-independent facts. They are
// facts *at this distance*.
//
// Naming it is the first step to letting the fighters move. A separation this module does not
// know about is a separation nothing has been calibrated for, and the honest thing is to be able
// to say how far from calibration a given stance is.
export const CALIBRATED_ENGAGEMENT_SEPARATION_METERS = 2.3;

// R18V.1: the band the calibrations are trusted within. This replaces the placeholder that stood
// here, and it is now measured rather than assumed: it is the range over which all three attack
// directions were observed to reach the guard at least 10 times in 12, in BLOCK mode, headless,
// n=12 per cell. The per-direction detail and the full table live in guard-directional-anchor.js.
//
// It is narrower than the calibrated separation, and it does not contain it. That is not a
// mistake in the constant, it is the measurement: LEFT stops reliably reaching the guard just past
// 2.1m, so 2.3m is a distance where two directions out of three are covered. Widening this band
// means fixing LEFT, not editing this number.
export const MEASURED_FULL_COVERAGE_BAND_METERS = Object.freeze({
  minimum: 2.0,
  maximum: 2.1,
  limitedBy: 'left',
  testedRange: Object.freeze({ minimum: 2.0, maximum: 2.5 }),
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeEngagementSeparation(meters) {
  const value = finite(meters, CALIBRATED_ENGAGEMENT_SEPARATION_METERS);
  return Math.max(0.2, Math.min(8, value));
}

// Two fighters, symmetric about the origin, facing each other down the z axis. Symmetry is not
// cosmetic: every measurement taken so far assumed the midpoint between them is the origin.
export function planEngagementStance(separationMeters = CALIBRATED_ENGAGEMENT_SEPARATION_METERS) {
  const separation = normalizeEngagementSeparation(separationMeters);
  const half = separation / 2;
  return Object.freeze({
    stage: ENGAGEMENT_SPACING_STAGE,
    separationMeters: separation,
    attacker: Object.freeze({ position: Object.freeze({ x: 0, y: 0, z: -half }), facingRadians: 0 }),
    defender: Object.freeze({ position: Object.freeze({ x: 0, y: 0, z: half }), facingRadians: Math.PI }),
    calibrated: Math.abs(separation - CALIBRATED_ENGAGEMENT_SEPARATION_METERS) < 1e-6,
    offsetFromCalibrationMeters: separation - CALIBRATED_ENGAGEMENT_SEPARATION_METERS,
    authority: 'stance-geometry-only-no-contact-authority',
  });
}
