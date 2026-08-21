export const POST_COUPLING_RECOIL_STAGGER_BASE_STAGE = 'G4.3B.5R.2.1';
export const COUPLED_MOMENTUM_CONTINUATION_STAGE = 'G4.3B.5R.2.2';
export const CONTACT_RELEASE_SEPARATION_RECOIL_STAGE = 'G4.3B.5R.2.4';
// Compatibility export follows the latest post-coupling presentation authority.
export const POST_COUPLING_RECOIL_STAGGER_STAGE = CONTACT_RELEASE_SEPARATION_RECOIL_STAGE;

export const POST_COUPLING_RECOIL_STAGGER_PROFILES = Object.freeze({
  block: Object.freeze({
    outcome: 'block',
    weaponStrengthScale: 0.55,
    weaponDeflectScale: 0.68,
    torsoScale: 1.0,
    bodyStrengthScale: 1.0,
    legStrengthScale: 1.0,
    referenceDriveMeters: 0.035,
    minimumMomentum: 0.85,
    maximumMomentum: 1.10,
    separationFromCoupling: false,
    b2DirectionWeight: 1,
    couplingRedirectWeight: 0,
  }),
  parry: Object.freeze({
    outcome: 'parry',
    // G4.3B.5R.2.4 restores a readable release rebound. Coupling still owns
    // contact, but B2 regains most directional authority after separation.
    weaponStrengthScale: 0.90,
    weaponDeflectScale: 0.92,
    torsoScale: 1.16,
    bodyStrengthScale: 1.18,
    legStrengthScale: 1.12,
    referenceDriveMeters: 0.105,
    minimumMomentum: 0.95,
    maximumMomentum: 1.30,
    separationFromCoupling: true,
    b2DirectionWeight: 0.72,
    couplingRedirectWeight: 0.28,
    releaseSeparationWindowMs: 78,
    impulseEndMs: 132,
    recoilEndMs: 275,
    settleEndMs: 445,
  }),
  'perfect-parry': Object.freeze({
    outcome: 'perfect-parry',
    weaponStrengthScale: 0.95,
    weaponDeflectScale: 0.93,
    torsoScale: 1.28,
    bodyStrengthScale: 1.30,
    legStrengthScale: 1.20,
    referenceDriveMeters: 0.125,
    minimumMomentum: 1.05,
    maximumMomentum: 1.42,
    separationFromCoupling: true,
    b2DirectionWeight: 0.76,
    couplingRedirectWeight: 0.24,
    releaseSeparationWindowMs: 86,
    impulseEndMs: 148,
    recoilEndMs: 320,
    settleEndMs: 540,
  }),
});

