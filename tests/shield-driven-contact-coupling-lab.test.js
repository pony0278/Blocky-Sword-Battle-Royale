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

test('G4.3B.5R.2.5 Parry coupling owns weapon contact while B3 weapon recoil receives zero delta', () => {
  assert.match(source, /const parryCouplingOwnsWeapon = couplingRuntime\.active;/);
  assert.match(source, /latestCombatUpdate = combat\.update\(0, \{ camera \}\);/);
  assert.match(source, /latestCouplingReport = couplingRuntime\.update\(deltaSeconds\);/);
  assert.ok(
    source.indexOf('latestCombatUpdate = combat.update(0, { camera });')
      < source.indexOf('latestCouplingReport = couplingRuntime.update(deltaSeconds);'),
    'frozen attacker weapon base must be sampled before shield-driven Parry coupling is applied',
  );
});

test('G4.3B.5R.2.4.2 Block remains outside Parry coupling', () => {
  const branchStart = source.indexOf("if (outcome === 'block')");
  const branchEnd = source.indexOf('} else {', branchStart);
  const blockBranch = source.slice(branchStart, branchEnd);
  assert.match(blockBranch, /blockGiveRuntime\.start/);
  assert.doesNotMatch(blockBranch, /couplingRuntime\.start/);
  assert.doesNotMatch(blockBranch, /parallelBodyRuntime\.start/);
  assert.match(source, /blockShieldGiveRunsParallelToAttackerBounce: true/);
  assert.match(source, /blockB3ClockFrozen: false/);
});

test('G4.3B.5R.2 does not reset pre-contact tracking at authoritative contact', () => {
  const contactStart = source.indexOf('function resolveContact(');
  const couplingStart = source.indexOf('function updateCoupling(');
  const resolveBody = source.slice(contactStart, couplingStart);
  assert.doesNotMatch(resolveBody, /trackingRuntime\.reset\(\)/);
  assert.match(source.slice(couplingStart), /if \(latestCouplingReport\?\.complete\)[\s\S]*trackingRuntime\.reset\(\)/);
});

test('G4.3B.5R.2.5 captures terminal weapon-coupled pose before parallel body application', () => {
  assert.match(source, /let couplingReleasePose = null;/);
  assert.match(source, /couplingReleasePose = captureRigPose\(attacker\.rig\);/);
  assert.match(source, /if \(couplingReleasePose\)[\s\S]*applyRigPose\(attacker\.rig, couplingReleasePose\)/);
  assert.match(source, /couplingReleasePoseCapturedBeforeParallelBodyApplication: true/);
});

test('G4.3B.5R.2.5 lab exposes separate Block, Parry weapon, and Parry body ownership', () => {
  assert.match(html, /PARRY weapon \/ right arm/);
  assert.match(html, /PARRY body start/);
  assert.match(source, /Weapon authority: original B2\/B3/);
  assert.match(source, /B3 weapon: LOCKED · Parallel body/);
  assert.match(source, /parryBodyStaggerRunsDuringCoupling: true/);
});
