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
    loop: false,
    authored: true,
    authoredStage: 'G3.3.2',
    visualDecision,
  });
}

export const LONGSWORD_GUARD_REACTION_PROFILES = Object.freeze({
  [GUARD_REACTION_VARIANTS.BLOCK_HIT]: reactionProfile({
    id: GUARD_REACTION_PROFILE_IDS.BLOCK_HIT,
    variant: GUARD_REACTION_VARIANTS.BLOCK_HIT,
    state: 'guard_block_hit',
    sourceId: 'shd_blockhit',
    file: 'shd_blockhit.source.glb',
    clipId: 'SKYRIM_GUARD/shd_blockhit',
    sourceDurationSeconds: 0.8,
    sourceEndSeconds: 0.6,
    counterWindowSeconds: [0.24, 0.6],
    visualDecision: 'ADOPT WITH CORRECTIONS — preserve recoil, replace the late 0.20s with G3.2 Recover',
  }),
  [GUARD_REACTION_VARIANTS.PARRY]: reactionProfile({
    id: GUARD_REACTION_PROFILE_IDS.PARRY,
    variant: GUARD_REACTION_VARIANTS.PARRY,
    state: 'guard_parry',
    sourceId: 'shd_blockbash',
    file: 'shd_blockbash.source.glb',
    clipId: 'SKYRIM_GUARD/shd_blockbash',
    sourceDurationSeconds: 1 / 3,
    sourceEndSeconds: 1 / 3,
    counterWindowSeconds: [0.08, 1 / 3],
    visualDecision: 'ADOPT — compact active longsword deflect; use the complete source motion',
  }),
  [GUARD_REACTION_VARIANTS.PERFECT_PARRY]: reactionProfile({
    id: GUARD_REACTION_PROFILE_IDS.PERFECT_PARRY,
    variant: GUARD_REACTION_VARIANTS.PERFECT_PARRY,
    state: 'guard_parry',
    sourceId: 'shd_blockbashpower',
    file: 'shd_blockbashpower.source.glb',
    clipId: 'SKYRIM_GUARD/shd_blockbashpower',
    sourceDurationSeconds: 0.7,
    sourceEndSeconds: 0.48,
    counterWindowSeconds: [0.1, 0.48],
    visualDecision: 'ADOPT WITH CORRECTIONS — keep the strong displacement, trim the late 0.22s counter-like follow-through',
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
