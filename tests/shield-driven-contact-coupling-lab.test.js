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

test('G4.3B.5R.2.6 Parry freezes weapon B3 but advances backward body before coupling constraint', () => {
  assert.match(source, /const parryCouplingOwnsWeapon = couplingRuntime\.active;/);
  const couplingBody = source.slice(source.indexOf('function updateCoupling('), source.indexOf('function updateBlockGive('));
  assert.match(couplingBody, /latestCombatUpdate = combat\.update\(0, \{ camera \}\);/);
  assert.match(couplingBody, /balanceBreakRuntime\.update\(deltaSeconds\)/);
  assert.match(couplingBody, /couplingRuntime\.update\(deltaSeconds\)/);
  assert.ok(couplingBody.indexOf('balanceBreakRuntime.update(deltaSeconds)') < couplingBody.indexOf('couplingRuntime.update(deltaSeconds)'));
});

test('G4.3B.5R.2.4.2 Block remains outside Parry coupling and balance break', () => {
  const branchStart = source.indexOf("if (outcome === 'block')");
  const branchEnd = source.indexOf('} else {', branchStart);
  const blockBranch = source.slice(branchStart, branchEnd);
  assert.match(blockBranch, /blockGiveRuntime\.start/);
  assert.doesNotMatch(blockBranch, /couplingRuntime\.start/);
  assert.doesNotMatch(blockBranch, /balanceBreakRuntime\.start/);
  assert.match(source, /blockShieldGiveRunsParallelToAttackerBounce: true/);
  assert.match(source, /blockB3ClockFrozen: false/);
});

test('G4.3B.5R.2 does not reset pre-contact tracking at authoritative contact', () => {
  const contactStart = source.indexOf('function resolveContact(');
  const couplingStart = source.indexOf('function rebuildNeutralCouplingReleaseBase(');
  const resolveBody = source.slice(contactStart, couplingStart);
  assert.doesNotMatch(resolveBody, /trackingRuntime\.reset\(\)/);
  assert.match(source.slice(couplingStart), /if \(latestCouplingReport\?\.complete\)[\s\S]*trackingRuntime\.reset\(\)/);
});

test('G4.3B.5R.2.6 preserves terminal hand constraint while neutralizing release torso base', () => {
  assert.match(source, /rebuildNeutralCouplingReleaseBase/);
  assert.match(source, /reapplyAttackerConstraint/);
  assert.match(source, /couplingReleasePose = captureRigPose\(attacker\.rig\)/);
  assert.match(source, /terminalHandConstraintReappliedForNeutralB3Base: true/);
});

test('G4.3B.5R.2.6 Lab exposes backward pitch dominant Parry contract', () => {
  assert.match(html, /PARRY chest backward/);
  assert.match(html, /BODY FIRST → CONTACT CONSTRAINT LAST/);
  assert.match(source, /Backward break:/);
  assert.match(source, /backwardPitchDominatesLateralTwist: true/);
});
