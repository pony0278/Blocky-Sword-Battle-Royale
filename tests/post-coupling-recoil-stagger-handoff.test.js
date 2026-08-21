import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  COUPLED_MOMENTUM_CONTINUATION_STAGE,
  POST_COUPLING_RECOIL_STAGGER_BASE_STAGE,
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
      strength: responseClass === 'blocked-weapon-bounce'
        ? 0.28
        : responseClass === 'perfect-parry-directional-recoil' ? 1 : 0.68,
      deflectDegrees: responseClass === 'blocked-weapon-bounce'
        ? 12
        : responseClass === 'perfect-parry-directional-recoil' ? 44 : 30,
    },
    body: {
      strength: responseClass === 'blocked-weapon-bounce'
        ? 0.12
        : responseClass === 'perfect-parry-directional-recoil' ? 0.56 : 0.38,
      yawDegrees: responseClass === 'blocked-weapon-bounce' ? -4 : -10,
      pitchDegrees: responseClass === 'blocked-weapon-bounce' ? -3 : -7,
      rollDegrees: responseClass === 'blocked-weapon-bounce' ? -1.1 : -2.8,
    },
  };
}

function couplingReport(outcome = 'parry', drive = 0.105, follow = 0.105) {
  return {
    outcome,
    elapsedMs: outcome === 'perfect-parry' ? 104 : outcome === 'block' ? 105 : 96,
    shieldTangent: { x: 0.96, y: 0, z: 0.28 },
    incomingDirection: { x: 0.05, y: -0.1, z: 0.99 },
    shieldOffset: { x: drive, y: 0.02, z: 0.01 },
    attackerWeaponOffset: { x: follow, y: 0.018, z: 0.01 },
    finalSurface: { center: { x: drive, y: 1.1, z: 0.2 } },
    profile: { durationMs: outcome === 'perfect-parry' ? 104 : outcome === 'block' ? 105 : 96 },
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function normalize(v) {
  const m = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

test('G4.3B.5R.2.2 keeps compatibility export on the new continuation stage', () => {
  assert.equal(POST_COUPLING_RECOIL_STAGGER_BASE_STAGE, 'G4.3B.5R.2.1');
  assert.equal(COUPLED_MOMENTUM_CONTINUATION_STAGE, 'G4.3B.5R.2.2');
  assert.equal(POST_COUPLING_RECOIL_STAGGER_STAGE, COUPLED_MOMENTUM_CONTINUATION_STAGE);
});

test('G4.3B.5R.2.2 Parry skips the second hold and stretches force-chain recovery to about 0.4s', () => {
  const handoff = buildPostCouplingRecoilStaggerHandoff({
    plan: recoilPlan(),
    couplingReport: couplingReport(),
    surfaceAtContact: { center: { x: 0, y: 1.1, z: 0.2 } },
    baseProfile: { contactHoldMs: 28, impulseEndMs: 105, recoilEndMs: 235, settleEndMs: 390, legStrengthScale: 0.78 },
  });

  assert.equal(handoff.stage, COUPLED_MOMENTUM_CONTINUATION_STAGE);
  assert.equal(handoff.accepted, true);
  assert.equal(handoff.initialElapsedMs, 28);
  assert.equal(handoff.reason, 'coupled-momentum-continuation-ready');
  assert.equal(handoff.profileOverrides.impulseEndMs, 118);
  assert.equal(handoff.profileOverrides.recoilEndMs, 260);
  assert.equal(handoff.profileOverrides.settleEndMs, 430);
  assert.equal(handoff.timelineIntent.residualWeaponAndShoulderEndMs, 90);
  assert.equal(handoff.timelineIntent.torsoAndHipsEndMs, 232);
  assert.equal(handoff.timelineIntent.fullRecoveryEndMs, 402);
});

test('G4.3B.5R.2.2 Parry residual weapon response is heavier than Block but below old full Parry', () => {
  const source = recoilPlan();
  const handoff = buildPostCouplingRecoilStaggerHandoff({
    plan: source,
    couplingReport: couplingReport(),
    surfaceAtContact: { center: { x: 0, y: 1.1, z: 0.2 } },
    baseProfile: { contactHoldMs: 28, legStrengthScale: 0.78 },
  });

  assert.ok(handoff.plan.weapon.strength > 0.40);
  assert.ok(handoff.plan.weapon.strength > recoilPlan('blocked-weapon-bounce').weapon.strength);
  assert.ok(handoff.plan.weapon.strength < source.weapon.strength);
  assert.ok(handoff.plan.weapon.deflectDegrees > recoilPlan('blocked-weapon-bounce').weapon.deflectDegrees);
  assert.ok(handoff.plan.weapon.deflectDegrees < source.weapon.deflectDegrees);
  assert.ok(Math.abs(handoff.plan.body.yawDegrees) > Math.abs(source.body.yawDegrees));
  assert.ok(handoff.plan.body.strength > source.body.strength);
  assert.ok(handoff.profileOverrides.legStrengthScale > 0.78);
  assert.equal(handoff.channelIntent.weapon, 'residual-inertia-continues-along-shield-driven-direction');
  assert.equal(handoff.channelIntent.shoulder, 'weapon-inertia-pulls-shoulder-before-body');
});

test('G4.3B.5R.2.2 continuation direction follows the actual coupled attacker weapon displacement', () => {
  const source = recoilPlan();
  const report = couplingReport('parry');
  const handoff = buildPostCouplingRecoilStaggerHandoff({
    plan: source,
    couplingReport: report,
    baseProfile: { contactHoldMs: 28, legStrengthScale: 0.78 },
  });
  const expected = normalize(report.attackerWeaponOffset);
  const actual = handoff.plan.weapon.direction;

  assert.equal(handoff.continuation.source, 'coupling-attacker-weapon-offset');
  assert.ok(dot(expected, actual) > 0.999);
  assert.ok(dot(normalize(source.weapon.direction), actual) < 0.25);
});

test('G4.3B.5R.2.2 stronger coupling produces stronger inherited body momentum without changing causality', () => {
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
  assert.equal(strong.plan.weapon.continuationSource, 'coupling-attacker-weapon-offset');
});

test('G4.3B.5R.2.2 Perfect preserves a stronger and longer continuation than normal Parry', () => {
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
  assert.ok(perfect.plan.weapon.strength > parry.plan.weapon.strength);
  assert.ok(perfect.plan.weapon.deflectDegrees > parry.plan.weapon.deflectDegrees);
  assert.ok(Math.abs(perfect.plan.body.yawDegrees) > Math.abs(parry.plan.body.yawDegrees));
  assert.equal(perfect.profileOverrides.settleEndMs, 520);
});

test('G4.3B.5R.2.2 Block keeps the B2 direction instead of inventing Parry continuation', () => {
  const source = recoilPlan('blocked-weapon-bounce');
  const handoff = buildPostCouplingRecoilStaggerHandoff({
    plan: source,
    couplingReport: couplingReport('block', 0.035, 0.025),
    baseProfile: { contactHoldMs: 18, legStrengthScale: 0.42 },
  });

  assert.equal(handoff.reason, 'post-coupling-body-stagger-ready');
  assert.equal(handoff.continuation.source, 'b2-block-recoil-direction');
  assert.deepEqual(handoff.plan.weapon.direction, normalize(source.weapon.direction));
  assert.equal(handoff.timelineIntent, null);
});

test('G4.3B.5R.2.2 release signal is one-shot per attacker rig', () => {
  const rig = {};
  assert.equal(publishPostCouplingRecoilStaggerHandoff(rig, { couplingReport: couplingReport() }), true);
  const first = consumePostCouplingRecoilStaggerHandoff(rig);
  const second = consumePostCouplingRecoilStaggerHandoff(rig);
  assert.equal(first.stage, COUPLED_MOMENTUM_CONTINUATION_STAGE);
  assert.equal(second, null);
});

test('G4.3B.5R.2.2 source contract publishes shield direction and consumes before B3 elapsed advances', () => {
  const couplingSource = fs.readFileSync(new URL('../src/combat/shield-driven-contact-coupling.js', import.meta.url), 'utf8');
  const recoilSource = fs.readFileSync(new URL('../src/combat/attacker-recoil-presentation.js', import.meta.url), 'utf8');

  assert.match(couplingSource, /shieldTangent: sample\.shieldTangent/);
  assert.match(couplingSource, /attackerWeaponOffset: sample\.attackerWeaponOffset/);
  assert.match(couplingSource, /publishPostCouplingRecoilStaggerHandoff\(attackerRig/);
  assert.match(recoilSource, /const handoff = applyPendingPostCouplingHandoff\(\);\s*elapsedMs \+=/);
  assert.match(recoilSource, /elapsedMs = Math\.max\(elapsedMs, handoff\.initialElapsedMs\)/);
  assert.match(recoilSource, /activePlan = handoff\.plan/);
  assert.match(recoilSource, /activeProfile = \{ \.\.\.activeProfile, \.\.\.handoff\.profileOverrides \}/);
});
