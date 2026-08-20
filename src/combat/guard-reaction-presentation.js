import {
  GUARD_ACTION_SEMANTIC_FIT,
  GUARD_ACTION_SEMANTIC_ROLES,
  guardActionSemanticAssessment,
} from './guard-action-semantics.js';
import {
  createParryAdvantageContract,
  isFreeAttackFollowupOpen,
} from './parry-advantage.js';
import { PRODUCTION_PARRY_DEFLECT_CLIP_IDS } from '../animation/parry-contact-deflect-runtime-clip.js';

export const GUARD_REACTION_VARIANTS = Object.freeze({
  BLOCK_HIT: 'block-hit',
  PARRY: 'parry',
  PERFECT_PARRY: 'perfect-parry',
});

export const GUARD_REACTION_PROFILE_IDS = Object.freeze({
  BLOCK_HIT: 'longsword_guard_block_hit_v1',
  PARRY: 'longsword_guard_parry_advantage_g36',
  PERFECT_PARRY: 'longsword_guard_perfect_parry_g36',
});

const REACTION_COMPLETE_EVENT = 'reaction_complete';
const GUARD_ROOT_ROTATION_POLICY = 'lock';
const GUARD_ROOT_ROTATION_SAFETY_STAGE = 'G3.4.2R';

function normalizeWindow(input, durationSeconds) {
  if (!Array.isArray(input) || input.length < 2) return null;
  const start = Math.max(0, Math.min(durationSeconds, Number(input[0]) || 0));
  const end = Math.max(start, Math.min(durationSeconds, Number(input[1]) || durationSeconds));
  return Object.freeze([start, end]);
}

function reactionProfile({
  id,
  variant,
  state,
  sourceId,
  file,
  clipId,
  sourceDurationSeconds,
  sourceStartSeconds = 0,
  sourceEndSeconds,
  counterWindowSeconds,
  followupWindowSeconds = null,
  parryAdvantage = null,
  visualDecision,
  semanticAssessment,
  productionPresentationStage = null,
  productionSourceChain = null,
  sharedMotionFamily = null,
}) {
  const start = Math.max(0, Number(sourceStartSeconds) || 0);
  const sourceDuration = Math.max(start, Number(sourceDurationSeconds) || start);
  const end = Math.max(start, Math.min(sourceDuration, Number(sourceEndSeconds) || sourceDuration));
  const durationSeconds = end - start;
  const legacyCounterWindow = normalizeWindow(counterWindowSeconds, durationSeconds) || Object.freeze([0, 0]);
  const followupWindow = normalizeWindow(followupWindowSeconds, durationSeconds);
  return Object.freeze({
    id,
    variant,
    state,
    sourceId,
    file,
    clipId,
    sourceDurationSeconds: sourceDuration,
    sourceWindow: Object.freeze({ startSeconds: start, endSeconds: end }),
    durationSeconds,
    durationMs: durationSeconds * 1000,
    // G3.4 compatibility only. Production consumers use followupWindowSeconds.
    counterWindowSeconds: legacyCounterWindow,
    followupWindowSeconds: followupWindow,
    parryAdvantage,
    completionEvent: REACTION_COMPLETE_EVENT,
    correctionWeight: 1,
    inPlace: true,
    rootRotationPolicy: GUARD_ROOT_ROTATION_POLICY,
    rootRotationSafetyStage: GUARD_ROOT_ROTATION_SAFETY_STAGE,
    loop: false,
    authored: true,
    authoredStage: 'G3.6',
    productionPresentationStage,
    productionSourceChain,
    sharedMotionFamily,
    visualDecision,
    ...semanticAssessment,
  });
}

// Ordinary Guard contact: already guarding, attack is stopped, attacker does
// not receive Parry Advantage. This intentionally remains pure Block Hit.
const SHARED_BLOCK_CONTACT = Object.freeze({
  sourceId: 'shd_blockhit',
  file: 'shd_blockhit.source.glb',
  clipId: 'SKYRIM_GUARD/shd_blockhit',
  sourceDurationSeconds: 0.8,
  sourceEndSeconds: 0.6,
});

