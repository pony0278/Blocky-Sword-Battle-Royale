import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GUARD_REACTION_PROFILE_IDS,
  GUARD_REACTION_VARIANTS,
  LONGSWORD_GUARD_REACTION_PROFILES,
  getGuardReactionProfile,
  isPerfectParryPayload,
  sampleGuardReactionProfile,
} from '../src/combat/guard-reaction-presentation.js';
import { PRODUCTION_PARRY_DEFLECT_CLIP_IDS } from '../src/animation/parry-contact-deflect-runtime-clip.js';

test('G3.5.1P-T3 keeps Block Hit unchanged and promotes Shared T1 virtual clips for Parry outcomes', () => {
  const block = LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.BLOCK_HIT];
  const parry = LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.PARRY];
  const perfect = LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.PERFECT_PARRY];

  assert.equal(block.clipId, 'SKYRIM_GUARD/shd_blockhit');
  assert.equal(block.sourceId, 'shd_blockhit');
  assert.equal(block.sourceDurationSeconds, 0.8);
  assert.equal(block.sourceWindow.endSeconds, 0.6);
  assert.equal(block.durationMs, 600);

  assert.equal(parry.clipId, PRODUCTION_PARRY_DEFLECT_CLIP_IDS.PARRY);
  assert.equal(perfect.clipId, PRODUCTION_PARRY_DEFLECT_CLIP_IDS.PERFECT_PARRY);
  assert.equal(parry.sourceDurationSeconds, 0.6);
  assert.equal(perfect.sourceDurationSeconds, 0.6);
  assert.equal(parry.sourceWindow.endSeconds, 0.6);
  assert.equal(perfect.sourceWindow.endSeconds, 0.6);
  assert.equal(parry.durationMs, 600);
  assert.equal(perfect.durationMs, 600);

  for (const profile of [block, parry, perfect]) {
    assert.equal(profile.rootRotationPolicy, 'lock');
    assert.equal(profile.rootRotationSafetyStage, 'G3.4.2R');
  }

  assert.deepEqual(block.counterWindowSeconds, [0.24, 0.6]);
  assert.deepEqual(parry.counterWindowSeconds, [0.08, 1 / 3]);
  assert.deepEqual(perfect.counterWindowSeconds, [0.1, 0.48]);
  assert.equal(block.id, GUARD_REACTION_PROFILE_IDS.BLOCK_HIT);
  assert.equal(parry.id, GUARD_REACTION_PROFILE_IDS.PARRY);
  assert.equal(perfect.id, GUARD_REACTION_PROFILE_IDS.PERFECT_PARRY);
});

test('G3.5.1P-T3 production Parry mapping uses shared blockbash deflect and rejects power-bash mapping', () => {
  const parry = LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.PARRY];
  const perfect = LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.PERFECT_PARRY];
  for (const profile of [parry, perfect]) {
    assert.equal(profile.productionPresentationStage, 'G3.5.1P-T3');
    assert.deepEqual(profile.productionSourceChain, [
      'SKYRIM_GUARD/shd_blockhit',
      'SKYRIM_GUARD/shd_blockbash',
    ]);
    assert.notEqual(profile.clipId, 'SKYRIM_GUARD/shd_blockbash');
    assert.notEqual(profile.clipId, 'SKYRIM_GUARD/shd_blockbashpower');
    assert.equal(profile.productionSourceChain.includes('SKYRIM_GUARD/shd_blockbashpower'), false);
  }
});

test('G3.5 preserves authoritative Perfect Parry selection metadata', () => {
  assert.equal(isPerfectParryPayload({ perfect: true }), true);
  assert.equal(isPerfectParryPayload({ perfectParry: true }), true);
  assert.equal(isPerfectParryPayload({ grade: 'PERFECT' }), true);
  assert.equal(isPerfectParryPayload({ variant: 'perfect-parry' }), true);
  assert.equal(isPerfectParryPayload({ grade: 'normal' }), false);

  assert.equal(getGuardReactionProfile('guard_parry', {}).variant, GUARD_REACTION_VARIANTS.PARRY);
  assert.equal(
    getGuardReactionProfile('guard_parry', { perfect: true }).variant,
    GUARD_REACTION_VARIANTS.PERFECT_PARRY,
  );
  assert.equal(getGuardReactionProfile('guard_block_hit', {}).variant, GUARD_REACTION_VARIANTS.BLOCK_HIT);
  assert.equal(getGuardReactionProfile('guard_hold', {}), null);
});

test('G3.5.1P-T3 preserves the existing 0.60s reaction completion boundary', () => {
  const blockBefore = sampleGuardReactionProfile('guard_block_hit', 599, {});
  assert.equal(blockBefore.complete, false);
  assert.equal(blockBefore.counterWindowOpen, true);
  assert.ok(blockBefore.sourceTimeSeconds < 0.6);

  const blockEnd = sampleGuardReactionProfile('guard_block_hit', 600, {});
  assert.equal(blockEnd.complete, true);
  assert.equal(blockEnd.sourceTimeSeconds, 0.6);
  assert.equal(blockEnd.completionEvent, 'reaction_complete');

  const parryWindowEnd = sampleGuardReactionProfile('guard_parry', 1000 / 3, {});
  assert.equal(parryWindowEnd.complete, false);
  assert.equal(parryWindowEnd.counterWindowOpen, true);
  assert.ok(Math.abs(parryWindowEnd.sourceTimeSeconds - (1 / 3)) < 1e-9);

  const parrySettle = sampleGuardReactionProfile('guard_parry', 599, {});
  assert.equal(parrySettle.complete, false);
  assert.equal(parrySettle.counterWindowOpen, false);

  const parryEnd = sampleGuardReactionProfile('guard_parry', 600, {});
  assert.equal(parryEnd.complete, true);
  assert.equal(parryEnd.sourceTimeSeconds, 0.6);

  const perfectWindowEnd = sampleGuardReactionProfile('guard_parry', 480, { perfect: true });
  assert.equal(perfectWindowEnd.profile.variant, GUARD_REACTION_VARIANTS.PERFECT_PARRY);
  assert.equal(perfectWindowEnd.counterWindowOpen, true);
  assert.equal(perfectWindowEnd.complete, false);
  assert.equal(perfectWindowEnd.sourceTimeSeconds, 0.48);

  const perfectEnd = sampleGuardReactionProfile('guard_parry', 600, { perfect: true });
  assert.equal(perfectEnd.counterWindowOpen, false);
  assert.equal(perfectEnd.complete, true);
  assert.equal(perfectEnd.sourceTimeSeconds, 0.6);
});
