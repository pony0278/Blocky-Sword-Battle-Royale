export const TWO_ACTOR_WHOLE_BODY_RECOIL_BURST_STAGE = 'G4.3B.5R.2.7';

export const TWO_ACTOR_WHOLE_BODY_RECOIL_BURST_PROFILES = Object.freeze({
  parry: Object.freeze({
    outcome: 'parry',
    initialElapsedMs: 68,
    releaseSeparationWindowMs: 0,
    releaseSeparationDistanceMeters: 0,
    weaponStrengthScale: 1.00,
    weaponDeflectScale: 1.00,
    bodyStrengthScale: 1.16,
    yawScale: 1.08,
    rollScale: 1.08,
    minimumPlanBackwardPitchDegrees: 25,
    pitchAmplification: 2.20,
    legStrengthScale: 1.45,
    impulseEndMs: 112,
    recoilEndMs: 245,
    settleEndMs: 420,
  }),
  'perfect-parry': Object.freeze({
    outcome: 'perfect-parry',
    initialElapsedMs: 76,
    releaseSeparationWindowMs: 0,
    releaseSeparationDistanceMeters: 0,
    weaponStrengthScale: 1.04,
    weaponDeflectScale: 1.03,
    bodyStrengthScale: 1.28,
    yawScale: 1.12,
    rollScale: 1.12,
    minimumPlanBackwardPitchDegrees: 33,
    pitchAmplification: 2.35,
    legStrengthScale: 1.50,
    impulseEndMs: 126,
    recoilEndMs: 295,
    settleEndMs: 520,
  }),
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function resolveOutcome(value, responseClass = '') {
  const explicit = String(value || '').toLowerCase();
  if (TWO_ACTOR_WHOLE_BODY_RECOIL_BURST_PROFILES[explicit]) return explicit;
  if (responseClass === 'perfect-parry-directional-recoil') return 'perfect-parry';
  if (responseClass === 'parry-directional-recoil') return 'parry';
  return null;
}

export function buildTwoActorWholeBodyRecoilBurst(input = {}) {
  const plan = input.plan;
  const outcome = resolveOutcome(input.outcome, plan?.responseClass);
  const profile = TWO_ACTOR_WHOLE_BODY_RECOIL_BURST_PROFILES[outcome];
  if (!profile || !plan?.planned) {
    return Object.freeze({
      stage: TWO_ACTOR_WHOLE_BODY_RECOIL_BURST_STAGE,
      accepted: false,
      reason: !profile ? 'non-parry-outcome' : 'missing-recoil-plan',
    });
  }

  const momentum = clamp(input.momentum, 0.75, 1.5);
  const weaponMomentum = clamp(input.weaponMomentum, 0.90, 1.12);
  const releaseDirection = input.releaseDirection || plan.weapon?.direction;
  const sourcePitch = Math.abs(finite(plan.body?.pitchDegrees));
  const backwardPitchDegrees = Math.max(
    profile.minimumPlanBackwardPitchDegrees,
    sourcePitch * profile.pitchAmplification * momentum,
  );

  const weapon = Object.freeze({
    ...(plan.weapon || {}),
    direction: releaseDirection,
    strength: finite(plan.weapon?.strength) * profile.weaponStrengthScale * weaponMomentum,
    deflectDegrees: finite(plan.weapon?.deflectDegrees) * profile.weaponDeflectScale * weaponMomentum,
    continuationSource: 'two-actor-whole-body-release-burst',
    separationSource: 'shield-contact-release-power-frame',
  });

  const body = Object.freeze({
    ...(plan.body || {}),
    strength: finite(plan.body?.strength) * profile.bodyStrengthScale * momentum,
    yawDegrees: finite(plan.body?.yawDegrees) * profile.yawScale * momentum,
    pitchDegrees: -backwardPitchDegrees,
    rollDegrees: finite(plan.body?.rollDegrees) * profile.rollScale * momentum,
  });

  const transformedPlan = Object.freeze({
    ...plan,
    weapon,
    body,
    postCouplingStage: TWO_ACTOR_WHOLE_BODY_RECOIL_BURST_STAGE,
  });

  return Object.freeze({
    stage: TWO_ACTOR_WHOLE_BODY_RECOIL_BURST_STAGE,
    accepted: true,
    reason: 'two-actor-whole-body-recoil-burst-ready',
    outcome,
    plan: transformedPlan,
    initialElapsedMs: profile.initialElapsedMs,
    profileOverrides: Object.freeze({
      releaseSeparationWindowMs: profile.releaseSeparationWindowMs,
      releaseSeparationDistanceMeters: profile.releaseSeparationDistanceMeters,
      impulseEndMs: profile.impulseEndMs,
      recoilEndMs: profile.recoilEndMs,
      settleEndMs: profile.settleEndMs,
      legStrengthScale: profile.legStrengthScale,
    }),
    powerFrame: Object.freeze({
      entryElapsedMs: profile.initialElapsedMs,
      impulseEndMs: profile.impulseEndMs,
      separationBypassed: true,
      oldTwoActorArmAuthorityRestored: true,
      parentChainFreeArmMotion: true,
      minimumChestBackwardDegreesAtFullTorsoWeight: backwardPitchDegrees * 0.46,
    }),
    rootMotion: false,
    authority: 'old-two-actor-b3-whole-body-impulse-at-shield-contact-release',
  });
}
