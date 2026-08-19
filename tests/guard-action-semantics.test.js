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

test('G3.5 treats Parry and Perfect Parry as successful timed blocks, not separate attacks', () => {
  const block = LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.BLOCK_HIT];
  const parry = LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.PARRY];
  const perfect = LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.PERFECT_PARRY];

  assert.equal(parry.intendedRole, GUARD_ACTION_SEMANTIC_ROLES.PARRY_SUCCESS);
  assert.equal(perfect.intendedRole, GUARD_ACTION_SEMANTIC_ROLES.PERFECT_PARRY_SUCCESS);
  assert.equal(parry.sourceRole, GUARD_ACTION_SEMANTIC_ROLES.BLOCK_REACTION);
  assert.equal(perfect.sourceRole, GUARD_ACTION_SEMANTIC_ROLES.BLOCK_REACTION);
  assert.equal(parry.semanticFit, GUARD_ACTION_SEMANTIC_FIT.MATCH);
  assert.equal(perfect.semanticFit, GUARD_ACTION_SEMANTIC_FIT.MATCH);
  assert.equal(parry.replacementRequired, false);
  assert.equal(perfect.replacementRequired, false);
  assert.equal(parry.clipId, block.clipId);
  assert.equal(perfect.clipId, block.clipId);
  assert.equal(parry.sourceId, 'shd_blockhit');
  assert.equal(perfect.sourceId, 'shd_blockhit');
});

test('G3.5 keeps gameplay distinctions even while Block and Parry share one defensive contact motion', () => {
  const block = LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.BLOCK_HIT];
  const parry = LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.PARRY];
  const perfect = LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.PERFECT_PARRY];

  assert.notEqual(block.intendedRole, parry.intendedRole);
  assert.notEqual(parry.intendedRole, perfect.intendedRole);
  assert.notDeepEqual(block.counterWindowSeconds, parry.counterWindowSeconds);
  assert.notDeepEqual(parry.counterWindowSeconds, perfect.counterWindowSeconds);
});

test('G3.5 refuses to sign off Melee_Block_Attack as a longsword Counter', () => {
  const counter = LONGSWORD_GUARD_COUNTER_PROFILE;
  assert.equal(counter.semanticStage, GUARD_ACTION_SEMANTIC_STAGE);
  assert.equal(counter.intendedRole, GUARD_ACTION_SEMANTIC_ROLES.COUNTER_STRIKE);
  assert.equal(counter.sourceRole, GUARD_ACTION_SEMANTIC_ROLES.BLOCK_ATTACK_PUSH);
  assert.equal(counter.semanticFit, GUARD_ACTION_SEMANTIC_FIT.MISMATCH);
  assert.equal(counter.replacementRequired, true);
  assert.ok(counter.acquisitionCriteria.some((criterion) => /right-hand longsword/i.test(criterion)));
  assert.match(counter.semanticNote, /Shield Bash \/ Guard Push candidate/i);
});
