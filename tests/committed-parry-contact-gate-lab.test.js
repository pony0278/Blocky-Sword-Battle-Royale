import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../tools/action-studio/shield-driven-contact-coupling-lab-r281.js', import.meta.url), 'utf8');

function functionBody(name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must exist`);
  return source.slice(start, end);
}

test('Step 2 exposes one manual Parry and removes Perfect from the Lab', () => {
  assert.match(html, /id="parryNow"/);
  assert.match(html, /id="slowReview"[^>]*checked/);
  assert.match(html, />PARRY NOW \(F\)</);
  assert.doesNotMatch(html, /data-mode="perfect"/);
  assert.match(html, /g43b5r281-closed-loop-old-b3-r18i5/);
});

test('Step 2 does not auto-start Parry from predictive timing', () => {
  const preContact = functionBody('updateParryPreContact', 'updatePreContact');
  const manualInput = functionBody('triggerParryNow', 'forceOldTwoActorB3');
  assert.doesNotMatch(preContact, /predictivePresentation\.start/);
  assert.match(manualInput, /parryGate\.arm/);
  assert.match(manualInput, /predictivePresentation\.start/);
});

test('Step 3A requires the gate and real swept contact before live wrist-grip transfer', () => {
  const resolve = functionBody('resolveContact', 'updateHud');
  assert.match(resolve, /probeSweptSwordBucklerContact/);
  assert.match(resolve, /if \(!latestContact\.contact\) return/);
  assert.match(resolve, /parryGate\.confirm/);
  assert.match(resolve, /swordGripConstraint\.start/);
  assert.ok(resolve.indexOf('parryGate.confirm') < resolve.indexOf('swordGripConstraint.start'));
  assert.doesNotMatch(resolve, /publishPostCouplingRecoilStaggerHandoff/);
  assert.doesNotMatch(resolve, /couplingRuntime\.start/);
});

test('Step 2 invalid or absent Parry input falls back to Block timing', () => {
  const resolve = functionBody('resolveContact', 'updateHud');
  assert.match(resolve, /parryConfirmed \? TIMING_AGE_MS\.parry : TIMING_AGE_MS\.block/);
  assert.match(resolve, /outcome === 'parry' && parryConfirmed/);
});

test('Step 2 visibly captures F before evaluating the Parry gate', () => {
  assert.match(html, /id="canvas" tabindex="0"/);
  assert.match(html, /id="hudInput"/);
  assert.match(source, /function dispatchParryInput/);
  assert.match(source, /document\.addEventListener\('keydown', handleParryKeyDown, true\)/);
  assert.match(source, /document\.addEventListener\('keyup', handleParryKeyUp, true\)/);
  assert.match(source, /event\?\.code === 'KeyF'/);
  assert.match(source, /String\(event\?\.key \|\| ''\)\.toLowerCase\(\) === 'f'/);
  assert.match(source, /INPUT RECEIVED:/);
});

test('Step 2 previews the live gate without consuming input and gives an explicit retry', () => {
  const preContact = functionBody('updateParryPreContact', 'updatePreContact');
  const cue = functionBody('updateParryCue', 'updateHud');
  assert.match(html, /id="parryCue"/);
  assert.match(html, /id="retryAttack"/);
  assert.match(preContact, /evaluateCommittedParryInput/);
  assert.match(preContact, /manual: false/);
  assert.doesNotMatch(preContact, /parryGate\.arm/);
  assert.doesNotMatch(preContact, /predictivePresentation\.start/);
  assert.match(cue, /PARRY NOW! · PRESS F/);
  assert.match(cue, /ATTEMPT USED/);
  assert.match(cue, /parryGate\.attempt/);
  assert.match(source, /function restartAttack/);
  assert.match(source, /retryAttackButton\.addEventListener/);
});

test('Step 2 keeps original Block at 1x while Parry review holds a valid prompt', () => {
  assert.match(source, /const PARRY_REVIEW_RATE = 0\.12/);
  assert.match(source, /const PARRY_PROMPT_HOLD_MS = 1500/);
  assert.match(source, /function isParryPreContactReviewActive/);
  assert.match(source, /const deltaMs = holdingParryPrompt \? 0 : rawDeltaMs \* reviewRate/);
  assert.match(source, /parryPromptHoldSequence !== snapshot\.sequence/);
  assert.match(html, /Block \+ Step 3A \+ direct OLD B3 stay 1\.00×/);
  assert.doesNotMatch(source, /rawDeltaMs \* \(slowReview\.checked/);
});

test('Step 2 uses timing as input authority and treats predictive geometry as clamped guidance', () => {
  assert.match(source, /committed-parry-contact-gate\.js\?v=g43b5r281-step2-timing-authority-r5/);
  assert.match(html, /geometry-guided shield motion clamped to 18cm/);
  assert.match(html, /guidance · cannot veto input/);
  assert.doesNotMatch(source, /predicted-intercept-out-of-shield-reach/);
  assert.doesNotMatch(source, /predicted-intercept-outside-plane-capture/);
});

test('Step 2 review slowdown ends before Step 3A transfer', () => {
  const review = functionBody('isParryPreContactReviewActive', 'updateBlockPreContact');
  assert.match(review, /!firstContact/);
  assert.match(review, /snapshot\.elapsedSeconds < contactSeconds/);
  assert.match(source, /const parryReviewActive = isParryPreContactReviewActive\(preUpdateSnapshot\)/);
  assert.match(source, /const reviewRate = parryReviewActive \? PARRY_REVIEW_RATE : 1/);
  assert.match(html, /Block \+ Step 3A \+ direct OLD B3 stay 1\.00×/);
});