const G36_SHARED_POWER_MOTION_FAMILY = 'g36-blockhit-powerbash';
const G36_SHARED_POWER_SOURCE_CHAIN = Object.freeze([
  'SKYRIM_GUARD/shd_blockhit',
  'SKYRIM_GUARD/shd_blockbashpower',
]);

const PRODUCTION_PARRY_CONTACT_POWER_DEFLECT = Object.freeze({
  sourceId: 'power_parry_g36',
  file: 'virtual:shd_blockhit+shd_blockbashpower',
  clipId: PRODUCTION_PARRY_DEFLECT_CLIP_IDS.PARRY,
  sourceDurationSeconds: 0.6,
  sourceEndSeconds: 0.6,
  productionPresentationStage: 'G3.6',
  productionSourceChain: G36_SHARED_POWER_SOURCE_CHAIN,
  sharedMotionFamily: G36_SHARED_POWER_MOTION_FAMILY,
});

const PRODUCTION_PERFECT_PARRY_CONTACT_POWER_DEFLECT = Object.freeze({
  sourceId: 'perfect_power_parry_g36',
  file: 'virtual:shd_blockhit+shd_blockbashpower',
  clipId: PRODUCTION_PARRY_DEFLECT_CLIP_IDS.PERFECT_PARRY,
  sourceDurationSeconds: 0.6,
  sourceEndSeconds: 0.6,
  productionPresentationStage: 'G3.6',
  productionSourceChain: G36_SHARED_POWER_SOURCE_CHAIN,
  sharedMotionFamily: G36_SHARED_POWER_MOTION_FAMILY,
});

const PARRY_FOLLOWUP_WINDOW = Object.freeze([0.08, 1 / 3]);
const PERFECT_PARRY_FOLLOWUP_WINDOW = Object.freeze([0.1, 0.48]);

