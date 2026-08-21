import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url), 'utf8');

test('G4.3B.5R.2.5 lab starts body stagger only for Parry/Perfect after authoritative contact', () => {
  assert.match(source, /parallelBodyRuntime\.start\(\{ outcome, plan: latestCombatResult\.recoilPlan \}\)/);
  const blockStart = source.indexOf("if (outcome === 'block')");
  const elseStart = source.indexOf('} else {', blockStart);
  const blockBody = source.slice(blockStart, elseStart);
  assert.doesNotMatch(blockBody, /parallelBodyRuntime\.start/);
});

test('G4.3B.5R.2.5 keeps Parry weapon coupling frozen while body stagger advances with real delta', () => {
  assert.match(source, /latestCombatUpdate = combat\.update\(0, \{ camera \}\);/);
  assert.match(source, /latestCouplingReport = couplingRuntime\.update\(deltaSeconds\);/);
  assert.match(source, /updateParallelBody\(deltaSeconds\);/);
  assert.match(source, /parryCouplingOwnsWeapon/);
  assert.match(source, /parryBodyStaggerRunsDuringCoupling: true/);
});

test('G4.3B.5R.2.5 captures coupling release pose before applying parallel body layer', () => {
  const couplingFunction = source.slice(source.indexOf('function updateCoupling('), source.indexOf('function updateBlockGive('));
  const frameFunction = source.slice(source.indexOf('function frame('));
  assert.match(couplingFunction, /couplingReleasePose = captureRigPose\(attacker\.rig\)/);
  assert.match(frameFunction, /updateCoupling\(deltaSeconds\)[\s\S]*updateParallelBody\(deltaSeconds\)/);
  assert.match(source, /couplingReleasePoseCapturedBeforeParallelBodyApplication: true/);
});

test('G4.3B.5R.2.5 lab exposes early body timing and cache-busted module version', () => {
  assert.match(html, /G4\.3B\.5R\.2\.5/);
  assert.match(html, /~30 ms after contact/);
  assert.match(html, /chest 1\.45×/);
  assert.match(html, /shield-driven-contact-coupling-lab\.js\?v=g43b5r25/);
  assert.match(source, /parallel-parry-body-stagger\.js\?v=g43b5r25/);
  assert.match(source, /window\.__G43B5R25_LAB__/);
});
