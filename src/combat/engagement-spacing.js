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
// R18X.2: 1.55m, and it is the only distance that satisfies both measurements below at once.
// The guard becomes fully reliable here and no closer; all three attacks stop reaching the body
// here and no further. It was 2.3m, which is a distance at which two of the three directions
// cannot touch the defender at all - a fight that could not be lost and therefore could not be
// won. Note that the two constraints meet at a point rather than over a band, so this default has
// no slack in either direction. Widening it is a content question (how far the attacks travel),
// not a tuning one.
export const CALIBRATED_ENGAGEMENT_SEPARATION_METERS = 1.55;

// R18X.1: the band the calibrations are trusted within - the range over which all three attack
// directions were measured to reach the guard at least 10 times in 12, in BLOCK mode, headless.
// The per-direction detail and the full table live in guard-directional-anchor.js.
//
// It still does not contain the calibrated separation, and still for a measured reason rather than
// a mistake in the constant: LEFT stops clearing the bar past 2.05m. What changed is the bottom.
// Before the swept contact test followed the blade's arc this read 2.00-2.10m, and everything
// below 2.00m was simply unswept; the arc fix cleared 1.50-2.05m and the sweep went down to 1.40m.
export const MEASURED_FULL_COVERAGE_BAND_METERS = Object.freeze({
  minimum: 1.55,
  maximum: 2.05,
  // Different directions set the two ends, which is the whole reason this is not one number.
  limitedBy: Object.freeze({ minimum: 'right', maximum: 'left' }),
  testedRange: Object.freeze({ minimum: 1.4, maximum: 2.5 }),
});

// R18X.1: the other half of what a separation means - not whether the guard can reach the blade,
// but whether the blade would have reached anything. Measured the only honest way, by freezing the
// guard's tracking entirely so a miss is guaranteed, then asking whether the body hurtbox is
// struck. Per direction, the furthest separation at which an unopposed attack still lands:
//
//   top    1.55m       right  1.55m       left   2.05m
//
// Beyond its entry here a direction is theatre: the swing finishes short of the defender and it
// makes no difference whether the guard met it. LEFT reaches the knees and waist from over two
// metres, which is why it is the direction that has driven every guard problem in this codebase.
//
// Read this against MEASURED_FULL_COVERAGE_BAND_METERS and the useful distance is narrow. The
// guard is fully reliable from 1.55m out; all three attacks land from 1.55m in. They meet at a
// point rather than over a band. Between 1.60m and 2.05m only LEFT is a real threat, and closer
// than 1.50m the guard starts failing outright - RIGHT blocks 0 of 12 at 1.40m, and every miss in
// that range reaches the body.
export const MEASURED_UNDEFENDED_BODY_REACH_METERS = Object.freeze({
  top: 1.55,
  right: 1.55,
  left: 2.05,
  testedRange: Object.freeze({ minimum: 1.4, maximum: 2.5 }),
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
