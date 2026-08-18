export const GUARD_COUNTER_PROFILE_IDS = Object.freeze({
  LONGSWORD: 'longsword_guard_counter_melee_block_attack_v1',
});

export const GUARD_WEAPON_MOUNT_PROFILE_IDS = Object.freeze({
  SKYRIM_GUARD: 'skyrim-guard-calibrated',
  KAYKIT_DEFAULT: 'kaykit-default',
});

const COUNTER_COMPLETE_EVENT = 'counter_complete';

export const LONGSWORD_GUARD_COUNTER_PROFILE = Object.freeze({
  id: GUARD_COUNTER_PROFILE_IDS.LONGSWORD,
  state: 'guard_counter',
  sourceFamily: 'kaykit-melee',
  sourceId: 'Melee_Block_Attack',
  clipId: 'Melee_Block_Attack',
  completionEvent: COUNTER_COMPLETE_EVENT,
  correctionWeight: 0,
  weaponMountProfileId: GUARD_WEAPON_MOUNT_PROFILE_IDS.KAYKIT_DEFAULT,
  inPlace: true,
  loop: false,
  authored: true,
  authoredStage: 'G3.4',
  visualDecision: 'ADOPT — original Triangle Guard spec counter candidate; authoritative COUNTER_CONFIRMED only',
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function sampleGuardCounterProfile(elapsedMs = 0, clipDurationSeconds = 0) {
  const durationSeconds = Math.max(0, Number(clipDurationSeconds) || 0);
  if (!(durationSeconds > 0)) return null;
  const elapsedSeconds = Math.max(0, Number(elapsedMs) || 0) / 1000;
  const progress = clamp(elapsedSeconds / durationSeconds, 0, 1);
  return Object.freeze({
    profile: LONGSWORD_GUARD_COUNTER_PROFILE,
    progress,
    sourceTimeSeconds: durationSeconds * progress,
    durationSeconds,
    durationMs: durationSeconds * 1000,
    complete: progress >= 1,
    completionEvent: LONGSWORD_GUARD_COUNTER_PROFILE.completionEvent,
  });
}
