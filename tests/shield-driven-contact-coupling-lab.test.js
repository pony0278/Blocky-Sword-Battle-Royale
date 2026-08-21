import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url), 'utf8');

test('G4.3B.5R.2 Lab uses real swept Sword × Buckler contact as the authority gate', () => {
  assert.match(source, /probeSweptSwordBucklerContact\(/);
  assert.match(source, /if \(!latestContact\.contact\) return;/);
  assert.match(source, /combat\.resolveContact\(\{ contact: latestContact, guardIntentAgeMs \}\)/);
});

test('G4.3B.5R.2 coupling owns the contact interval while B3 receives zero delta', () => {
  assert.match(source, /const couplingOwned = couplingRuntime\.active;/);
  assert.match(source, /latestCombatUpdate = combat\.update\(0, \{ camera \}\);/);
  assert.match(source, /latestCouplingReport = couplingRuntime\.update\(deltaSeconds\);/);
  assert.ok(
    source.indexOf('latestCombatUpdate = combat.update(0, { camera });')
      < source.indexOf('latestCouplingReport = couplingRuntime.update(deltaSeconds);'),
    'frozen attacker base must be sampled before shield-driven coupling is applied',
  );
});

test('G4.3B.5R.2 does not reset pre-contact tracking at authoritative contact', () => {
  const contactStart = source.indexOf('function resolveContact(');
  const couplingStart = source.indexOf('function updateCoupling(');
  const resolveBody = source.slice(contactStart, couplingStart);
  assert.doesNotMatch(resolveBody, /trackingRuntime\.reset\(\)/);
  assert.match(source.slice(couplingStart), /if \(latestCouplingReport\?\.complete\)[\s\S]*trackingRuntime\.reset\(\)/);
});

test('G4.3B.5R.2 hands terminal coupled attacker pose into the B3 frozen-pose sampler', () => {
  assert.match(source, /let couplingReleasePose = null;/);
  assert.match(source, /couplingReleasePose = captureRigPose\(attacker\.rig\);/);
  assert.match(source, /if \(couplingReleasePose\)[\s\S]*applyRigPose\(attacker\.rig, couplingReleasePose\)/);
  assert.match(source, /coupledTerminalPoseBecomesB3BasePose: true/);
});

test('G4.3B.5R.2 lab exposes shield drive and attacker weapon follow telemetry', () => {
  assert.match(html, /Shield drive/);
  assert.match(html, /Weapon follow/);
  assert.match(html, /B3 clock = frozen/);
  assert.match(source, /attackerWeaponMotionDerivedFromShield: true/);
  assert.match(source, /defenderShieldMovesBeforeB3: true/);
});
