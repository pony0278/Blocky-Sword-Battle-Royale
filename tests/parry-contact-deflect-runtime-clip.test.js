import test from 'node:test';
import assert from 'node:assert/strict';
import {
  G36_POWER_PARRY_TORSO_SAFETY_LIMITS_DEGREES,
  PRODUCTION_PARRY_DEFLECT_CLIP_IDS,
  PRODUCTION_PARRY_DEFLECT_PHASES,
  PRODUCTION_PARRY_DEFLECT_STAGE,
  PRODUCTION_PARRY_DEFLECT_VARIANTS,
  getProductionParryDeflectProfile,
  sampleProductionParryDeflectTimeline,
} from '../src/animation/parry-contact-deflect-runtime-clip.js';

test('G3.6 promotes Block Hit to Power Bash T1 as the production Parry motion', () => {
  const parry = getProductionParryDeflectProfile(PRODUCTION_PARRY_DEFLECT_VARIANTS.PARRY);
  const perfect = getProductionParryDeflectProfile(PRODUCTION_PARRY_DEFLECT_VARIANTS.PERFECT_PARRY);

  assert.equal(PRODUCTION_PARRY_DEFLECT_STAGE, 'G3.6');
  assert.equal(parry.stage, 'G3.6');
  assert.equal(perfect.stage, 'G3.6');
  assert.equal(parry.productionEnabled, true);
  assert.equal(parry.probeOnly, false);
  assert.equal(parry.contactClipId, 'SKYRIM_GUARD/shd_blockhit');
  assert.equal(perfect.contactClipId, 'SKYRIM_GUARD/shd_blockhit');
  assert.equal(parry.deflectClipId, 'SKYRIM_GUARD/shd_blockbashpower');
  assert.equal(perfect.deflectClipId, 'SKYRIM_GUARD/shd_blockbashpower');
  assert.equal(parry.sourceDecision, 'G3_6_PROMOTE_T2_POWER_T1');
  assert.equal(perfect.sourceDecision, 'G3_6_PROMOTE_T2_POWER_T1');
  assert.equal(parry.sharedMotionFamily, 'g36-blockhit-powerbash');
  assert.equal(perfect.sharedMotionFamily, parry.sharedMotionFamily);
  assert.equal(parry.sharedMotionContract, true);
  assert.equal(perfect.sharedMotionContract, true);
  assert.deepEqual(parry.upperBodySafetyLimitsDegrees, G36_POWER_PARRY_TORSO_SAFETY_LIMITS_DEGREES);
});

test('G3.6 Parry Advantage and Perfect Parry use exactly the same animation timing', () => {
  const parry = getProductionParryDeflectProfile(PRODUCTION_PARRY_DEFLECT_VARIANTS.PARRY);
  const perfect = getProductionParryDeflectProfile(PRODUCTION_PARRY_DEFLECT_VARIANTS.PERFECT_PARRY);

  for (const key of [
    'contactEndSeconds',
    'contactHoldSeconds',
    'holdEndSeconds',
    'blendSeconds',
    'blendEndSeconds',
    'deflectStartSeconds',
    'deflectEndSeconds',
    'deflectBlendLeadSeconds',
    'deflectRate',
    'deflectEndAtSeconds',
    'reactionDurationSeconds',
  ]) {
    assert.equal(perfect[key], parry[key], `${key} must be shared`);
  }

  assert.equal(parry.contactEndSeconds, 0.16);
  assert.equal(parry.contactHoldSeconds, 0.05);
  assert.equal(parry.blendSeconds, 0.055);
  assert.equal(parry.deflectStartSeconds, 0.12);
  assert.equal(parry.deflectEndSeconds, 0.28);
  assert.equal(parry.deflectBlendLeadSeconds, 0.035);
  assert.equal(parry.deflectRate, 1.10);
  assert.equal(parry.reactionDurationSeconds, 0.6);
  assert.ok(parry.deflectEndAtSeconds < 0.4);
  assert.notEqual(parry.clipId, perfect.clipId, 'runtime keeps variant IDs for compatibility while baking identical motion');
  assert.equal(parry.clipId, PRODUCTION_PARRY_DEFLECT_CLIP_IDS.PARRY);
  assert.equal(perfect.clipId, PRODUCTION_PARRY_DEFLECT_CLIP_IDS.PERFECT_PARRY);
});

test('G3.6 timeline visibly sequences short Block Hit, Power Bash and settle', () => {
  const variant = PRODUCTION_PARRY_DEFLECT_VARIANTS.PARRY;
  const profile = getProductionParryDeflectProfile(variant);

  const contact = sampleProductionParryDeflectTimeline(variant, 0.12);
  assert.equal(contact.phase, PRODUCTION_PARRY_DEFLECT_PHASES.CONTACT);
  assert.equal(contact.clipId, 'SKYRIM_GUARD/shd_blockhit');
  assert.equal(contact.sourceTimeSeconds, 0.12);

  const hold = sampleProductionParryDeflectTimeline(variant, 0.18);
  assert.equal(hold.phase, PRODUCTION_PARRY_DEFLECT_PHASES.CONTACT_HOLD);
  assert.equal(hold.clipId, 'SKYRIM_GUARD/shd_blockhit');
  assert.equal(hold.sourceTimeSeconds, 0.16);

  const blendTime = profile.holdEndSeconds + profile.blendSeconds * 0.5;
  const blend = sampleProductionParryDeflectTimeline(variant, blendTime);
  assert.equal(blend.phase, PRODUCTION_PARRY_DEFLECT_PHASES.BLEND);
  assert.equal(blend.fromClipId, 'SKYRIM_GUARD/shd_blockhit');
  assert.equal(blend.toClipId, 'SKYRIM_GUARD/shd_blockbashpower');
  assert.ok(blend.blendAlpha > 0 && blend.blendAlpha < 1);

  const deflect = sampleProductionParryDeflectTimeline(variant, profile.blendEndSeconds + 0.04);
  assert.equal(deflect.phase, PRODUCTION_PARRY_DEFLECT_PHASES.DEFLECT);
  assert.equal(deflect.clipId, 'SKYRIM_GUARD/shd_blockbashpower');
  assert.ok(deflect.sourceTimeSeconds > profile.deflectStartSeconds);
  assert.ok(deflect.sourceTimeSeconds < profile.deflectEndSeconds);

  const settle = sampleProductionParryDeflectTimeline(variant, 0.55);
  assert.equal(settle.phase, PRODUCTION_PARRY_DEFLECT_PHASES.SETTLE);
  assert.equal(settle.clipId, 'SKYRIM_GUARD/shd_blockbashpower');
  assert.equal(settle.sourceTimeSeconds, 0.28);
  assert.equal(settle.completeVisualChain, true);
});

test('G3.6 Perfect Parry differs by gameplay reward, not motion', () => {
  const normal = getProductionParryDeflectProfile(PRODUCTION_PARRY_DEFLECT_VARIANTS.PARRY);
  const perfect = getProductionParryDeflectProfile(PRODUCTION_PARRY_DEFLECT_VARIANTS.PERFECT_PARRY);
  assert.equal(perfect.deflectClipId, normal.deflectClipId);
  assert.equal(perfect.deflectStartSeconds, normal.deflectStartSeconds);
  assert.equal(perfect.deflectEndSeconds, normal.deflectEndSeconds);
  assert.equal(perfect.deflectRate, normal.deflectRate);
  assert.equal(perfect.contactHoldSeconds, normal.contactHoldSeconds);
  assert.equal(perfect.blendSeconds, normal.blendSeconds);
  assert.match(perfect.perfectDifferentiation, /same-motion-as-parry-advantage/);
});
