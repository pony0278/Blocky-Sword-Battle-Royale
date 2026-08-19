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

test('G3.4.2R restores the validated Block Hit window and locks reaction root rotation', () => {
  const block = LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.BLOCK_HIT];
  const parry = LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.PARRY];
  const perfect = LONGSWORD_GUARD_REACTION_PROFILES[GUARD_REACTION_VARIANTS.PERFECT_PARRY];

  assert.equal(block.clipId, 'SKYRIM_GUARD/shd_blockhit');
  assert.equal(block.sourceDurationSeconds, 0.8);
  assert.equal(block.sourceWindow.endSeconds, 0.6);
  assert.equal(block.durationMs, 600);
  assert.deepEqual(block.counterWindowSeconds, [0.24, 0.6]);
  assert.equal(block.id, GUARD_REACTION_PROFILE_IDS.BLOCK_HIT);
  assert.equal(block.rootRotationPolicy, 'lock');
  assert.equal(block.rootRotationSafetyStage, 'G3.4.2R');

  assert.equal(parry.clipId, 'SKYRIM_GUARD/shd_blockbash');
  assert.ok(Math.abs(parry.sourceDurationSeconds - (1 / 3)) < 1e-9);
  assert.ok(Math.abs(parry.sourceWindow.endSeconds - (1 / 3)) < 1e-9);
  assert.ok(Math.abs(parry.durationMs - (1000 / 3)) < 1e-6);
  assert.equal(parry.id, GUARD_REACTION_PROFILE_IDS.PARRY);
  assert.equal(parry.authoredStage, 'G3.4.0');
  assert.equal(parry.rootRotationPolicy, 'lock');

  assert.equal(perfect.clipId, 'SKYRIM_GUARD/shd_blockbashpower');
  assert.equal(perfect.sourceDurationSeconds, 0.7);
  assert.equal(perfect.sourceWindow.endSeconds, 0.7);
  assert.equal(perfect.durationMs, 700);
  assert.deepEqual(perfect.counterWindowSeconds, [0.1, 0.48]);
  assert.equal(perfect.id, GUARD_REACTION_PROFILE_IDS.PERFECT_PARRY);
  assert.equal(perfect.authoredStage, 'G3.4.0');
  assert.equal(perfect.rootRotationPolicy, 'lock');
});

test('G3.4.2R does not adopt the rejected blockbashintro into the runtime family', () => {
  const serialized = JSON.stringify(LONGSWORD_GUARD_REACTION_PROFILES);
  assert.doesNotMatch(serialized, /blockbashintro/i);
});

test('G3.4.2R preserves authoritative Perfect Parry selection metadata', () => {
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

test('G3.4.2R completes Block Hit at the validated 0.60s boundary while leaving other reaction windows intact', () => {
  const blockBefore = sampleGuardReactionProfile('guard_block_hit', 599, {});
  assert.equal(blockBefore.complete, false);
  assert.equal(blockBefore.counterWindowOpen, true);
  assert.ok(blockBefore.sourceTimeSeconds < 0.6);

  const blockEnd = sampleGuardReactionProfile('guard_block_hit', 600, {});
  assert.equal(blockEnd.complete, true);
  assert.equal(blockEnd.counterWindowOpen, true);
  assert.equal(blockEnd.sourceTimeSeconds, 0.6);
  assert.equal(blockEnd.completionEvent, 'reaction_complete');

  const parryEnd = sampleGuardReactionProfile('guard_parry', 1000 / 3, {});
  assert.equal(parryEnd.complete, true);
  assert.ok(Math.abs(parryEnd.sourceTimeSeconds - (1 / 3)) < 1e-9);

  const perfectWindowEnd = sampleGuardReactionProfile('guard_parry', 480, { perfect: true });
  assert.equal(perfectWindowEnd.profile.variant, GUARD_REACTION_VARIANTS.PERFECT_PARRY);
  assert.equal(perfectWindowEnd.counterWindowOpen, true);
  assert.equal(perfectWindowEnd.complete, false);
  assert.equal(perfectWindowEnd.sourceTimeSeconds, 0.48);

  const perfectSettle = sampleGuardReactionProfile('guard_parry', 600, { perfect: true });
  assert.equal(perfectSettle.counterWindowOpen, false);
  assert.equal(perfectSettle.complete, false);
  assert.equal(perfectSettle.sourceTimeSeconds, 0.6);

  const perfectEnd = sampleGuardReactionProfile('guard_parry', 700, { perfect: true });
  assert.equal(perfectEnd.complete, true);
  assert.equal(perfectEnd.sourceTimeSeconds, 0.7);
});
