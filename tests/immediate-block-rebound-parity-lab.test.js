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
});

test('G4.3B.5R.2.4.2 lets B3 advance while Block shield give runs in parallel', () => {
  assert.match(source, /const parryCouplingOwnsAttacker = couplingRuntime\.active/);
  assert.match(source, /if \(!parryCouplingOwnsAttacker\)[\s\S]*combat\.update\(deltaSeconds, \{ camera \}\)/);
  assert.match(source, /updateBlockGive\(deltaSeconds\)/);
  assert.match(source, /BLOCK rebound: IMMEDIATE/);
  assert.match(source, /B3 RUNNING IN PARALLEL/);
});

test('G4.3B.5R.2.4.2 keeps Parry coupling freeze semantics', () => {
  assert.match(source, /function updateCoupling\(deltaSeconds\)[\s\S]*combat\.update\(0, \{ camera \}\)/);
  assert.match(source, /B3 recoil: LOCKED · Parry coupling owns weapon motion/);
});

test('G4.3B.5R.2.4.2 lab exposes reference Block parity contract', () => {
  assert.match(html, /Immediate Block Rebound Parity/);
  assert.match(html, /BLOCK B2 baseline<\/span><b>0\.28 strength · 12°<\/b>/);
  assert.match(html, /BLOCK B3 timeline<\/span><b>18 → 82 → 142 → 220 ms<\/b>/);
  assert.match(html, /BLOCK B3 clock<\/span><b>RUNNING during shield give<\/b>/);
  assert.match(html, /BLOCK weapon follow<\/span><b>none<\/b>/);
  assert.match(html, /v=g43b5r242/);
});
