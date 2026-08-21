import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('G4.3B.5R.2.4.1+ lab preserves Parry separation telemetry while versioning Block parity', () => {
  const html = fs.readFileSync(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url), 'utf8');
  const source = fs.readFileSync(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.js', import.meta.url), 'utf8');

  assert.match(html, /G4\.3B\.5R\.2\.4\.2/);
  assert.match(html, /shield-driven-contact-coupling-lab\.js\?v=g43b5r242/);
  assert.match(source, /predictive-intercept-parry\.js\?v=g43b5r242/);
  assert.match(source, /two-actor-combat-integration\.js\?v=g43b5r242/);
  assert.match(source, /shield-driven-contact-coupling\.js\?v=g43b5r242/);
  assert.match(source, /maxReleaseTipDisplacementMeters/);
  assert.match(source, /distanceTo\(releaseTipPosition\)/);
  assert.match(source, /releaseSeparationDistanceMeters/);
  assert.match(source, /tip observed/);
  assert.match(source, /Parry coupling owns weapon motion/);
});
