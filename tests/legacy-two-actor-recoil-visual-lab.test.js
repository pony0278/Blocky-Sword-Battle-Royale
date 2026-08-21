import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../tools/action-studio/shield-driven-contact-coupling-lab-r28.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url), 'utf8');

test('G4.3B.5R.2.8 HTML runs the dedicated legacy recoil visual entry', () => {
  assert.match(html, /G4\.3B\.5R\.2\.8 · Legacy Two-Actor Recoil Passthrough/);
  assert.match(html, /shield-driven-contact-coupling-lab-r28\.js\?v=g43b5r28-real-base/);
  assert.match(html, /shield pose → OLD frozen contact pose/);
  assert.doesNotMatch(html, /68 ms · 30fps next frame/);
});

test('G4.3B.5R.2.8 visual lab restores old frozen contact base during the historical contact hold', () => {
  assert.match(source, /const LEGACY_HOLD_MS = Object\.freeze\(\{ parry: 28, 'perfect-parry': 36 \}\)/);
  assert.match(source, /legacyContactPose = captureRigPose\(attacker\.rig\)/);
  assert.match(source, /couplingRuntime\.reapplyAttackerConstraint\(latestCouplingReport\)/);
  assert.match(source, /couplingReleasePose = captureRigPose\(attacker\.rig\)/);
  assert.match(source, /blendRecoveryPose\([\s\S]*couplingReleasePose[\s\S]*legacyContactPose[\s\S]*progress/);
});

test('G4.3B.5R.2.8 bridge advances before old B3 update and disappears when impulse begins', () => {
  const combatBranch = source.slice(source.indexOf('if (combat.active && !couplingOwnsWeapon)'), source.indexOf('} else if (!combat.active)'));
  const advance = combatBranch.indexOf('advanceReleaseBridge(deltaMs)');
  const update = combatBranch.indexOf('combat.update(deltaSeconds, { camera })');
  const finish = combatBranch.indexOf('finishReleaseBridgeIfReady()');
  assert.ok(advance >= 0 && update > advance && finish > update);
});

test('G4.3B.5R.2.8 visual path has no balance-break or whole-body-burst pose authority', () => {
  assert.doesNotMatch(source, /createParryBackwardBalanceBreakRuntime/);
  assert.doesNotMatch(source, /TWO_ACTOR_WHOLE_BODY_RECOIL_BURST_STAGE/);
  assert.match(source, /LEGACY_TWO_ACTOR_RECOIL_PASSTHROUGH_STAGE/);
  assert.match(source, /originalB2PlanPreservedAfterCoupling: true/);
  assert.match(source, /noBalanceBreakOverlayAfterRelease: true/);
});