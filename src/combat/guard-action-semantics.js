export const GUARD_ACTION_SEMANTIC_FIT = Object.freeze({
  MATCH: 'match',
  PROVISIONAL: 'provisional',
  MISMATCH: 'mismatch',
});

export const GUARD_ACTION_SEMANTIC_ROLES = Object.freeze({
  BLOCK_REACTION: 'block-reaction',
  PARRY_DEFLECT: 'parry-deflect',
  PERFECT_PARRY_DEFLECT: 'perfect-parry-deflect',
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

export const PARRY_MOTION_ACQUISITION_CRITERIA = Object.freeze([
  'Short defensive deflection rather than a forward body-check or shield shove',
  'Shield or weapon redirects the incoming attack line laterally/upward with limited forward displacement',
  'Ends in a weapon-ready posture that can flow immediately into Counter',
]);

export const PERFECT_PARRY_MOTION_ACQUISITION_CRITERIA = Object.freeze([
  'Same defensive deflection language as normal Parry, but with a clearer contact accent',
  'May use stronger torso/arm commitment, but must not read as a standalone shield bash attack',
  'Leaves a readable opening for the follow-up Counter',
]);

export const COUNTER_MOTION_ACQUISITION_CRITERIA = Object.freeze([
  'Right-hand longsword is the primary attacking tool',
  'Contains a clear strike or thrust contact silhouette shortly after launch',
  'Shield remains secondary and must not be the only forward-driving action',
  'Can recover cleanly back into Triangle Guard after the authored follow-through',
]);
