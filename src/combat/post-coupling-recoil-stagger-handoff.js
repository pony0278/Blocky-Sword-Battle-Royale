export const POST_COUPLING_RECOIL_STAGGER_BASE_STAGE = 'G4.3B.5R.2.1';
export const COUPLED_MOMENTUM_CONTINUATION_STAGE = 'G4.3B.5R.2.2';
// Compatibility export used by B3 and earlier tests; authority is now B.5R.2.2.
export const POST_COUPLING_RECOIL_STAGGER_STAGE = COUPLED_MOMENTUM_CONTINUATION_STAGE;

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
    continuationFromCoupling: false,
  }),
  parry: Object.freeze({
    outcome: 'parry',
    // Preserve most of the old Parry weapon inertia, but inherit direction from
    // the shield-driven displacement so this reads as continuation, not a second bounce.
    weaponStrengthScale: 0.70,
    weaponDeflectScale: 0.70,
    torsoScale: 1.16,
    bodyStrengthScale: 1.18,
    legStrengthScale: 1.12,
    referenceDriveMeters: 0.105,
    minimumMomentum: 0.95,
    maximumMomentum: 1.30,
    continuationFromCoupling: true,
    impulseEndMs: 118,
    recoilEndMs: 260,
    settleEndMs: 430,
  }),
  'perfect-parry': Object.freeze({
    outcome: 'perfect-parry',
    weaponStrengthScale: 0.70,
    weaponDeflectScale: 0.66,
    torsoScale: 1.28,
    bodyStrengthScale: 1.30,
    legStrengthScale: 1.20,
    referenceDriveMeters: 0.125,
    minimumMomentum: 1.05,
    maximumMomentum: 1.42,
    continuationFromCoupling: true,
    impulseEndMs: 130,
    recoilEndMs: 300,
    settleEndMs: 520,
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

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
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
    stage: COUPLED_MOMENTUM_CONTINUATION_STAGE,
    baseStage: POST_COUPLING_RECOIL_STAGGER_BASE_STAGE,
    couplingReport: payload.couplingReport || payload.report || payload,
    surfaceAtContact: payload.surfaceAtContact || null,
    authority: 'shield-coupling-release-to-coupled-momentum-continuation',
  }));
  return true;
}

export function consumePostCouplingRecoilStaggerHandoff(attackerRig) {
  if (!attackerRig || !pendingByRig.has(attackerRig)) return null;
  const payload = pendingByRig.get(attackerRig);
  pendingByRig.delete(attackerRig);
  return payload;
}

function resolveContinuationDirection(outcome, couplingReport, plan) {
  if (outcome === 'block') {
    return Object.freeze({
      direction: normalize(plan.weapon?.direction),
      source: 'b2-block-recoil-direction',
    });
  }
  const weaponOffset = couplingReport.attackerWeaponOffset;
  if (magnitude(weaponOffset) > 1e-6) {
    return Object.freeze({
      direction: normalize(weaponOffset, plan.weapon?.direction),
      source: 'coupling-attacker-weapon-offset',
    });
  }
  const shieldTangent = couplingReport.shieldTangent;
  if (magnitude(shieldTangent) > 1e-6) {
    return Object.freeze({
      direction: normalize(shieldTangent, plan.weapon?.direction),
      source: 'coupling-shield-tangent',
    });
  }
  return Object.freeze({
    direction: normalize(plan.weapon?.direction),
    source: 'b2-fallback-direction',
  });
}

export function buildPostCouplingRecoilStaggerHandoff(input = {}) {
  const plan = input.plan;
  const couplingReport = input.couplingReport || input.report || {};
  const baseProfile = input.baseProfile || {};
  if (!plan?.planned) {
    return Object.freeze({
      stage: COUPLED_MOMENTUM_CONTINUATION_STAGE,
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
  const continuation = resolveContinuationDirection(outcome, couplingReport, plan);
  // Coupling magnitude influences residual weapon motion gently; it must remain
  // clearly above Block without restoring the old independent full-strength bounce.
  const weaponMomentum = profile.continuationFromCoupling
    ? clamp(0.88 + momentum * 0.12, 0.95, 1.08)
    : 1;

  const weapon = Object.freeze({
    ...(plan.weapon || {}),
    direction: continuation.direction,
    strength: finite(plan.weapon?.strength) * profile.weaponStrengthScale * weaponMomentum,
    deflectDegrees: finite(plan.weapon?.deflectDegrees) * profile.weaponDeflectScale * weaponMomentum,
    continuationSource: continuation.source,
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
    postCouplingStage: COUPLED_MOMENTUM_CONTINUATION_STAGE,
  });

  const profileOverrides = {
    legStrengthScale: clamp(finite(baseProfile.legStrengthScale, 1) * profile.legStrengthScale, 0, 1.5),
  };
  if (profile.impulseEndMs) profileOverrides.impulseEndMs = profile.impulseEndMs;
  if (profile.recoilEndMs) profileOverrides.recoilEndMs = profile.recoilEndMs;
  if (profile.settleEndMs) profileOverrides.settleEndMs = profile.settleEndMs;

  return Object.freeze({
    stage: COUPLED_MOMENTUM_CONTINUATION_STAGE,
    baseStage: POST_COUPLING_RECOIL_STAGGER_BASE_STAGE,
    accepted: true,
    reason: outcome === 'block'
      ? 'post-coupling-body-stagger-ready'
      : 'coupled-momentum-continuation-ready',
    outcome,
    initialElapsedMs: Math.max(0, finite(baseProfile.contactHoldMs)),
    plan: transformedPlan,
    profileOverrides: Object.freeze(profileOverrides),
    continuation: Object.freeze({
      direction: continuation.direction,
      source: continuation.source,
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
      weapon: profile.continuationFromCoupling
        ? 'residual-inertia-continues-along-shield-driven-direction'
        : 'short-block-bounce',
      shoulder: profile.continuationFromCoupling
        ? 'weapon-inertia-pulls-shoulder-before-body'
        : 'block-impact-arm-response',
      torso: 'post-coupling-inertia',
      hipsAndLegs: 'stagger-and-balance-recovery',
    }),
    timelineIntent: profile.continuationFromCoupling
      ? Object.freeze({
          residualWeaponAndShoulderEndMs: profile.impulseEndMs - Math.max(0, finite(baseProfile.contactHoldMs)),
          torsoAndHipsEndMs: profile.recoilEndMs - Math.max(0, finite(baseProfile.contactHoldMs)),
          fullRecoveryEndMs: profile.settleEndMs - Math.max(0, finite(baseProfile.contactHoldMs)),
        })
      : null,
    authority: 'coupled-momentum-continuation-presentation-handoff',
  });
}
