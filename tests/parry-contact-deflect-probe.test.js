import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PARRY_CONTACT_DEFLECT_PHASES,
  PARRY_CONTACT_DEFLECT_PROBE_STAGE,
  PARRY_CONTACT_DEFLECT_VARIANTS,
  createParryContactDeflectProbeProfile,
  sampleParryContactDeflectProbe,
} from '../src/combat/parry-contact-deflect-probe.js';

test('G3.5.1P sequences shield contact before normal deflect', () => {
  const profile = createParryContactDeflectProbeProfile(PARRY_CONTACT_DEFLECT_VARIANTS.PARRY);
  assert.equal(profile.stage, PARRY_CONTACT_DEFLECT_PROBE_STAGE);
  assert.equal(profile.probeOnly, true);
  assert.equal(profile.productionEnabled, false);
  assert.equal(profile.contactClipId, 'SKYRIM_GUARD/shd_blockhit');
  assert.equal(profile.deflectClipId, 'SKYRIM_GUARD/shd_blockbash');
  assert.equal(profile.rootRotationPolicy, 'lock');
  assert.equal(profile.inPlace, true);

  const contact = sampleParryContactDeflectProbe(profile, 80);
  assert.equal(contact.phase, PARRY_CONTACT_DEFLECT_PHASES.CONTACT);
  assert.equal(contact.clipId, profile.contactClipId);

  const hold = sampleParryContactDeflectProbe(profile, profile.contactWindow.endSeconds * 1000 + 10);
  assert.equal(hold.phase, PARRY_CONTACT_DEFLECT_PHASES.CONTACT_HOLD);
  assert.equal(hold.sourceTimeSeconds, profile.contactWindow.endSeconds);

  const blend = sampleParryContactDeflectProbe(
    profile,
    profile.contactWindow.endSeconds * 1000 + profile.contactHoldMs + profile.blendMs * 0.5,
  );
  assert.equal(blend.phase, PARRY_CONTACT_DEFLECT_PHASES.BLEND);
  assert.equal(blend.fromClipId, profile.contactClipId);
  assert.equal(blend.toClipId, profile.deflectClipId);
  assert.ok(blend.blendAlpha > 0 && blend.blendAlpha < 1);

  const deflect = sampleParryContactDeflectProbe(
    profile,
    profile.contactWindow.endSeconds * 1000 + profile.contactHoldMs + profile.blendMs + 40,
  );
  assert.equal(deflect.phase, PARRY_CONTACT_DEFLECT_PHASES.DEFLECT);
  assert.equal(deflect.clipId, profile.deflectClipId);
  assert.ok(deflect.sourceTimeSeconds > profile.deflectWindow.startSeconds);
});

test('G3.5.1P uses power bash only as the post-contact Perfect Parry deflect source', () => {
  const profile = createParryContactDeflectProbeProfile(PARRY_CONTACT_DEFLECT_VARIANTS.PERFECT);
  assert.equal(profile.contactClipId, 'SKYRIM_GUARD/shd_blockhit');
  assert.equal(profile.deflectClipId, 'SKYRIM_GUARD/shd_blockbashpower');
  assert.ok(profile.contactWindow.endSeconds < profile.deflectWindow.endSeconds);
  const complete = sampleParryContactDeflectProbe(profile, profile.durationMs + 999);
  assert.equal(complete.phase, PARRY_CONTACT_DEFLECT_PHASES.COMPLETE);
  assert.equal(complete.clipId, profile.deflectClipId);
  assert.equal(complete.sourceTimeSeconds, profile.deflectWindow.endSeconds);
  assert.equal(complete.complete, true);
});

test('G3.5.1P trimming controls remain bounded and presentation-only', () => {
  const profile = createParryContactDeflectProbeProfile(PARRY_CONTACT_DEFLECT_VARIANTS.PARRY, {
    contactEndSeconds: 99,
    contactHoldMs: -20,
    blendMs: 999,
    deflectStartSeconds: 0.30,
    deflectEndSeconds: 0.20,
    deflectRate: 99,
  });
  assert.equal(profile.contactWindow.endSeconds, 0.60);
  assert.equal(profile.contactHoldMs, 0);
  assert.equal(profile.blendMs, 180);
  assert.equal(profile.deflectWindow.startSeconds, 0.30);
  assert.ok(profile.deflectWindow.endSeconds > profile.deflectWindow.startSeconds);
  assert.equal(profile.deflectRate, 2.5);
  assert.equal(profile.authority, 'presentation-probe-only');
  assert.equal('counterState' in profile, false);
  assert.equal('staggerDurationMs' in profile, false);
});
