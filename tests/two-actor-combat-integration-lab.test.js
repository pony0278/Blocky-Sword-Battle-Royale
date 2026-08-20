import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = fs.readFileSync('tools/action-studio/two-actor-combat-integration-lab.js', 'utf8');
const html = fs.readFileSync('tools/action-studio/two-actor-combat-integration-lab.html', 'utf8');

test('G4.3B.4 lab wires the production exchange chain instead of a presentation-only fake', () => {
  assert.match(script, /createTwoActorCombatIntegration/);
  assert.match(script, /combat\.startAttack\(/);
  assert.match(script, /combat\.resolveContact\(/);
  assert.match(script, /combat\.update\(/);
  assert.match(script, /probeSweptSwordBucklerContact/);
  assert.match(script, /LONGSWORD_ATTACK_PHASES\.ACTIVE/);
  assert.doesNotMatch(script, /active:\s*snapshot\.phase\s*===\s*['"]active['"]/);
});

test('G4.3B.4 lab exposes Block Parry and Perfect timing grades and the dedicated module entry', () => {
  assert.match(html, /data-grade="block"/);
  assert.match(html, /data-grade="parry"/);
  assert.match(html, /data-grade="perfect"/);
  assert.match(html, /two-actor-combat-integration-lab\.js/);
  assert.match(script, /block:\s*260/);
  assert.match(script, /parry:\s*120/);
  assert.match(script, /perfect:\s*50/);
});
