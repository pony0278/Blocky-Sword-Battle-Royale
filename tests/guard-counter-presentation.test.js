import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GUARD_COUNTER_PROFILE_IDS,
  GUARD_WEAPON_MOUNT_PROFILE_IDS,
  LONGSWORD_GUARD_COUNTER_PROFILE,
  sampleGuardCounterProfile,
} from '../src/combat/guard-counter-presentation.js';

test('G3.4 authors Melee_Block_Attack as the longsword Guard Counter presentation', () => {
  const profile = LONGSWORD_GUARD_COUNTER_PROFILE;
  assert.equal(profile.id, GUARD_COUNTER_PROFILE_IDS.LONGSWORD);
  assert.equal(profile.state, 'guard_counter');
  assert.equal(profile.sourceFamily, 'kaykit-melee');
  assert.equal(profile.clipId, 'Melee_Block_Attack');
  assert.equal(profile.weaponMountProfileId, GUARD_WEAPON_MOUNT_PROFILE_IDS.KAYKIT_DEFAULT);
  assert.equal(profile.correctionWeight, 0);
  assert.equal(profile.inPlace, true);
  assert.equal(profile.loop, false);
  assert.equal(profile.authored, true);
  assert.equal(profile.authoredStage, 'G3.4');
  assert.equal(profile.completionEvent, 'counter_complete');
});

test('G3.4 samples the full registered Counter clip and completes deterministically', () => {
  assert.equal(sampleGuardCounterProfile(0, 0), null);

  const mid = sampleGuardCounterProfile(375, 0.75);
  assert.equal(mid.profile.id, GUARD_COUNTER_PROFILE_IDS.LONGSWORD);
  assert.equal(mid.progress, 0.5);
  assert.equal(mid.sourceTimeSeconds, 0.375);
  assert.equal(mid.complete, false);

  const end = sampleGuardCounterProfile(750, 0.75);
  assert.equal(end.progress, 1);
  assert.equal(end.sourceTimeSeconds, 0.75);
  assert.equal(end.complete, true);
  assert.equal(end.completionEvent, 'counter_complete');

  const clamped = sampleGuardCounterProfile(2000, 0.75);
  assert.equal(clamped.sourceTimeSeconds, 0.75);
  assert.equal(clamped.complete, true);
});
