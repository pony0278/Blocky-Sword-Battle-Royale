import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url), 'utf8');

test('G4.3B.5R.2.4.2 routes Block into defender-only give instead of Parry coupling', () => {
  assert.match(source, /createImmediateBlockShieldGiveRuntime/);
  assert.match(source, /if \(outcome === 'block'\)[\s\S]*blockGiveRuntime\.start/);
  const branchStart = source.indexOf("if (outcome === 'block')");
  const branchEnd = source.indexOf('} else {', branchStart);
  const blockBranch = source.slice(branchStart, branchEnd);
  assert.doesNotMatch(blockBranch, /couplingRuntime\.start/);
  assert.doesNotMatch(blockBranch, /balanceBreakRuntime\.start/);
});

test('G4.3B.5R.2.4.2 lets B3 advance while Block shield give runs in parallel', () => {
  assert.match(source, /const parryCouplingOwnsWeapon = couplingRuntime\.active/);
  assert.match(source, /if \(!parryCouplingOwnsWeapon\)[\s\S]*combat\.update\(deltaSeconds, \{ camera \}\)/);
  assert.match(source, /updateBlockGive\(deltaSeconds\)/);
  assert.match(source, /BLOCK rebound: IMMEDIATE/);
  assert.match(source, /B3 RUNNING IN PARALLEL/);
});

test('G4.3B.5R.2.6 keeps Parry weapon coupling frozen while backward body has separate authority', () => {
  assert.match(source, /function updateCoupling\(deltaSeconds\)[\s\S]*combat\.update\(0, \{ camera \}\)/);
  assert.match(source, /Backward break:/);
  assert.match(source, /balanceBreakRuntime\.update\(deltaSeconds\)/);
});

test('G4.3B.5R.2.6 keeps the accepted Block parity contract visible', () => {
  assert.match(html, /BLOCK<\/span><b>unchanged · immediate B2\/B3<\/b>/);
  assert.match(html, /PARRY chest backward/);
  assert.match(html, /v=g43b5r26/);
});
