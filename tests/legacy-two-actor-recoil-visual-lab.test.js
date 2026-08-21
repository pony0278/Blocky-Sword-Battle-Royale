import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../tools/action-studio/shield-driven-contact-coupling-lab-r281.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url), 'utf8');

test('G4.3B.5R.2.8.1 HTML runs the Active Shield-Lead Parry entry', () => {
  assert.match(html, /G4\.3B\.5R\.2\.8\.1 · Active Shield-Lead Parry/);
  assert.match(html, /shield-driven-contact-coupling-lab-r281\.js\?v=g43b5r281-active-shield-lead/);
  assert.match(html, /Predictive shield lead → MOVING shield contact/);
  assert.match(html, /Post-contact Parry HOLD<\/span><b>0 ms/);
});

test('G4.3B.5R.2.8.1 restores predictive Parry before authoritative sword × shield contact', () => {
  assert.match(source, /analyzePredictiveInterceptParry/);
  assert.match(source, /createPredictiveInterceptParryPresentationRuntime/);
  assert.match(source, /predictivePresentation\.start\(/);
  assert.match(source, /predictivePresentation\.update\(/);
  assert.match(source, /sampleActiveShieldLeadMotion\(/);

  const frameBranch = source.slice(source.indexOf('const currentBlade = captureBladePolyline()'), source.indexOf('previousBlade = currentBlade'));
  const preContact = frameBranch.indexOf('updatePreContact(snapshot, currentBlade, deltaSeconds)');
  const contact = frameBranch.indexOf('resolveContact(snapshot, currentBlade, deltaSeconds)');
  assert.ok(preContact >= 0 && contact > preContact, 'shield lead must update before contact is resolved');
});

test('G4.3B.5R.2.8.1 contact consumes the old dead hold and enters moving shield DRIVE immediately', () => {
  const contactBranch = source.slice(source.indexOf('function resolveContact'), source.indexOf('function prepareLegacyReleaseBridge'));
  assert.match(contactBranch, /buildActiveShieldLeadCouplingStart\(/);
  assert.match(contactBranch, /profile: latestLeadHandoff\.couplingProfileOverrides/);
  assert.match(contactBranch, /couplingRuntime\.update\(latestLeadHandoff\.initialCouplingElapsedMs \/ 1000\)/);
  assert.match(source, /post-contact HOLD 0ms/);
  assert.match(source, /attacker arm follow/);
});

test('G4.3B.5R.2.8.1 still restores old frozen contact base during the historical B3 hold', () => {
  assert.match(source, /const LEGACY_HOLD_MS = Object\.freeze\(\{ parry: 28, 'perfect-parry': 36 \}\)/);
  assert.match(source, /legacyContactPose = captureRigPose\(attacker\.rig\)/);
  assert.match(source, /couplingRuntime\.reapplyAttackerConstraint\(latestCouplingReport\)/);
  assert.match(source, /couplingReleasePose = captureRigPose\(attacker\.rig\)/);
  assert.match(source, /blendRecoveryPose\([\s\S]*couplingReleasePose[\s\S]*legacyContactPose[\s\S]*progress/);
});

test('G4.3B.5R.2.8.1 bridge advances before old B3 update and keeps the old recoil ordering', () => {
  const combatBranch = source.slice(source.indexOf('if (combat.active && !couplingOwnsWeapon)'), source.indexOf('} else if (!combat.active)'));
  const advance = combatBranch.indexOf('advanceReleaseBridge(deltaMs)');
  const update = combatBranch.indexOf('combat.update(deltaSeconds, { camera })');
  const finish = combatBranch.indexOf('finishReleaseBridgeIfReady()');
  assert.ok(advance >= 0 && update > advance && finish > update);
  assert.match(source, /originalB2PlanPreservedAfterCoupling: true/);
  assert.match(source, /legacyB3StartsAtZeroMs: true/);
});

test('G4.3B.5R.2.8.1 visual path has no balance-break or whole-body-burst pose authority', () => {
  assert.doesNotMatch(source, /createParryBackwardBalanceBreakRuntime/);
  assert.doesNotMatch(source, /TWO_ACTOR_WHOLE_BODY_RECOIL_BURST_STAGE/);
  assert.match(source, /LEGACY_TWO_ACTOR_RECOIL_PASSTHROUGH_STAGE/);
  assert.match(source, /noBalanceBreakOverlayAfterRelease: true/);
});
