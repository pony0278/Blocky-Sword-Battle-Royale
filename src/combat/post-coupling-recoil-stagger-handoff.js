export const POST_COUPLING_RECOIL_STAGGER_STAGE = 'G4.3B.5R.2.1';

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
  }),
  parry: Object.freeze({
    outcome: 'parry',
    weaponStrengthScale: 0.26,
    weaponDeflectScale: 0.34,
    torsoScale: 1.32,
    bodyStrengthScale: 1.38,
    legStrengthScale: 1.24,
    referenceDriveMeters: 0.105,
    minimumMomentum: 0.95,
    maximumMomentum: 1.38,
  }),
  'perfect-parry': Object.freeze({
    outcome: 'perfect-parry',
    weaponStrengthScale: 0.22,
    weaponDeflectScale: 0.30,
    torsoScale: 1.48,
    bodyStrengthScale: 1.55,
    legStrengthScale: 1.34,
    referenceDriveMeters: 0.125,
    minimumMomentum: 1.05,
    maximumMomentum: 1.48,
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
    stage: POST_COUPLING_RECOIL_STAGGER_STAGE,
    couplingReport: payload.couplingReport || payload.report || payload,
    surfaceAtContact: payload.surfaceAtContact || null,
    authority: 'shield-coupling-release-to-attacker-body-stagger',
  }));
  return true;
}

export function consumePostCouplingRecoilStaggerHandoff(attackerRig) {
  if (!attackerRig || !pendingByRig.has(attackerRig)) return null;
  const payload = pendingByRig.get(attackerRig);
  pendingByRig.delete(attackerRig);
  return payload;
}

export function buildPostCouplingRecoilStaggerHandoff(input = {}) {
  const plan = input.plan;
  const couplingReport = input.couplingReport || input.report || {};
  const baseProfile = input.baseProfile || {};
  if (!plan?.planned) {
    return Object.freeze({
      stage: POST_COUPLING_RECOIL_STAGGER_STAGE,
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

  const weapon = Object.freeze({
    ...(plan.weapon || {}),
    strength: finite(plan.weapon?.strength) * profile.weaponStrengthScale,
    deflectDegrees: finite(plan.weapon?.deflectDegrees) * profile.weaponDeflectScale,
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
    postCouplingStage: POST_COUPLING_RECOIL_STAGGER_STAGE,
  });

  return Object.freeze({
    stage: POST_COUPLING_RECOIL_STAGGER_STAGE,
    accepted: true,
    reason: 'post-coupling-body-stagger-ready',
    outcome,
    initialElapsedMs: Math.max(0, finite(baseProfile.contactHoldMs)),
    plan: transformedPlan,
    profileOverrides: Object.freeze({
      legStrengthScale: clamp(finite(baseProfile.legStrengthScale, 1) * profile.legStrengthScale, 0, 1.5),
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
      weapon: 'reduced-after-shield-driven-deflection',
      torso: 'primary-post-coupling-inertia',
      hipsAndLegs: 'primary-stagger-and-balance-recovery',
    }),
    authority: 'post-coupling-recoil-stagger-presentation-handoff',
  });
}
