import {
  GUARD_ACTION_SEMANTIC_FIT,
  GUARD_ACTION_SEMANTIC_ROLES,
  guardActionSemanticAssessment,
} from './guard-action-semantics.js';
import {
  createParryAdvantageContract,
  isFreeAttackFollowupOpen,
} from './parry-advantage.js';

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
    // G3.4 compatibility only. Production G3.5.1 consumers use followupWindowSeconds.
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

const PARRY_FOLLOWUP_WINDOW = Object.freeze([0.08, 1 / 3]);
const PERFECT_PARRY_FOLLOWUP_WINDOW = Object.freeze([0.1, 0.48]);

export const LONGSWORD_GUARD_REACTION_PROFILES = Object.freeze({
  [GUARD_REACTION_VARIANTS.BLOCK_HIT]: reactionProfile({
    id: GUARD_REACTION_PROFILE_IDS.BLOCK_HIT,
    variant: GUARD_REACTION_VARIANTS.BLOCK_HIT,
    state: 'guard_block_hit',
    ...SHARED_BLOCK_CONTACT,
    counterWindowSeconds: [0.24, 0.6],
    visualDecision: 'G3.4.2R SAFETY ROLLBACK — preserve the validated 0.00–0.60s recoil window; ordinary Block does not grant the G3.5.1 free-attack advantage.',
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
    counterWindowSeconds: PARRY_FOLLOWUP_WINDOW,
    followupWindowSeconds: PARRY_FOLLOWUP_WINDOW,
    parryAdvantage: createParryAdvantageContract({
      grade: 'parry',
      followupWindowSeconds: PARRY_FOLLOWUP_WINDOW,
    }),
    visualDecision: 'G3.5.1 PARRY ADVANTAGE — reuse Block Hit for contact; successful timing staggers the attacker and opens the existing directional attack system instead of launching a dedicated Counter animation.',
    semanticAssessment: guardActionSemanticAssessment({
      intendedRole: GUARD_ACTION_SEMANTIC_ROLES.PARRY_ADVANTAGE,
      sourceRole: GUARD_ACTION_SEMANTIC_ROLES.BLOCK_REACTION,
      fit: GUARD_ACTION_SEMANTIC_FIT.MATCH,
      note: 'Parry is a timing-qualified block that grants a free directional attack opportunity; no separate Counter animation is required.',
    }),
  }),
  [GUARD_REACTION_VARIANTS.PERFECT_PARRY]: reactionProfile({
    id: GUARD_REACTION_PROFILE_IDS.PERFECT_PARRY,
    variant: GUARD_REACTION_VARIANTS.PERFECT_PARRY,
    state: 'guard_parry',
    ...SHARED_BLOCK_CONTACT,
    counterWindowSeconds: PERFECT_PARRY_FOLLOWUP_WINDOW,
    followupWindowSeconds: PERFECT_PARRY_FOLLOWUP_WINDOW,
    parryAdvantage: createParryAdvantageContract({
      grade: 'perfect-parry',
      followupWindowSeconds: PERFECT_PARRY_FOLLOWUP_WINDOW,
    }),
    visualDecision: 'G3.5.1 PERFECT PARRY ADVANTAGE — same defensive contact motion, stronger authoritative stagger/reward; follow-up still uses the normal directional attack system.',
    semanticAssessment: guardActionSemanticAssessment({
      intendedRole: GUARD_ACTION_SEMANTIC_ROLES.PARRY_ADVANTAGE,
      sourceRole: GUARD_ACTION_SEMANTIC_ROLES.BLOCK_REACTION,
      fit: GUARD_ACTION_SEMANTIC_FIT.MATCH,
      note: 'Perfect Parry shares Block Hit presentation and grants a stronger combat advantage without a dedicated Counter animation.',
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
