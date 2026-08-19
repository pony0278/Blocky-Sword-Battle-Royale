import {
  GUARD_ACTION_SEMANTIC_FIT,
  GUARD_ACTION_SEMANTIC_ROLES,
  guardActionSemanticAssessment,
} from './guard-action-semantics.js';

export const GUARD_REACTION_VARIANTS = Object.freeze({
  BLOCK_HIT: 'block-hit',
  PARRY: 'parry',
  PERFECT_PARRY: 'perfect-parry',
});

export const GUARD_REACTION_PROFILE_IDS = Object.freeze({
  BLOCK_HIT: 'longsword_guard_block_hit_v1',
  PARRY: 'longsword_guard_parry_deflect_v1',
  PERFECT_PARRY: 'longsword_guard_perfect_parry_v1',
});

const REACTION_COMPLETE_EVENT = 'reaction_complete';
const GUARD_ROOT_ROTATION_POLICY = 'lock';
const GUARD_ROOT_ROTATION_SAFETY_STAGE = 'G3.4.2R';

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
  visualDecision,
  semanticAssessment,
}) {
  const start = Math.max(0, Number(sourceStartSeconds) || 0);
  const sourceDuration = Math.max(start, Number(sourceDurationSeconds) || start);
  const end = Math.max(start, Math.min(sourceDuration, Number(sourceEndSeconds) || sourceDuration));
  const durationSeconds = end - start;
  const counterStart = Math.max(0, Math.min(durationSeconds, Number(counterWindowSeconds?.[0]) || 0));
  const counterEnd = Math.max(counterStart, Math.min(durationSeconds, Number(counterWindowSeconds?.[1]) || durationSeconds));
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
    counterWindowSeconds: Object.freeze([counterStart, counterEnd]),
    completionEvent: REACTION_COMPLETE_EVENT,
    correctionWeight: 1,
    inPlace: true,
    rootRotationPolicy: GUARD_ROOT_ROTATION_POLICY,
    rootRotationSafetyStage: GUARD_ROOT_ROTATION_SAFETY_STAGE,
    loop: false,
    authored: true,
    authoredStage: 'G3.4.0',
    visualDecision,
    ...semanticAssessment,
  });
}

const SHARED_BLOCK_CONTACT = Object.freeze({
  sourceId: 'shd_blockhit',
  file: 'shd_blockhit.source.glb',
  clipId: 'SKYRIM_GUARD/shd_blockhit',
  sourceDurationSeconds: 0.8,
  sourceEndSeconds: 0.6,
});

export const LONGSWORD_GUARD_REACTION_PROFILES = Object.freeze({
  [GUARD_REACTION_VARIANTS.BLOCK_HIT]: reactionProfile({
    id: GUARD_REACTION_PROFILE_IDS.BLOCK_HIT,
    variant: GUARD_REACTION_VARIANTS.BLOCK_HIT,
    state: 'guard_block_hit',
    ...SHARED_BLOCK_CONTACT,
    counterWindowSeconds: [0.24, 0.6],
    visualDecision: 'G3.4.2R SAFETY ROLLBACK — preserve the validated 0.00–0.60s recoil window; do not expose the unverified 0.60–0.80s tail while root-rotation safety is enforced',
    semanticAssessment: guardActionSemanticAssessment({
      intendedRole: GUARD_ACTION_SEMANTIC_ROLES.BLOCK_REACTION,
      sourceRole: GUARD_ACTION_SEMANTIC_ROLES.BLOCK_REACTION,
      fit: GUARD_ACTION_SEMANTIC_FIT.MATCH,
      note: 'Block Hit reads as a defensive contact/recoil reaction and remains approved for production use.',
    }),
  }),
  [GUARD_REACTION_VARIANTS.PARRY]: reactionProfile({
    id: GUARD_REACTION_PROFILE_IDS.PARRY,
    variant: GUARD_REACTION_VARIANTS.PARRY,
    state: 'guard_parry',
    ...SHARED_BLOCK_CONTACT,
    counterWindowSeconds: [0.08, 1 / 3],
    visualDecision: 'G3.5 SHARED DEFENSIVE CONTACT — Parry is a timing-qualified successful block, so reuse the validated Block Hit motion; the semantic difference comes from combat outcome and Counter Window rather than a shield-bash animation',
    semanticAssessment: guardActionSemanticAssessment({
      intendedRole: GUARD_ACTION_SEMANTIC_ROLES.PARRY_SUCCESS,
      sourceRole: GUARD_ACTION_SEMANTIC_ROLES.BLOCK_REACTION,
      fit: GUARD_ACTION_SEMANTIC_FIT.MATCH,
      note: 'Parry is not a separate attack. It is a successful timed block, so sharing shd_blockhit is semantically approved.',
    }),
  }),
  [GUARD_REACTION_VARIANTS.PERFECT_PARRY]: reactionProfile({
    id: GUARD_REACTION_PROFILE_IDS.PERFECT_PARRY,
    variant: GUARD_REACTION_VARIANTS.PERFECT_PARRY,
    state: 'guard_parry',
    ...SHARED_BLOCK_CONTACT,
    counterWindowSeconds: [0.1, 0.48],
    visualDecision: 'G3.5 SHARED DEFENSIVE CONTACT — Perfect Parry also reuses the validated Block Hit motion; perfect quality should be communicated by authoritative grade, Counter opportunity, enemy response and presentation accents rather than a shield-bash attack',
    semanticAssessment: guardActionSemanticAssessment({
      intendedRole: GUARD_ACTION_SEMANTIC_ROLES.PERFECT_PARRY_SUCCESS,
      sourceRole: GUARD_ACTION_SEMANTIC_ROLES.BLOCK_REACTION,
      fit: GUARD_ACTION_SEMANTIC_FIT.MATCH,
      note: 'Perfect Parry shares the defensive contact motion. Its stronger reward belongs in timing, enemy stagger, FX/audio and Counter access.',
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
    counterWindowOpen: elapsedSeconds >= counterStart && elapsedSeconds <= counterEnd,
    completionEvent: profile.completionEvent,
  });
}
