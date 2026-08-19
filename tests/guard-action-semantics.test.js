import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GUARD_ACTION_SEMANTIC_FIT,
  GUARD_ACTION_SEMANTIC_ROLES,
  GUARD_ACTION_SEMANTIC_STAGE,
} from '../src/combat/guard-action-semantics.js';
import {
  GUARD_REACTION_VARIANTS,
  LONGSWORD_GUARD_REACTION_PROFILES,
} from '../src/combat/guard-reaction-presentation.js';
import { LONGSWORD_GUARD_COUNTER_PROFILE } from '../src/combat/guard-counter-presentation.js';

test('G3.5 keeps Block Hit semantically approved', () => {
  const block = LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.BLOCK_HIT];
  assert.equal(block.semanticStage, GUARD_ACTION_SEMANTIC_STAGE);
  assert.equal(block.intendedRole, GUARD_ACTION_SEMANTIC_ROLES.BLOCK_REACTION);
  assert.equal(block.sourceRole, GUARD_ACTION_SEMANTIC_ROLES.BLOCK_REACTION);
  assert.equal(block.semanticFit, GUARD_ACTION_SEMANTIC_FIT.MATCH);
  assert.equal(block.replacementRequired, false);
});

test('G3.5 refuses to sign off Skyrim shield bashes as Parry animations', () => {
  const parry = LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.PARRY];
  const perfect = LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.PERFECT_PARRY];

  assert.equal(parry.intendedRole, GUARD_ACTION_SEMANTIC_ROLES.PARRY_DEFLECT);
  assert.equal(parry.sourceRole, GUARD_ACTION_SEMANTIC_ROLES.SHIELD_BASH);
  assert.equal(parry.semanticFit, GUARD_ACTION_SEMANTIC_FIT.MISMATCH);
  assert.equal(parry.replacementRequired, true);
  assert.ok(parry.acquisitionCriteria.length >= 3);

  assert.equal(perfect.intendedRole, GUARD_ACTION_SEMANTIC_ROLES.PERFECT_PARRY_DEFLECT);
  assert.equal(perfect.sourceRole, GUARD_ACTION_SEMANTIC_ROLES.SHIELD_POWER_BASH);
  assert.equal(perfect.semanticFit, GUARD_ACTION_SEMANTIC_FIT.MISMATCH);
  assert.equal(perfect.replacementRequired, true);
  assert.ok(perfect.acquisitionCriteria.length >= 3);
});

test('G3.5 refuses to sign off Melee_Block_Attack as a longsword Counter', () => {
  const counter = LONGSWORD_GUARD_COUNTER_PROFILE;
  assert.equal(counter.semanticStage, GUARD_ACTION_SEMANTIC_STAGE);
  assert.equal(counter.intendedRole, GUARD_ACTION_SEMANTIC_ROLES.COUNTER_STRIKE);
  assert.equal(counter.sourceRole, GUARD_ACTION_SEMANTIC_ROLES.BLOCK_ATTACK_PUSH);
  assert.equal(counter.semanticFit, GUARD_ACTION_SEMANTIC_FIT.MISMATCH);
  assert.equal(counter.replacementRequired, true);
  assert.ok(counter.acquisitionCriteria.some((criterion) => /right-hand longsword/i.test(criterion)));
});

test('G3.5 preserves mismatched sources as future Shield Bash family candidates instead of deleting them', () => {
  const parry = LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.PARRY];
  const perfect = LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.PERFECT_PARRY];
  const counter = LONGSWORD_GUARD_COUNTER_PROFILE;

  assert.equal(parry.clipId, 'SKYRIM_GUARD/shd_blockbash');
  assert.equal(perfect.clipId, 'SKYRIM_GUARD/shd_blockbashpower');
  assert.equal(counter.clipId, 'Melee_Block_Attack');
  assert.match(parry.semanticNote, /Shield Bash candidate/i);
  assert.match(perfect.semanticNote, /Shield Bash candidate/i);
  assert.match(counter.semanticNote, /Shield Bash \/ Guard Push candidate/i);
});
