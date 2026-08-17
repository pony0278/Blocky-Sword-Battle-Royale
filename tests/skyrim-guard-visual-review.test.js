import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SKYRIM_GUARD_VISUAL_REVIEW_ITEMS,
  classifySkyrimGuardLoopSeam,
  decideSkyrimGuardVisualReview,
} from '../src/combat/skyrim-guard-visual-review.js';

test('G2.3 review keeps the five agreed visual gates explicit', () => {
  assert.deepEqual(SKYRIM_GUARD_VISUAL_REVIEW_ITEMS.map((item) => item.id), [
    'weight', 'torso', 'weaponArm', 'offHand', 'loop',
  ]);
});

test('loop seam metric distinguishes clean, correctable and bad seams', () => {
  assert.equal(classifySkyrimGuardLoopSeam({
    maxRotationDegrees: 2,
    rootTranslation: 0.01,
    pelvisTranslation: 0.02,
  }).status, 'good');
  assert.equal(classifySkyrimGuardLoopSeam({
    maxRotationDegrees: 7,
    rootTranslation: 0.02,
    pelvisTranslation: 0.05,
  }).status, 'warning');
  assert.equal(classifySkyrimGuardLoopSeam({
    maxRotationDegrees: 14,
    rootTranslation: 0.01,
    pelvisTranslation: 0.02,
  }).status, 'bad');
});

test('review decision is ADOPT only when every visual gate passes', () => {
  const ratings = Object.fromEntries(SKYRIM_GUARD_VISUAL_REVIEW_ITEMS.map(({ id }) => [id, 'pass']));
  assert.equal(decideSkyrimGuardVisualReview(ratings).decision, 'ADOPT');
});

test('correctable shield-arm or loop issues produce ADOPT WITH CORRECTIONS', () => {
  const ratings = Object.fromEntries(SKYRIM_GUARD_VISUAL_REVIEW_ITEMS.map(({ id }) => [id, 'pass']));
  ratings.offHand = 'correct';
  assert.equal(decideSkyrimGuardVisualReview(ratings).decision, 'ADOPT WITH CORRECTIONS');
});

test('a failed core stance gate rejects the source and incomplete review stays pending', () => {
  assert.equal(decideSkyrimGuardVisualReview({ weight: 'fail', torso: 'pass', weaponArm: 'pass', offHand: 'pass', loop: 'pass' }).decision, 'REJECT');
  assert.equal(decideSkyrimGuardVisualReview({ weight: 'pass' }).decision, 'PENDING');
});
