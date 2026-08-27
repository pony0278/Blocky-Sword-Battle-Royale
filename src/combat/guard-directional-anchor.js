import { CALIBRATED_ENGAGEMENT_SEPARATION_METERS } from './engagement-spacing.js';

export const GUARD_DIRECTIONAL_ANCHOR_STAGE = 'R18R.5';

// R18R.5: Where a given attack direction actually arrives, in the shield's own frame.
//
// Measured, not assumed. Each entry is the offset from the neutral (un-tracked) buckler centre to
// the blade's closest approach at the frame of minimum measured gap, resolved into the shield's
// right/up axes (right = up x normal). Captured headlessly per direction against the R281 lab:
//   top   arrives 0.19m across, level, 0.01m short  - already inside the disc, no correction needed
//   right arrives 0.12m across, 0.21m down, 0.05m short - a few centimetres of correction
//   left  arrives 0.23m across, 0.43m down, 0.08m short - a genuine low sweep, and the reason a
//                                            high guard that only tracks a prediction never met it
// `forward` is along the shield normal and matters more than its size suggests: a guard that is
// laterally perfect but centimetres off in depth passes straight through the swing without
// touching it.
// These are direction-level coverage, deliberately coarse: they say where to be before the swing
// commits to its final arc, which is the only thing a defender can know that early. The predicted
// threat refines them once it is credible, and the measured sweep replaces them once the blade is
// close enough to measure. These anchors were measured at one
// separation and they do not hold at every separation; GUARD_DIRECTIONAL_ANCHOR_CALIBRATION below
// records which one, and how far from it they were verified to carry.
export const GUARD_DIRECTIONAL_COVERAGE_ANCHORS = Object.freeze({
  top: Object.freeze({ right: -0.19, up: 0.03, forward: -0.01 }),
  right: Object.freeze({ right: -0.12, up: -0.21, forward: -0.05 }),
  left: Object.freeze({ right: -0.23, up: -0.43, forward: -0.08 }),
});

// R18V.1: what the anchors above are actually worth, and where.
//
// The anchors were measured at one actor separation, and every downstream compensation that leans
// on them - the tracking servo's travel budget, the residual, the planted crouch - was tuned at
// that same separation. Nothing in the code said so. The binding lived in a comment, so moving the
// actors apart silently invalidated a stack of numbers with no signal at all. `measuredAtMeters`
// is imported rather than typed, so it cannot drift out of step: change the calibrated separation
// and the anchor tests fail until these are re-measured.
//
// `verifiedCoverage` is the separate and harder question - not where the anchors were measured,
// but how far from there the guard still meets the blade. Measured in BLOCK mode, headless, idle
// machine, n=12 per cell, counting shield contact:
//
//         2.00m   2.10m   2.20m   2.30m   2.35m   2.40m   2.50m
//   top   12/12   12/12   12/12   12/12     -     12/12   12/12
//   right 12/12   12/12   12/12   11/12     -     12/12   12/12
//   left  12/12   10/12    5/12    3/12    0/12    0/12    0/12
//
// TOP and RIGHT arrive close enough to where the guard already rests that distance barely matters
// across the tested range. LEFT is a genuine low sweep the guard has to travel to reach, and its
// travel budget runs out just past 2.1m. Note what that means for the calibrated separation: LEFT
// is already outside its own verified band there, blocking 3 times in 12. An earlier small-sample
// reading (6/6) said otherwise and was wrong; the same 3-5/12 shows on the commit before the body
// hurtbox, so this is standing behaviour rather than a regression.
export const GUARD_DIRECTIONAL_ANCHOR_CALIBRATION = Object.freeze({
  stage: 'R18V.1',
  measuredAtMeters: CALIBRATED_ENGAGEMENT_SEPARATION_METERS,
  // The separation band over which the anchored guard was measured to meet that direction's blade
  // at least 10 times in 12. Both bounds are measured, not extrapolated: outside the tested
  // 2.00-2.50m range these say nothing at all.
  verifiedCoverage: Object.freeze({
    top: Object.freeze({ fromMeters: 2.0, toMeters: 2.5 }),
    right: Object.freeze({ fromMeters: 2.0, toMeters: 2.5 }),
    left: Object.freeze({ fromMeters: 2.0, toMeters: 2.1 }),
  }),
  testedRange: Object.freeze({ fromMeters: 2.0, toMeters: 2.5 }),
});

