import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url), 'utf8');

test('G4.3B.5R.2.6 starts backward balance break only on Parry / Perfect', () => {
  assert.match(source, /balanceBreakRuntime\.start\(\{ outcome, plan: latestCombatResult\.recoilPlan \}\)/);
  const blockStart = source.indexOf("if (outcome === 'block')");
  const elseStart = source.indexOf('} else {', blockStart);
  const blockBody = source.slice(blockStart, elseStart);
  assert.doesNotMatch(blockBody, /balanceBreakRuntime\.start/);
});

test('G4.3B.5R.2.6 applies body first and shield attacker constraint last during coupling', () => {
  const couplingBody = source.slice(source.indexOf('function updateCoupling('), source.indexOf('function updateBlockGive('));
  const baseIndex = couplingBody.indexOf('combat.update(0, { camera })');
  const bodyIndex = couplingBody.indexOf('balanceBreakRuntime.update(deltaSeconds)');
  const couplingIndex = couplingBody.indexOf('couplingRuntime.update(deltaSeconds)');
  assert.ok(baseIndex >= 0 && bodyIndex > baseIndex && couplingIndex > bodyIndex);
  assert.match(source, /bodyAppliedBeforeContactConstraint: true/);
});

test('G4.3B.5R.2.6 rebuilds a neutral torso release base with terminal hand constraint', () => {
  assert.match(source, /function rebuildNeutralCouplingReleaseBase\(\)/);
  assert.match(source, /couplingRuntime\.reapplyAttackerConstraint\(latestCouplingReport\)/);
  assert.match(source, /couplingReleasePose = captureRigPose\(attacker\.rig\)/);
  assert.match(source, /terminalHandConstraintReappliedForNeutralB3Base: true/);
});

test('G4.3B.5R.2.6 Lab exposes backward almost-fall targets and cache bust', () => {
  assert.match(html, /G4\.3B\.5R\.2\.6/);
  assert.match(html, /≥ 11\.5° peak/);
  assert.match(html, /≥ 15° peak/);
  assert.match(html, /BODY FIRST → CONTACT CONSTRAINT LAST/);
  assert.match(html, /shield-driven-contact-coupling-lab\.js\?v=g43b5r26/);
  assert.match(source, /parry-backward-balance-break\.js\?v=g43b5r26/);
  assert.match(source, /window\.__G43B5R26_LAB__/);
});
