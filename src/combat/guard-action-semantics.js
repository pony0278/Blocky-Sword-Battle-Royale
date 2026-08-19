export const GUARD_ACTION_SEMANTIC_FIT = Object.freeze({
  MATCH: 'match',
  PROVISIONAL: 'provisional',
  MISMATCH: 'mismatch',
});

export const GUARD_ACTION_SEMANTIC_ROLES = Object.freeze({
  BLOCK_REACTION: 'block-reaction',
  PARRY_SUCCESS: 'parry-success',
  PERFECT_PARRY_SUCCESS: 'perfect-parry-success',
  COUNTER_STRIKE: 'counter-strike',
  SHIELD_BASH: 'shield-bash',
  SHIELD_POWER_BASH: 'shield-power-bash',
  BLOCK_ATTACK_PUSH: 'block-attack-push',
});

export const GUARD_ACTION_SEMANTIC_STAGE = 'G3.5';

export function guardActionSemanticAssessment({
  intendedRole,
  sourceRole,
  fit = GUARD_ACTION_SEMANTIC_FIT.MATCH,
  replacementRequired = false,
  acquisitionCriteria = [],
  note = '',
}) {
  return Object.freeze({
    semanticStage: GUARD_ACTION_SEMANTIC_STAGE,
    intendedRole,
    sourceRole,
    semanticFit: fit,
    replacementRequired: Boolean(replacementRequired),
    acquisitionCriteria: Object.freeze([...acquisitionCriteria]),
    semanticNote: note,
  });
}

export const COUNTER_MOTION_ACQUISITION_CRITERIA = Object.freeze([
  'Right-hand longsword is the primary attacking tool',
  'Contains a clear strike or thrust contact silhouette shortly after launch',
  'Shield remains secondary and must not be the only forward-driving action',
  'Can recover cleanly back into Triangle Guard after the authored follow-through',
]);