const pendingByRig = new WeakMap();

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function vec(input = {}) {
  return { x: finite(input.x), y: finite(input.y), z: finite(input.z) };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(a, scalar) {
  return { x: a.x * scalar, y: a.y * scalar, z: a.z * scalar };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function magnitude(value = {}) {
  const v = vec(value);
  return Math.hypot(v.x, v.y, v.z);
}

function normalize(value = {}, fallback = { x: 0, y: 0, z: 0 }) {
  const v = vec(value);
  const m = magnitude(v);
  if (m > 1e-8) return Object.freeze({ x: v.x / m, y: v.y / m, z: v.z / m });
  const f = vec(fallback);
  const fm = magnitude(f);
  if (fm > 1e-8) return Object.freeze({ x: f.x / fm, y: f.y / fm, z: f.z / fm });
  return Object.freeze({ x: 0, y: 0, z: 0 });
}

function resolveOutcome(value, responseClass = '') {
  const outcome = String(value || '').toLowerCase();
  if (POST_COUPLING_RECOIL_STAGGER_PROFILES[outcome]) return outcome;
  if (responseClass === 'perfect-parry-directional-recoil') return 'perfect-parry';
  if (responseClass === 'parry-directional-recoil') return 'parry';
  return 'block';
}

export function publishPostCouplingRecoilStaggerHandoff(attackerRig, payload = {}) {
  if (!attackerRig || (typeof attackerRig !== 'object' && typeof attackerRig !== 'function')) return false;
  pendingByRig.set(attackerRig, Object.freeze({
    stage: CONTACT_RELEASE_SEPARATION_RECOIL_STAGE,
    previousStage: COUPLED_MOMENTUM_CONTINUATION_STAGE,
    baseStage: POST_COUPLING_RECOIL_STAGGER_BASE_STAGE,
    couplingReport: payload.couplingReport || payload.report || payload,
    surfaceAtContact: payload.surfaceAtContact || null,
    authority: 'shield-coupling-release-to-contact-separation-recoil',
  }));
  return true;
}

export function consumePostCouplingRecoilStaggerHandoff(attackerRig) {
  if (!attackerRig || !pendingByRig.has(attackerRig)) return null;
  const payload = pendingByRig.get(attackerRig);
  pendingByRig.delete(attackerRig);
  return payload;
}

function resolveCouplingDirection(couplingReport, fallback) {
  if (magnitude(couplingReport.attackerWeaponOffset) > 1e-6) {
    return Object.freeze({
      direction: normalize(couplingReport.attackerWeaponOffset, fallback),
      source: 'coupling-attacker-weapon-offset',
    });
  }
  if (magnitude(couplingReport.shieldTangent) > 1e-6) {
    return Object.freeze({
      direction: normalize(couplingReport.shieldTangent, fallback),
      source: 'coupling-shield-tangent',
    });
  }
  return Object.freeze({ direction: normalize(fallback), source: 'b2-fallback-direction' });
}

function resolveContactReleaseSeparationDirection(outcome, couplingReport, plan, profile) {
  const b2Direction = normalize(plan.weapon?.direction);
  if (outcome === 'block' || profile.separationFromCoupling !== true) {
    return Object.freeze({
      direction: b2Direction,
      source: 'b2-block-recoil-direction',
      b2Direction,
      couplingDirection: null,
      couplingSource: null,
      b2Alignment: 1,
      couplingAlignment: null,
    });
  }

  const coupling = resolveCouplingDirection(couplingReport, b2Direction);
  if (coupling.source === 'b2-fallback-direction') {
    return Object.freeze({
      direction: b2Direction,
      source: 'contact-release-b2-fallback',
      b2Direction,
      couplingDirection: null,
      couplingSource: coupling.source,
      b2Alignment: 1,
      couplingAlignment: null,
    });
  }

  const b2Weight = clamp(profile.b2DirectionWeight, 0, 1);
  const couplingWeight = clamp(profile.couplingRedirectWeight, 0, 1);
  const mixed = add(scale(b2Direction, b2Weight), scale(coupling.direction, couplingWeight));
  const direction = normalize(mixed, b2Direction);

  return Object.freeze({
    direction,
    source: 'contact-release-b2-shield-blend',
    b2Direction,
    couplingDirection: coupling.direction,
    couplingSource: coupling.source,
    b2Alignment: dot(direction, b2Direction),
    couplingAlignment: dot(direction, coupling.direction),
  });
}

export function buildPostCouplingRecoilStaggerHandoff(input = {}) {
  const plan = input.plan;
  const couplingReport = input.couplingReport || input.report || {};
  const baseProfile = input.baseProfile || {};
  if (!plan?.planned) {
    return Object.freeze({
      stage: CONTACT_RELEASE_SEPARATION_RECOIL_STAGE,
      accepted: false,
      reason: 'missing-recoil-plan',
    });
  }

  const outcome = resolveOutcome(couplingReport.outcome, plan.responseClass);
  const profile = POST_COUPLING_RECOIL_STAGGER_PROFILES[outcome];
  const plannedDriveMeters = magnitude(couplingReport.shieldOffset);
  const weaponFollowMeters = magnitude(couplingReport.attackerWeaponOffset);
  const surfaceAtContact = input.surfaceAtContact?.center || input.surfaceAtContact || null;
  const finalSurface = couplingReport.finalSurface?.center || null;
  const achievedDriveMeters = surfaceAtContact && finalSurface
    ? magnitude(sub(vec(finalSurface), vec(surfaceAtContact)))
    : plannedDriveMeters;
  const driveMeters = Math.max(plannedDriveMeters, achievedDriveMeters);
  const durationSeconds = Math.max(0.001, finite(couplingReport.elapsedMs, couplingReport.profile?.durationMs || 1) / 1000);
  const driveSpeedMps = driveMeters / durationSeconds;
  const weaponFollowSpeedMps = weaponFollowMeters / durationSeconds;
  const referenceDriveMeters = Math.max(0.001, finite(profile.referenceDriveMeters, 0.1));
  const referenceSpeedMps = referenceDriveMeters / durationSeconds;
  const driveRatio = clamp(driveMeters / referenceDriveMeters, 0, 1.8);
  const followRatio = clamp(weaponFollowMeters / referenceDriveMeters, 0, 1.8);
  const speedRatio = clamp(driveSpeedMps / Math.max(0.01, referenceSpeedMps), 0, 1.8);
  const rawMomentum = 0.58 + driveRatio * 0.24 + followRatio * 0.10 + speedRatio * 0.18;
  const momentum = clamp(rawMomentum, profile.minimumMomentum, profile.maximumMomentum);
  const separation = resolveContactReleaseSeparationDirection(outcome, couplingReport, plan, profile);
  // Coupling magnitude still influences the residual magnitude, but release
  // direction is no longer allowed to inherit shield travel as sole authority.
  const weaponMomentum = profile.separationFromCoupling
    ? clamp(0.92 + momentum * 0.10, 0.98, 1.08)
    : 1;

  const weapon = Object.freeze({
    ...(plan.weapon || {}),
    direction: separation.direction,
    strength: finite(plan.weapon?.strength) * profile.weaponStrengthScale * weaponMomentum,
    deflectDegrees: finite(plan.weapon?.deflectDegrees) * profile.weaponDeflectScale * weaponMomentum,
    continuationSource: separation.source,
    separationSource: separation.source,
  });
  const bodyScale = profile.torsoScale * momentum;
  const body = Object.freeze({
    ...(plan.body || {}),
    strength: finite(plan.body?.strength) * profile.bodyStrengthScale * momentum,
    yawDegrees: finite(plan.body?.yawDegrees) * bodyScale,
    pitchDegrees: finite(plan.body?.pitchDegrees) * bodyScale,
    rollDegrees: finite(plan.body?.rollDegrees) * bodyScale,
  });
  const transformedPlan = Object.freeze({
    ...plan,
    weapon,
    body,
    postCouplingStage: CONTACT_RELEASE_SEPARATION_RECOIL_STAGE,
  });

  const profileOverrides = {
    legStrengthScale: clamp(finite(baseProfile.legStrengthScale, 1) * profile.legStrengthScale, 0, 1.5),
  };
  if (profile.impulseEndMs) profileOverrides.impulseEndMs = profile.impulseEndMs;
  if (profile.recoilEndMs) profileOverrides.recoilEndMs = profile.recoilEndMs;
  if (profile.settleEndMs) profileOverrides.settleEndMs = profile.settleEndMs;

  return Object.freeze({
    stage: CONTACT_RELEASE_SEPARATION_RECOIL_STAGE,
    previousStage: COUPLED_MOMENTUM_CONTINUATION_STAGE,
    baseStage: POST_COUPLING_RECOIL_STAGGER_BASE_STAGE,
    accepted: true,
    reason: outcome === 'block'
      ? 'post-coupling-body-stagger-ready'
      : 'contact-release-separation-recoil-ready',
    outcome,
    initialElapsedMs: Math.max(0, finite(baseProfile.contactHoldMs)),
    plan: transformedPlan,
    profileOverrides: Object.freeze(profileOverrides),
    separation: Object.freeze({
      direction: separation.direction,
      source: separation.source,
      b2Direction: separation.b2Direction,
      couplingDirection: separation.couplingDirection,
      couplingSource: separation.couplingSource,
      b2Alignment: separation.b2Alignment,
      couplingAlignment: separation.couplingAlignment,
      releaseWindowMs: finite(profile.releaseSeparationWindowMs),
      weaponMomentum,
    }),
    // Compatibility shape retained for existing lab/HUD readers.
    continuation: Object.freeze({
      direction: separation.direction,
      source: separation.source,
      weaponMomentum,
    }),
    couplingMomentum: Object.freeze({
      plannedDriveMeters,
      achievedDriveMeters,
      driveMeters,
      weaponFollowMeters,
      driveSpeedMps,
      weaponFollowSpeedMps,
      momentum,
    }),
    channelIntent: Object.freeze({
      weapon: profile.separationFromCoupling
        ? 'contact-release-separation-impulse-then-directional-recoil'
        : 'short-block-bounce',
      shoulder: profile.separationFromCoupling
        ? 'separation-recoil-pulls-shoulder-before-body'
        : 'block-impact-arm-response',
      torso: 'post-coupling-inertia',
      hipsAndLegs: 'stagger-and-balance-recovery',
    }),
    timelineIntent: profile.separationFromCoupling
      ? Object.freeze({
          releaseSeparationWindowMs: finite(profile.releaseSeparationWindowMs),
          weaponAndShoulderImpulseEndMs: profile.impulseEndMs - Math.max(0, finite(baseProfile.contactHoldMs)),
          torsoAndHipsEndMs: profile.recoilEndMs - Math.max(0, finite(baseProfile.contactHoldMs)),
          fullRecoveryEndMs: profile.settleEndMs - Math.max(0, finite(baseProfile.contactHoldMs)),
        })
      : null,
    authority: 'contact-release-separation-recoil-presentation-handoff',
  });
}
