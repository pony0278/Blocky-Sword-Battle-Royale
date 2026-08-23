import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('historical G4.3B.5R.2.7 source keeps release telemetry while current Lab defers it to Step 3', () => {
  const html = fs.readFileSync(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url), 'utf8');
  const source = fs.readFileSync(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.js', import.meta.url), 'utf8');

  assert.match(html, /Step 3 physical propagation/);
  assert.match(html, /deferred to Step 3/);
  assert.match(source, /predictive-intercept-parry\.js\?v=g43b5r27/);
  assert.match(source, /two-actor-combat-integration\.js\?v=g43b5r27/);
  assert.match(source, /shield-driven-contact-coupling\.js\?v=g43b5r27/);
  assert.match(source, /parry-backward-balance-break\.js\?v=g43b5r27/);
  assert.match(source, /two-actor-whole-body-recoil-burst\.js\?v=g43b5r27/);
  assert.match(source, /maxReleaseTipDisplacementMeters/);
  assert.match(source, /distanceTo\(releaseTipPosition\)/);
  assert.match(source, /bypassedForWholeBodyBurst/);
  assert.match(source, /Release separation: BYPASSED/);
  assert.match(source, /parryWeaponAuthority/);
  assert.match(source, /parryBodyAuthority/);
});
