import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  POST_COUPLING_RECOIL_STAGGER_STAGE,
  buildPostCouplingRecoilStaggerHandoff,
  consumePostCouplingRecoilStaggerHandoff,
  publishPostCouplingRecoilStaggerHandoff,
} from '../src/combat/post-coupling-recoil-stagger-handoff.js';

function recoilPlan(responseClass = 'parry-directional-recoil') {
  return {
    planned: true,
    sequence: 12,
    attackDirection: 'right',
    responseClass,
    weapon: {
      direction: { x: -0.7, y: 0.25, z: -0.65 },
      lateralSign: -1,
      strength: responseClass === 'perfect-parry-directional-recoil' ? 1 : 0.68,
      deflectDegrees: responseClass === 'perfect-parry-directional-recoil' ? 44 : 30,
    },
    body: {
      strength: responseClass === 'perfect-parry-directional-recoil' ? 0.56 : 0.38,
      yawDegrees: -10,
      pitchDegrees: -7,
      rollDegrees: -2.8,
    },
  };
}

function couplingReport(outcome = 'parry', drive = 0.105, follow = 0.105) {
  return {
    outcome,
    elapsedMs: outcome === 'perfect-parry' ? 104 : 96,
    shieldOffset: { x: drive, y: 0.02, z: 0.01 },
    attackerWeaponOffset: { x: follow, y: 0.018, z: 0.01 },
    finalSurface: { center: { x: drive, y: 1.1, z: 0.2 } },
    profile: { durationMs: outcome === 'perfect-parry' ? 104 : 96 },
  };
}

test('G4.3B.5R.2.1 Parry handoff skips the second B3 contact hold', () => {
  const handoff = buildPostCouplingRecoilStaggerHandoff({
    plan: recoilPlan(),
    couplingReport: couplingReport(),
    surfaceAtContact: { center: { x: 0, y: 1.1, z: 0.2 } },
    baseProfile: { contactHoldMs: 28, legStrengthScale: 0.78 },
  });

  assert.equal(handoff.stage, POST_COUPLING_RECOIL_STAGGER_STAGE);
  assert.equal(handoff.accepted, true);
  assert.equal(handoff.initialElapsedMs, 28);
  assert.equal(handoff.reason, 'post-coupling-body-stagger-ready');
});

test('G4.3B.5R.2.1 transfers visual authority from weapon bounce to body stagger', () => {
  const source = recoilPlan();
  const handoff = buildPostCouplingRecoilStaggerHandoff({
    plan: source,
    couplingReport: couplingReport(),
    surfaceAtContact: { center: { x: 0, y: 1.1, z: 0.2 } },
    baseProfile: { contactHoldMs: 28, legStrengthScale: 0.78 },
  });

  assert.ok(handoff.plan.weapon.strength < source.weapon.strength * 0.4);
  assert.ok(handoff.plan.weapon.deflectDegrees < source.weapon.deflectDegrees * 0.4);
  assert.ok(Math.abs(handoff.plan.body.yawDegrees) > Math.abs(source.body.yawDegrees));
  assert.ok(handoff.plan.body.strength > source.body.strength);
  assert.ok(handoff.profileOverrides.legStrengthScale > 0.78);
  assert.equal(handoff.channelIntent.weapon, 'reduced-after-shield-driven-deflection');
  assert.equal(handoff.channelIntent.torso, 'primary-post-coupling-inertia');
});

test('G4.3B.5R.2.1 stronger coupling produces stronger inherited stagger momentum', () => {
  const weak = buildPostCouplingRecoilStaggerHandoff({
    plan: recoilPlan(),
    couplingReport: couplingReport('parry', 0.055, 0.05),
    surfaceAtContact: { center: { x: 0, y: 1.1, z: 0.2 } },
    baseProfile: { contactHoldMs: 28, legStrengthScale: 0.78 },
  });
  const strong = buildPostCouplingRecoilStaggerHandoff({
    plan: recoilPlan(),
    couplingReport: couplingReport('parry', 0.13, 0.12),
    surfaceAtContact: { center: { x: 0, y: 1.1, z: 0.2 } },
    baseProfile: { contactHoldMs: 28, legStrengthScale: 0.78 },
  });

  assert.ok(strong.couplingMomentum.momentum > weak.couplingMomentum.momentum);
  assert.ok(Math.abs(strong.plan.body.yawDegrees) > Math.abs(weak.plan.body.yawDegrees));
});

test('G4.3B.5R.2.1 Perfect keeps less second weapon bounce but more body stagger than Parry', () => {
  const parry = buildPostCouplingRecoilStaggerHandoff({
    plan: recoilPlan(),
    couplingReport: couplingReport('parry'),
    baseProfile: { contactHoldMs: 28, legStrengthScale: 0.78 },
  });
  const perfect = buildPostCouplingRecoilStaggerHandoff({
    plan: recoilPlan('perfect-parry-directional-recoil'),
    couplingReport: couplingReport('perfect-parry', 0.125, 0.13),
    baseProfile: { contactHoldMs: 36, legStrengthScale: 1 },
  });

  assert.equal(perfect.initialElapsedMs, 36);
  assert.ok(perfect.plan.weapon.strength < recoilPlan('perfect-parry-directional-recoil').weapon.strength * 0.3);
  assert.ok(Math.abs(perfect.plan.body.yawDegrees) > Math.abs(parry.plan.body.yawDegrees));
});

test('G4.3B.5R.2.1 release signal is one-shot per attacker rig', () => {
  const rig = {};
  assert.equal(publishPostCouplingRecoilStaggerHandoff(rig, { couplingReport: couplingReport() }), true);
  const first = consumePostCouplingRecoilStaggerHandoff(rig);
  const second = consumePostCouplingRecoilStaggerHandoff(rig);
  assert.equal(first.stage, POST_COUPLING_RECOIL_STAGGER_STAGE);
  assert.equal(second, null);
});

test('G4.3B.5R.2.1 source contract publishes at coupling completion and consumes before B3 elapsed advances', () => {
  const couplingSource = fs.readFileSync(new URL('../src/combat/shield-driven-contact-coupling.js', import.meta.url), 'utf8');
  const recoilSource = fs.readFileSync(new URL('../src/combat/attacker-recoil-presentation.js', import.meta.url), 'utf8');

  assert.match(couplingSource, /publishPostCouplingRecoilStaggerHandoff\(attackerRig/);
  assert.match(recoilSource, /const handoff = applyPendingPostCouplingHandoff\(\);\s*elapsedMs \+=/);
  assert.match(recoilSource, /elapsedMs = Math\.max\(elapsedMs, handoff\.initialElapsedMs\)/);
  assert.match(recoilSource, /activePlan = handoff\.plan/);
  assert.match(recoilSource, /activeProfile = \{ \.\.\.activeProfile, \.\.\.handoff\.profileOverrides \}/);
});