export const LONGSWORD_GUARD_REACTION_PROFILES = Object.freeze({
  [GUARD_REACTION_VARIANTS.BLOCK_HIT]: reactionProfile({
    id: GUARD_REACTION_PROFILE_IDS.BLOCK_HIT,
    variant: GUARD_REACTION_VARIANTS.BLOCK_HIT,
    state: 'guard_block_hit',
    ...SHARED_BLOCK_CONTACT,
    counterWindowSeconds: [0.24, 0.6],
    visualDecision: 'G3.6 — ordinary Guard Block stays shd_blockhit only. It communicates successful defense without attacker unbalance or free-attack advantage.',
    semanticAssessment: guardActionSemanticAssessment({
      intendedRole: GUARD_ACTION_SEMANTIC_ROLES.BLOCK_REACTION,
      sourceRole: GUARD_ACTION_SEMANTIC_ROLES.BLOCK_REACTION,
      fit: GUARD_ACTION_SEMANTIC_FIT.MATCH,
      note: 'Already guarding: receive the strike with Block Hit, then recover to Guard. No Parry Advantage is implied.',
    }),
  }),
  [GUARD_REACTION_VARIANTS.PARRY]: reactionProfile({
    id: GUARD_REACTION_PROFILE_IDS.PARRY,
    variant: GUARD_REACTION_VARIANTS.PARRY,
    state: 'guard_parry',
    ...PRODUCTION_PARRY_CONTACT_POWER_DEFLECT,
    counterWindowSeconds: PARRY_FOLLOWUP_WINDOW,
    followupWindowSeconds: PARRY_FOLLOWUP_WINDOW,
    parryAdvantage: createParryAdvantageContract({
      grade: 'parry',
      followupWindowSeconds: PARRY_FOLLOWUP_WINDOW,
    }),
    visualDecision: 'G3.6 POWER PARRY — timed Parry plays short Block Hit contact, then the former T2 Power T1 shd_blockbashpower 0.120–0.280s @1.10x segment. The stronger push is now intentional because Parry Advantage means the attacker is knocked off-line.',
    semanticAssessment: guardActionSemanticAssessment({
      intendedRole: GUARD_ACTION_SEMANTIC_ROLES.PARRY_ADVANTAGE,
      sourceRole: GUARD_ACTION_SEMANTIC_ROLES.PARRY_SUCCESS,
      fit: GUARD_ACTION_SEMANTIC_FIT.MATCH,
      note: 'Timed defense reads as two beats: weapon contact, then a forceful Power Bash deflection that creates attacker disadvantage.',
    }),
  }),
  [GUARD_REACTION_VARIANTS.PERFECT_PARRY]: reactionProfile({
    id: GUARD_REACTION_PROFILE_IDS.PERFECT_PARRY,
    variant: GUARD_REACTION_VARIANTS.PERFECT_PARRY,
    state: 'guard_parry',
    ...PRODUCTION_PERFECT_PARRY_CONTACT_POWER_DEFLECT,
    counterWindowSeconds: PERFECT_PARRY_FOLLOWUP_WINDOW,
    followupWindowSeconds: PERFECT_PARRY_FOLLOWUP_WINDOW,
    parryAdvantage: createParryAdvantageContract({
      grade: 'perfect-parry',
      followupWindowSeconds: PERFECT_PARRY_FOLLOWUP_WINDOW,
    }),
    visualDecision: 'G3.6 POWER PARRY — Perfect Parry uses the exact same Block Hit → Power Bash motion contract as Parry Advantage. Perfect is differentiated by tighter timing and stronger authoritative stagger/hitstop/FX/audio/camera, not a different animation.',
    semanticAssessment: guardActionSemanticAssessment({
      intendedRole: GUARD_ACTION_SEMANTIC_ROLES.PARRY_ADVANTAGE,
      sourceRole: GUARD_ACTION_SEMANTIC_ROLES.PERFECT_PARRY_SUCCESS,
      fit: GUARD_ACTION_SEMANTIC_FIT.MATCH,
      note: 'Perfect Parry intentionally shares the same readable two-beat Power Parry motion; only gameplay reward and presentation intensity differ.',
    }),
  }),
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function isPerfectParryPayload(payload = {}) {
  return payload?.perfect === true
    || payload?.perfectParry === true
    || String(payload?.grade || '').toLowerCase() === 'perfect'
    || String(payload?.variant || '').toLowerCase() === GUARD_REACTION_VARIANTS.PERFECT_PARRY;
}

export function getGuardReactionProfile(state, payload = {}) {
  if (state === 'guard_block_hit') return LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.BLOCK_HIT];
  if (state === 'guard_parry') {
    const variant = isPerfectParryPayload(payload)
      ? GUARD_REACTION_VARIANTS.PERFECT_PARRY
      : GUARD_REACTION_VARIANTS.PARRY;
    return LONGSWORD_GUARD_REACTION_PROFILES[variant];
  }
  return null;
}

export function sampleGuardReactionProfile(state, elapsedMs = 0, payload = {}) {
  const profile = getGuardReactionProfile(state, payload);
  if (!profile) return null;
  const elapsedSeconds = Math.max(0, Number(elapsedMs) || 0) / 1000;
  const progress = profile.durationSeconds > 0
    ? clamp(elapsedSeconds / profile.durationSeconds, 0, 1)
    : 1;
  const sourceTimeSeconds = profile.sourceWindow.startSeconds
    + profile.durationSeconds * progress;
  const [counterStart, counterEnd] = profile.counterWindowSeconds;
  return Object.freeze({
    profile,
    progress,
    sourceTimeSeconds,
    complete: progress >= 1,
    // G3.4 compatibility signal. Do not use for new production follow-up logic.
    counterWindowOpen: elapsedSeconds >= counterStart && elapsedSeconds <= counterEnd,
    freeAttackFollowupOpen: isFreeAttackFollowupOpen(profile.parryAdvantage, elapsedSeconds),
    parryAdvantage: profile.parryAdvantage,
    completionEvent: profile.completionEvent,
  });
}
