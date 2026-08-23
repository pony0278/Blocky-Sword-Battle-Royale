import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../tools/action-studio/shield-driven-contact-coupling-lab-r281.js', import.meta.url), 'utf8');

function functionBody(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test('Step 1 exposes a direct OLD Two-Actor B3 diagnostic control', () => {
  assert.match(html, /id="forceOldB3"/);
  assert.match(html, /g43b5r281-debug-low-stance-controls-r18e/);
  assert.match(source, /forceOldTwoActorB3/);
  assert.match(source, /direct-existing-old-two-actor-b3-diagnostic/);
});

test('Step 1 publishes the unchanged legacy B3 handoff and bypasses the Parry middle chain', () => {
  const body = functionBody('forceOldTwoActorB3');
  assert.match(body, /combat\.resolveContact/);
  assert.match(body, /publishPostCouplingRecoilStaggerHandoff/);
  assert.match(body, /combat\.update\(0\.021/);
  assert.doesNotMatch(body, /analyzePredictiveInterceptParry/);
  assert.doesNotMatch(body, /probeSweptSwordBucklerContact/);
  assert.doesNotMatch(body, /couplingRuntime\.start/);
  assert.doesNotMatch(body, /prepareLegacyReleaseBridge/);
});

test('Step 1 diagnostic remains available after Step 2 replaces the active coupling path', () => {
  assert.match(source, /function updateParryPreContact/);
  assert.match(source, /function triggerParryNow/);
  assert.match(source, /function forceOldTwoActorB3/);
  const resolveStart = source.indexOf('function resolveContact(');
  const resolveEnd = source.indexOf('function updateHud(', resolveStart);
  assert.doesNotMatch(source.slice(resolveStart, resolveEnd), /couplingRuntime\.start/);
});