// Answers one question for a caller that knows the live separation: is this direction's anchor,
// and the stack of compensations tuned alongside it, still inside the range where it was measured
// to work? It deliberately does not correct the anchor for distance. The drift is real - LEFT's
// arrival point moves roughly 0.7m in depth per metre of separation - but no correction has been
// measured, and a guessed one is worse than a caller that knows it is outside the band.
export function assessGuardAnchorCoverage(input = {}) {
  const direction = String(input.direction || '').toLowerCase();
  const band = GUARD_DIRECTIONAL_ANCHOR_CALIBRATION.verifiedCoverage[direction] || null;
  const raw = Number(input.separationMeters);
  const known = Number.isFinite(raw);
  const tested = GUARD_DIRECTIONAL_ANCHOR_CALIBRATION.testedRange;
  const beyondTestedRange = known && (raw < tested.fromMeters || raw > tested.toMeters);
  const deltaFromMeasuredMeters = known
    ? raw - GUARD_DIRECTIONAL_ANCHOR_CALIBRATION.measuredAtMeters
    : null;
  if (!band || !known) {
    return Object.freeze({
      stage: GUARD_DIRECTIONAL_ANCHOR_CALIBRATION.stage,
      direction: direction || null,
      separationMeters: known ? raw : null,
      band,
      verified: false,
      reason: band ? 'unknown-separation' : 'unknown-direction',
      deltaFromMeasuredMeters,
      beyondTestedRange,
    });
  }
  const verified = raw >= band.fromMeters && raw <= band.toMeters;
  return Object.freeze({
    stage: GUARD_DIRECTIONAL_ANCHOR_CALIBRATION.stage,
    direction,
    separationMeters: raw,
    band,
    verified,
    reason: verified
      ? 'within-verified-band'
      : (raw > band.toMeters ? 'beyond-verified-reach' : 'closer-than-verified-band'),
    deltaFromMeasuredMeters,
    beyondTestedRange,
  });
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function vec(input) {
  return { x: finite(input?.x), y: finite(input?.y), z: finite(input?.z) };
}

function cross(a, b) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function normalize(value) {
  const magnitude = Math.hypot(value.x, value.y, value.z);
  return magnitude > 1e-9
    ? { x: value.x / magnitude, y: value.y / magnitude, z: value.z / magnitude }
    : { x: 0, y: 0, z: 0 };
}

export function getGuardDirectionalAnchor(direction) {
  return GUARD_DIRECTIONAL_COVERAGE_ANCHORS[String(direction || '').toLowerCase()] || null;
}

export function resolveGuardDirectionalAnchorPoint(input = {}) {
  const anchor = input.anchor || getGuardDirectionalAnchor(input.direction);
  const surface = input.bucklerSurface;
  if (!anchor || !surface?.center) return null;
  const forward = normalize(vec(surface.normal));
  if (!(Math.hypot(forward.x, forward.y, forward.z) > 0)) return null;
  const right = normalize(cross({ x: 0, y: 1, z: 0 }, forward));
  const up = normalize(cross(forward, right));
  const center = vec(surface.center);
  return Object.freeze({
    x: center.x + right.x * anchor.right + up.x * anchor.up + forward.x * finite(anchor.forward),
    y: center.y + right.y * anchor.right + up.y * anchor.up + forward.y * finite(anchor.forward),
    z: center.z + right.z * anchor.right + up.z * anchor.up + forward.z * finite(anchor.forward),
  });
}

export function buildGuardDirectionalAnchorThreat(input = {}) {
  const point = resolveGuardDirectionalAnchorPoint(input);
  if (!point) return null;
  const surface = input.bucklerSurface;
  const center = vec(surface.center);
  return Object.freeze({
    stage: GUARD_DIRECTIONAL_ANCHOR_STAGE,
    selection: 'directional-anchor',
    direction: String(input.direction || '').toLowerCase() || null,
    point,
    worldPoint: point,
    signedDistance: 0,
    radialDistance: Math.hypot(point.x - center.x, point.y - center.y, point.z - center.z),
    outsideDisc: 0,
    futureSeconds: 0,
    surface,
    authority: 'direction-level-coverage-guidance-no-contact-authority',
  });
}
