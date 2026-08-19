import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCTION_PARRY_DEFLECT_CLIP_IDS,
  PRODUCTION_PARRY_DEFLECT_PHASES,
  PRODUCTION_PARRY_DEFLECT_STAGE,
  PRODUCTION_PARRY_DEFLECT_VARIANTS,
  getProductionParryDeflectProfile,
  sampleProductionParryDeflectTimeline,
} from '../src/animation/parry-contact-deflect-runtime-clip.js';

test('G3.5.1P-T3 promotes Shared Normal T1 as the production deflect source', () => {
  const parry = getProductionParryDeflectProfile(PRODUCTION_PARRY_DEFLECT_VARIANTS.PARRY);
  const perfect = getProductionParryDeflectProfile(PRODUCTION_PARRY_DEFLECT_VARIANTS.PERFECT_PARRY);

  assert.equal(parry.stage, PRODUCTION_PARRY_DEFLECT_STAGE);
  assert.equal(parry.productionEnabled, true);
  assert.equal(parry.probeOnly, false);
  assert.equal(parry.clipId, PRODUCTION_PARRY_DEFLECT_CLIP_IDS.PARRY);
  assert.equal(perfect.clipId, PRODUCTION_PARRY_DEFLECT_CLIP_IDS.PERFECT_PARRY);
  assert.equal(parry.contactClipId, 'SKYRIM_GUARD/shd_blockhit');
  assert.equal(perfect.contactClipId, 'SKYRIM_GUARD/shd_blockhit');
  assert.equal(parry.deflectClipId, 'SKYRIM_GUARD/shd_blockbash');
  assert.equal(perfect.deflectClipId, 'SKYRIM_GUARD/shd_blockbash');
  assert.equal(parry.sourceDecision, 'T2_SHARED_NORMAL_T1');
  assert.equal(perfect.sourceDecision, 'T2_SHARED_NORMAL_T1');
  assert.equal(parry.contactEndSeconds, 0.16);
  assert.equal(parry.contactHoldSeconds, 0.085);
  assert.equal(parry.blendSeconds, 0.07);
  assert.equal(perfect.contactHoldSeconds, 0.095);
  assert.equal(perfect.blendSeconds, 0.075);
  assert.equal(parry.deflectStartSeconds, 0.09);
  assert.equal(parry.deflectEndSeconds, 0.22);
  assert.equal(parry.deflectBlendLeadSeconds, 0.03);
  assert.equal(parry.deflectRate, 1.15);
  assert.equal(parry.reactionDurationSeconds, 0.6);
  assert.equal(perfect.reactionDurationSeconds, 0.6);
  assert.ok(parry.deflectEndAtSeconds < perfect.deflectEndAtSeconds);
  assert.ok(perfect.deflectEndAtSeconds < 0.6);
});

test('G3.5.1P-T3 timeline visibly sequences contact, hold, blend, deflect and settle', () => {
  const variant = PRODUCTION_PARRY_DEFLECT_VARIANTS.PARRY;
  const profile = getProductionParryDeflectProfile(variant);

  const contact = sampleProductionParryDeflectTimeline(variant, 0.12);
  assert.equal(contact.phase, PRODUCTION_PARRY_DEFLECT_PHASES.CONTACT);
  assert.equal(contact.clipId, profile.contactClipId);
  assert.equal(contact.sourceTimeSeconds, 0.12);

  const hold = sampleProductionParryDeflectTimeline(variant, 0.20);
  assert.equal(hold.phase, PRODUCTION_PARRY_DEFLECT_PHASES.CONTACT_HOLD);
  assert.equal(hold.clipId, profile.contactClipId);
  assert.equal(hold.sourceTimeSeconds, 0.16);

  const blendTime = profile.holdEndSeconds + profile.blendSeconds * 0.5;
  const blend = sampleProductionParryDeflectTimeline(variant, blendTime);
  assert.equal(blend.phase, PRODUCTION_PARRY_DEFLECT_PHASES.BLEND);
  assert.equal(blend.fromClipId, profile.contactClipId);
  assert.equal(blend.toClipId, profile.deflectClipId);
  assert.ok(blend.blendAlpha > 0 && blend.blendAlpha < 1);

  const deflect = sampleProductionParryDeflectTimeline(variant, profile.blendEndSeconds + 0.04);
  assert.equal(deflect.phase, PRODUCTION_PARRY_DEFLECT_PHASES.DEFLECT);
  assert.equal(deflect.clipId, profile.deflectClipId);
  assert.ok(deflect.sourceTimeSeconds > profile.deflectStartSeconds);
  assert.ok(deflect.sourceTimeSeconds < profile.deflectEndSeconds);

  const settle = sampleProductionParryDeflectTimeline(variant, 0.55);
  assert.equal(settle.phase, PRODUCTION_PARRY_DEFLECT_PHASES.SETTLE);
  assert.equal(settle.clipId, profile.deflectClipId);
  assert.equal(settle.sourceTimeSeconds, profile.deflectEndSeconds);
  assert.equal(settle.completeVisualChain, true);
});

test('G3.5.1P-T3 Perfect Parry changes timing, not the accepted deflect source', () => {
  const normal = getProductionParryDeflectProfile(PRODUCTION_PARRY_DEFLECT_VARIANTS.PARRY);
  const perfect = getProductionParryDeflectProfile(PRODUCTION_PARRY_DEFLECT_VARIANTS.PERFECT_PARRY);
  assert.equal(perfect.deflectClipId, normal.deflectClipId);
  assert.equal(perfect.deflectStartSeconds, normal.deflectStartSeconds);
  assert.equal(perfect.deflectEndSeconds, normal.deflectEndSeconds);
  assert.equal(perfect.deflectRate, normal.deflectRate);
  assert.ok(perfect.contactHoldSeconds > normal.contactHoldSeconds);
  assert.ok(perfect.blendSeconds > normal.blendSeconds);
  assert.doesNotMatch(perfect.deflectClipId, /power/i);
});
