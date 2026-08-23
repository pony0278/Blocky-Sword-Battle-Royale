import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../tools/action-studio/shield-driven-contact-coupling-lab-r281.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url), 'utf8');

function functionBody(name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must exist`);
  return source.slice(start, end);
}

test('current R281 HTML runs the Step 3A shield to sword to hand entry', () => {
  assert.match(html, /Step 3A · Live Shield → Sword → Wrist-Grip Constraint/);
  assert.match(html, /shield-driven-contact-coupling-lab-r281\.js\?v=g43b5r281-top-right-old-b3-r18e/);
  assert.match(html, /PARRY NOW \(F\)/);
  assert.doesNotMatch(html, /data-mode="perfect"/);
});

test('current R281 starts shield presentation only from manual Parry input', () => {
  const manual = functionBody('triggerParryNow', 'forceOldTwoActorB3');
  const preContact = functionBody('updateParryPreContact', 'updatePreContact');
  assert.match(manual, /parryGate\.arm/);
  assert.match(manual, /predictivePresentation\.start/);
  assert.doesNotMatch(preContact, /predictivePresentation\.start/);
  assert.match(preContact, /predictivePresentation\.update/);
  assert.match(preContact, /sampleActiveShieldLeadMotion/);
});

test('current R281 confirms Parry through real swept contact before live wrist-grip transfer', () => {
  const contact = functionBody('resolveContact', 'updateHud');
  assert.match(contact, /probeSweptSwordBucklerContact/);
  assert.match(contact, /if \(!latestContact\.contact\) return/);
  assert.match(contact, /parryGate\.confirm/);
  assert.match(contact, /swordGripConstraint\.start/);
  assert.ok(contact.indexOf('parryGate.confirm') < contact.indexOf('swordGripConstraint.start'));
  assert.doesNotMatch(contact, /publishPostCouplingRecoilStaggerHandoff/);
});

test('current R281 releases a verified TOP or RIGHT live-contact pose into OLD B3', () => {
  assert.match(source, /buildLiveParryOldB3Handoff/);
  assert.match(source, /function releaseLiveContactToOldB3/);
  assert.match(source, /publishPostCouplingRecoilStaggerHandoff/);
  assert.match(source, /sampleLiveParryOldB3ReleaseBlend/);
  assert.match(source, /releasedToOldB3/);
});

test('current R281 keeps the verified legacy Two-Actor B3 plan unchanged behind the direct diagnostic', () => {
  assert.match(source, /LEGACY_TWO_ACTOR_RECOIL_HANDOFF_MODE/);
  assert.match(source, /LEGACY_TWO_ACTOR_RECOIL_PASSTHROUGH_STAGE/);
  assert.match(source, /direct-existing-old-two-actor-b3-diagnostic/);
  assert.match(source, /combat\.update\(0\.021/);
});

test('current R281 contains no legacy authored-offset coupling, release bridge, Perfect, or balance-break authority', () => {
  assert.doesNotMatch(source, /createShieldDrivenContactCouplingRuntime/);
  assert.doesNotMatch(source, /couplingRuntime\.start/);
  assert.match(source, /createLiveShieldSwordGripContactRuntime/);
  assert.doesNotMatch(source, /prepareLegacyReleaseBridge/);
  assert.doesNotMatch(source, /perfect-parry/);
  assert.doesNotMatch(source, /createParryBackwardBalanceBreakRuntime/);
  assert.doesNotMatch(source, /TWO_ACTOR_WHOLE_BODY_RECOIL_BURST_STAGE/);
});

test('current R281 retains the independently verified Step 1 B3 diagnostic', () => {
  assert.match(html, /id="forceOldB3"/);
  assert.match(source, /function forceOldTwoActorB3/);
  assert.match(source, /direct-existing-old-two-actor-b3-diagnostic/);
});
