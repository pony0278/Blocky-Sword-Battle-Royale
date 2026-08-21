import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.js', import.meta.url), 'utf8');
const historicalRuntime = fs.readFileSync(new URL('../src/combat/parallel-parry-body-stagger.js', import.meta.url), 'utf8');

test('G4.3B.5R.2.5 historical runtime remains available for comparison', () => {
  assert.match(historicalRuntime, /PARALLEL_PARRY_BODY_STAGGER_STAGE = 'G4\.3B\.5R\.2\.5'/);
  assert.match(historicalRuntime, /chestScale: 1\.45/);
});

test('G4.3B.5R.2.6 supersedes .2.5 as the active Shield Coupling Lab body authority', () => {
  assert.match(source, /PARRY_BACKWARD_BALANCE_BREAK_STAGE/);
  assert.match(source, /createParryBackwardBalanceBreakRuntime/);
  assert.doesNotMatch(source, /createParallelParryBodyStaggerRuntime/);
  assert.match(source, /backwardPitchDominatesLateralTwist: true/);
});
