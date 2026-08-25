import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const preContact = await readFile(new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url), 'utf8');
const tracking = await readFile(new URL('../src/combat/guard-threat-tracking.js', import.meta.url), 'utf8');
const bodyReach = await readFile(new URL('../src/combat/guard-residual-body-reach.js', import.meta.url), 'utf8');
const handoff = await readFile(new URL('../tools/action-studio/shield-parry-r281/contact-handoff-controller.js', import.meta.url), 'utf8');
const intent = await readFile(new URL('../src/combat/active-parry-intercept-intent.js', import.meta.url), 'utf8');

test('R18N.3 keeps Active Intercept as the last post-presentation shield-arm writer', () => {
  const planIndex = preContact.indexOf('const activeIntentPlan = activeInterceptIntent?.plan({');
  const updateIndex = preContact.indexOf(
    'exchangeState.latestFineTracking = fineTrackingRuntime.update(exchangeState.latestFinePlan, deltaSeconds);',
    planIndex,
  );
  assert.ok(planIndex >= 0 && updateIndex > planIndex);
  assert.doesNotMatch(
    preContact.slice(planIndex, updateIndex),
    /fineTrackingRuntime\.reset\(\)/,
    'active path must not erase bounded carry immediately before the last-writer solve',
  );
  assert.match(preContact, /preserveShieldArm: Boolean\(activeInterceptIntent\?\.active\)/);
  assert.match(preContact, /post-guard-post-predictive-absolute-world-offset-last-writer/);
});

test('R18N.3 fixed-target support chain follows the same F-latched world target', () => {
  assert.match(preContact, /activeIntentPlan[\s\S]*residualBodyReachRuntime\.trackWorldTarget\(\{[\s\S]*targetCenter: activeInterceptIntent\?\.report\?\.targetCenter/);
  assert.match(bodyReach, /function trackWorldTarget\(input = \{\}, deltaSeconds = 1 \/ 60\)/);
  assert.match(bodyReach, /activeTargetOffset/);
  assert.match(bodyReach, /profile\.bodyReachSpeedMps/);
  assert.match(bodyReach, /profile\.maxBodyReachMeters/);
  assert.match(bodyReach, /fixed-world-target-support-chain-no-contact-authority/);
  assert.match(bodyReach, /hipsModified: false/);
  assert.match(bodyReach, /feetModified: false/);
});

test('R18N.3 publishes world-target before/after evidence without contact authority', () => {
  assert.match(preContact, /activeInterceptTargetErrorBeforeMeters/);
  assert.match(preContact, /activeInterceptTargetErrorAfterMeters/);
  assert.match(preContact, /activeInterceptPrimaryCarryMeters/);
  assert.match(preContact, /activeInterceptResidualCarryMeters/);
  assert.match(preContact, /activeInterceptSupportAuthority/);
  assert.doesNotMatch(preContact, /parryGate\.confirm\(/);
  assert.doesNotMatch(preContact, /combat\.resolveContact\(/);
  assert.doesNotMatch(preContact, /probeSweptSwordBucklerContact\(/);
});

test('R18N.3 preserves production tracking limits and real-contact reset boundary', () => {
  assert.match(tracking, /maxTrackingSpeedMps: 1\.6/);
  assert.match(tracking, /upperArmMaxDegrees: 14/);
  assert.match(tracking, /lowerArmMaxDegrees: 18/);
  assert.match(bodyReach, /maxBodyReachMeters: 0\.035/);
  assert.match(bodyReach, /chestMaxDegrees: 2\.4/);
  assert.match(bodyReach, /spineMaxDegrees: 1\.6/);
  assert.match(handoff, /probeSweptSwordBucklerContact\(/);
  assert.match(handoff, /parryGate\.confirm\(/);
  assert.match(handoff, /fineTrackingRuntime\.reset\(\);/);
  assert.match(handoff, /residualBodyReachRuntime\.reset\(\);/);
});

test('R18N.3 does not promote the fixed target into contact authority', () => {
  assert.match(intent, /bounded-guidance-only-real-swept-contact-still-required/);
  assert.match(intent, /reason: 'latched-active-shield-intercept'/);
  assert.doesNotMatch(intent, /parryGate\.confirm|probeSweptSwordBucklerContact|combat\.resolveContact/);
  assert.doesNotMatch(bodyReach, /parryGate\.confirm|probeSweptSwordBucklerContact|combat\.resolveContact/);
});
