import {
  getGuardThreatTrackingProfile,
  planGuardThreatCorrection,
  predictGuardThreat,
} from './guard-threat-tracking.js';
import {
  GUARD_REACTION_VARIANTS,
  getGuardReactionProfile,
} from './guard-reaction-presentation.js';
import { applyGuardQuaternionOffsetsWeighted } from './longsword-guard-correction.js';
import { LONGSWORD_GUARD_AUTHORING_STATE } from './longsword-guard-metadata.js';

export const PREDICTIVE_INTERCEPT_PARRY_STAGE = 'G4.3B.5R';

export const PREDICTIVE_PARRY_INPUT_GRADES = Object.freeze({
  TOO_EARLY: 'too-early',
  EARLY: 'early-parry',
  PERFECT: 'perfect-parry',
  LATE: 'late-parry',
  TOO_LATE: 'too-late',
});

export const PREDICTIVE_INTERCEPT_PARRY_PROFILE = Object.freeze({
  detectionHorizonSeconds: 0.30,
  planeCaptureMeters: 0.055,
  normalTriggerTtcSeconds: 0.135,
  perfectTriggerTtcSeconds: 0.065,
  minimumTriggerTtcSeconds: 0.025,
  earlyWindowEndSeconds: 0.24,
  perfectWindowStartSeconds: 0.07,
  perfectWindowEndSeconds: 0.14,
  lateWindowStartSeconds: 0.03,
  presentationStartSourceSeconds: 0.205,
  interceptSourceSeconds: 0.36,
  authority: 'predictive-presentation-and-tracking-only-until-authoritative-contact',
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function freeze(value) {
  return Object.freeze(value);
}

export function classifyPredictiveParryTiming(timeToContactSeconds, overrides = {}) {
  const profile = { ...PREDICTIVE_INTERCEPT_PARRY_PROFILE, ...overrides };
  const ttc = Math.max(0, finite(timeToContactSeconds, Infinity));
  if (!Number.isFinite(ttc) || ttc > profile.earlyWindowEndSeconds) {
    return PREDICTIVE_PARRY_INPUT_GRADES.TOO_EARLY;
  }
  if (ttc >= profile.perfectWindowStartSeconds && ttc <= profile.perfectWindowEndSeconds) {
    return PREDICTIVE_PARRY_INPUT_GRADES.PERFECT;
  }
  if (ttc > profile.perfectWindowEndSeconds) return PREDICTIVE_PARRY_INPUT_GRADES.EARLY;
  if (ttc >= profile.lateWindowStartSeconds) return PREDICTIVE_PARRY_INPUT_GRADES.LATE;
  return PREDICTIVE_PARRY_INPUT_GRADES.TOO_LATE;
}

export function getPredictiveParryTriggerTtcSeconds(requestedGrade = 'parry', overrides = {}) {
  const profile = { ...PREDICTIVE_INTERCEPT_PARRY_PROFILE, ...overrides };
  return String(requestedGrade || '').toLowerCase() === 'perfect'
    ? profile.perfectTriggerTtcSeconds
    : profile.normalTriggerTtcSeconds;
}

export function analyzePredictiveInterceptParry(input = {}) {
  const profile = { ...PREDICTIVE_INTERCEPT_PARRY_PROFILE, ...(input.profile || {}) };
  if (!input.previousBlade || !input.currentBlade || !input.bucklerSurface) {
    return freeze({
      stage: PREDICTIVE_INTERCEPT_PARRY_STAGE,
      available: false,
      reason: 'missing-predictive-geometry',
      threat: null,
      trackingPlan: null,
      shouldTrigger: false,
      authority: profile.authority,
    });
  }

  const threat = predictGuardThreat({
    previousBlade: input.previousBlade,
    currentBlade: input.currentBlade,
    bucklerSurface: input.bucklerSurface,
    deltaSeconds: input.deltaSeconds,
    horizonSeconds: profile.detectionHorizonSeconds,
    timeSamples: input.timeSamples || 24,
  });

  if (!threat) {
    return freeze({
      stage: PREDICTIVE_INTERCEPT_PARRY_STAGE,
      available: false,
      reason: 'no-predicted-threat',
      threat: null,
      trackingPlan: null,
      shouldTrigger: false,
      authority: profile.authority,
    });
  }

  const trackingPlan = planGuardThreatCorrection({
    mode: 'parry',
    threat,
    bucklerSurface: input.bucklerSurface,
  });
  const ttc = Math.max(0, finite(threat.futureSeconds));
  const requestedGrade = String(input.requestedGrade || 'parry').toLowerCase();
  const triggerTtcSeconds = getPredictiveParryTriggerTtcSeconds(requestedGrade, profile);
  const planeCapturable = Math.abs(finite(threat.signedDistance)) <= profile.planeCaptureMeters;
  const interceptable = Boolean(trackingPlan?.reachable) && planeCapturable;
  const shouldTrigger = interceptable
    && ttc <= triggerTtcSeconds
    && ttc >= profile.minimumTriggerTtcSeconds;

  return freeze({
    stage: PREDICTIVE_INTERCEPT_PARRY_STAGE,
    available: true,
    reason: !planeCapturable
      ? 'predicted-plane-outside-capture-band'
      : !trackingPlan?.reachable
        ? 'predicted-intercept-out-of-parry-reach'
        : shouldTrigger
          ? 'predictive-parry-trigger-window'
          : 'tracking-future-intercept',
    requestedGrade,
    timingGrade: classifyPredictiveParryTiming(ttc, profile),
    timeToContactSeconds: ttc,
    triggerTtcSeconds,
    interceptable,
    shouldTrigger,
    threat,
    trackingPlan,
    parryTrackingProfile: getGuardThreatTrackingProfile('parry'),
    authority: profile.authority,
  });
}

function presentationProfile(variant) {
  const payload = variant === GUARD_REACTION_VARIANTS.PERFECT_PARRY
    ? { perfect: true, variant: GUARD_REACTION_VARIANTS.PERFECT_PARRY }
    : { variant: GUARD_REACTION_VARIANTS.PARRY };
  const profile = getGuardReactionProfile('guard_parry', payload);
  if (!profile) throw new Error('G4.3B.5R requires the production Guard Parry reaction profile');
  return { profile, payload };
}

export function createPredictiveInterceptParryPresentationRuntime(THREE, options = {}) {
  const character = options.character;
  if (!THREE?.Quaternion || !character?.sampleAnimation || !character?.getAnimationDuration) {
    throw new Error('G4.3B.5R predictive presentation requires THREE + animation-capable defender');
  }
  const guardOffsets = options.guardOffsets || LONGSWORD_GUARD_AUTHORING_STATE.offsets;
  let active = null;
  let lastReport = null;

  function reset() {
    active = null;
    lastReport = null;
    return null;
  }

  function start(input = {}) {
    if (active) return freeze({ accepted: false, reason: 'predictive-parry-already-active', report: lastReport });
    const variant = String(input.variant || '').toLowerCase() === GUARD_REACTION_VARIANTS.PERFECT_PARRY
      || String(input.requestedGrade || '').toLowerCase() === 'perfect'
      ? GUARD_REACTION_VARIANTS.PERFECT_PARRY
      : GUARD_REACTION_VARIANTS.PARRY;
    const { profile, payload } = presentationProfile(variant);
    const triggerTtcSeconds = Math.max(
      PREDICTIVE_INTERCEPT_PARRY_PROFILE.minimumTriggerTtcSeconds,
      finite(input.triggerTtcSeconds, getPredictiveParryTriggerTtcSeconds(input.requestedGrade || variant)),
    );
    active = {
      sequence: finite(input.sequence, 0),
      variant,
      payload,
      profile,
      triggerTtcSeconds,
      elapsedMs: 0,
      sourceTimeSeconds: PREDICTIVE_INTERCEPT_PARRY_PROFILE.presentationStartSourceSeconds,
    };
    lastReport = freeze({
      stage: PREDICTIVE_INTERCEPT_PARRY_STAGE,
      active: true,
      justStarted: true,
      sequence: active.sequence,
      variant,
      elapsedMs: 0,
      sourceTimeSeconds: active.sourceTimeSeconds,
      triggerTtcSeconds,
      readyForAuthoritativeHandoff: false,
      authority: PREDICTIVE_INTERCEPT_PARRY_PROFILE.authority,
    });
    return freeze({ accepted: true, report: lastReport });
  }

  function update(input = {}) {
    if (!active) return freeze({
      stage: PREDICTIVE_INTERCEPT_PARRY_STAGE,
      active: false,
      reason: 'predictive-parry-not-active',
      authority: PREDICTIVE_INTERCEPT_PARRY_PROFILE.authority,
    });

    const deltaSeconds = Math.max(0, finite(input.deltaSeconds, 1 / 60));
    active.elapsedMs += deltaSeconds * 1000;
    const ttc = Math.max(0, finite(input.timeToContactSeconds, active.triggerTtcSeconds));
    const progress = clamp(1 - ttc / active.triggerTtcSeconds, 0, 1);
    const targetSource = PREDICTIVE_INTERCEPT_PARRY_PROFILE.presentationStartSourceSeconds
      + (PREDICTIVE_INTERCEPT_PARRY_PROFILE.interceptSourceSeconds
        - PREDICTIVE_INTERCEPT_PARRY_PROFILE.presentationStartSourceSeconds) * progress;
    active.sourceTimeSeconds = Math.max(active.sourceTimeSeconds, targetSource);

    const registeredDuration = Math.max(
      0.001,
      finite(character.getAnimationDuration(active.profile.clipId), active.profile.sourceDurationSeconds),
    );
    const sourceTimeSeconds = clamp(active.sourceTimeSeconds, 0, registeredDuration);
    character.sampleAnimation(active.profile.clipId, sourceTimeSeconds, {
      loop: false,
      inPlace: true,
      rootRotationPolicy: 'lock',
    });
    applyGuardQuaternionOffsetsWeighted(THREE, character.rig, guardOffsets, active.profile.correctionWeight);
    character.update?.(0, input.camera);

    lastReport = freeze({
      stage: PREDICTIVE_INTERCEPT_PARRY_STAGE,
      active: true,
      sequence: active.sequence,
      variant: active.variant,
      elapsedMs: active.elapsedMs,
      sourceTimeSeconds,
      triggerTtcSeconds: active.triggerTtcSeconds,
      timeToContactSeconds: ttc,
      progress,
      readyForAuthoritativeHandoff: ttc <= 0.02 || progress >= 0.9,
      defenderPresentationOffsetSeconds: sourceTimeSeconds,
      guardIntentAgeMs: active.elapsedMs,
      authority: PREDICTIVE_INTERCEPT_PARRY_PROFILE.authority,
    });
    return lastReport;
  }

  function handoff() {
    if (!active || !lastReport) return freeze({ accepted: false, reason: 'predictive-parry-not-active' });
    const report = lastReport;
    active = null;
    return freeze({
      accepted: true,
      stage: PREDICTIVE_INTERCEPT_PARRY_STAGE,
      sequence: report.sequence,
      variant: report.variant,
      guardIntentAgeMs: report.guardIntentAgeMs,
      defenderPresentationOffsetSeconds: report.sourceTimeSeconds,
      authority: 'authoritative-contact-handoff',
    });
  }

  return freeze({
    start,
    update,
    handoff,
    reset,
    get active() { return Boolean(active); },
    get report() { return lastReport; },
  });
}
