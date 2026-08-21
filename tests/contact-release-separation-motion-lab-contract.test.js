import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('G4.3B.5R.2.4.2 lab exposes impact accent, full-body weights, and fresh module graph', () => {
  const html = fs.readFileSync(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url), 'utf8');
  const source = fs.readFileSync(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.js', import.meta.url), 'utf8');

  assert.match(html, /G4\.3B\.5R\.2\.4\.2/);
  assert.match(html, /shield-driven-contact-coupling-lab\.js\?v=g43b5r242/);
  assert.match(html, /id="hudImpact"/);
  assert.match(source, /predictive-intercept-parry\.js\?v=g43b5r242/);
  assert.match(source, /two-actor-combat-integration\.js\?v=g43b5r242/);
  assert.match(source, /shield-driven-contact-coupling\.js\?v=g43b5r242/);
  assert.match(source, /impact-accent-full-body-recoil-fusion\.js\?v=g43b5r242/);
  assert.match(source, /maxReleaseTipDisplacementMeters/);
  assert.match(source, /distanceTo\(releaseTipPosition\)/);
  assert.match(source, /fullBodyRecoilScale/);
  assert.match(source, /chestWeight/);
  assert.match(source, /spineWeight/);
  assert.match(source, /hipsWeight/);
  assert.match(source, /impactAccentSamplesFromCapturedContactPose/);
});
