import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ATTACKER_RECOIL_PRESENTATION_PHASES,
  CONTACT_RELEASE_SEPARATION_MOTION_STAGE,
  sampleAttackerRecoilPresentation,
} from '../src/combat/attacker-recoil-presentation.js';
import { buildPostCouplingRecoilStaggerHandoff } from '../src/combat/post-coupling-recoil-stagger-handoff.js';

function recoilPlan(responseClass = 'parry-directional-recoil') {
  return {
    planned: true,
    sequence: 21,
    attackDirection: 'right',
    responseClass,
    weapon: {
      direction: responseClass === 'perfect-parry-directional-recoil'
        ? { x: -0.78, y: 0.31, z: -0.54 }
        : { x: -0.7, y: 0.25, z: -0.65 },
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

function couplingReport(outcome = 'parry') {
  const perfect = outcome === 'perfect-parry';
  return {
    outcome,
    elapsedMs: perfect ? 104 : 96,
    shieldTangent: { x: 0.96, y: 0, z: 0.28 },
    incomingDirection: { x: 0.05, y: -0.1, z: 0.99 },
    shieldOffset: { x: perfect ? 0.125 : 0.105, y: 0.02, z: 0.01 },
    attackerWeaponOffset: { x: perfect ? 0.13 : 0.105, y: 0.018, z: 0.01 },
    finalSurface: { center: { x: perfect ? 0.125 : 0.105, y: 1.1, z: 0.2 } },
    profile: { durationMs: perfect ? 104 : 96 },
  };
}

function sampleOverrides(handoff, distanceMeters) {
  return {
    ...handoff.profileOverrides,
    releaseSeparationWindowMs: handoff.separation.releaseWindowMs,
    releaseSeparationDistanceMeters: distanceMeters,
  };
}

test('G4.3B.5R.2.4.1 creates an explicit SEPARATION phase after coupling release', () => {
  const handoff = buildPostCouplingRecoilStaggerHandoff({
    plan: recoilPlan(),
    couplingReport: couplingReport(),
    baseProfile: { contactHoldMs: 28, legStrengthScale: 0.78 },
  });
  const overrides = sampleOverrides(handoff, 0.065);
  const elapsedMs = handoff.initialElapsedMs + handoff.separation.releaseWindowMs * 0.5;
  const sample = sampleAttackerRecoilPresentation(handoff.plan, elapsedMs, overrides);

  assert.equal(sample.motionStage, CONTACT_RELEASE_SEPARATION_MOTION_STAGE);
  assert.equal(sample.phase, ATTACKER_RECOIL_PRESENTATION_PHASES.SEPARATION);
  assert.ok(sample.weights.separationWeight > 0 && sample.weights.separationWeight < 1);
  assert.equal(sample.weights.legWeight, 0);
  assert.ok(sample.weights.armWeight > sample.weights.torsoWeight);
  assert.ok(sample.pose.releaseSeparationDistanceMeters > 0.02);
});

test('G4.3B.5R.2.4.1 normal Parry reaches about 6.5cm release target before B3 impulse takes over', () => {
  const handoff = buildPostCouplingRecoilStaggerHandoff({
    plan: recoilPlan(),
    couplingReport: couplingReport(),
    baseProfile: { contactHoldMs: 28, legStrengthScale: 0.78 },
  });
  const overrides = sampleOverrides(handoff, 0.065);
  const releaseEnd = handoff.initialElapsedMs + handoff.separation.releaseWindowMs;
  const sample = sampleAttackerRecoilPresentation(handoff.plan, releaseEnd, overrides);
  const offset = sample.pose.releaseSeparationOffsetMeters;
  const displacement = Math.hypot(offset.x, offset.y, offset.z);

  assert.equal(sample.phase, ATTACKER_RECOIL_PRESENTATION_PHASES.SEPARATION);
  assert.ok(Math.abs(displacement - 0.065) < 1e-6);
  assert.ok(Math.abs(sample.pose.releaseSeparationDistanceMeters - 0.065) < 1e-6);
  assert.equal(sample.weights.legWeight, 0);
});

test('G4.3B.5R.2.4.1 Perfect Parry gets a larger 9.5cm separation than normal Parry', () => {
  const parryHandoff = buildPostCouplingRecoilStaggerHandoff({
    plan: recoilPlan(),
    couplingReport: couplingReport(),
    baseProfile: { contactHoldMs: 28, legStrengthScale: 0.78 },
  });
  const perfectHandoff = buildPostCouplingRecoilStaggerHandoff({
    plan: recoilPlan('perfect-parry-directional-recoil'),
    couplingReport: couplingReport('perfect-parry'),
    baseProfile: { contactHoldMs: 36, legStrengthScale: 1 },
  });
  const parry = sampleAttackerRecoilPresentation(
    parryHandoff.plan,
    parryHandoff.initialElapsedMs + parryHandoff.separation.releaseWindowMs,
    sampleOverrides(parryHandoff, 0.065),
  );
  const perfect = sampleAttackerRecoilPresentation(
    perfectHandoff.plan,
    perfectHandoff.initialElapsedMs + perfectHandoff.separation.releaseWindowMs,
    sampleOverrides(perfectHandoff, 0.095),
  );

  assert.ok(perfect.pose.releaseSeparationDistanceMeters > parry.pose.releaseSeparationDistanceMeters);
  assert.ok(Math.abs(perfect.pose.releaseSeparationDistanceMeters - 0.095) < 1e-6);
});

test('G4.3B.5R.2.4.1 separation hands off continuously into normal B3 IMPULSE', () => {
  const handoff = buildPostCouplingRecoilStaggerHandoff({
    plan: recoilPlan(),
    couplingReport: couplingReport(),
    baseProfile: { contactHoldMs: 28, legStrengthScale: 0.78 },
  });
  const overrides = sampleOverrides(handoff, 0.065);
  const releaseEnd = handoff.initialElapsedMs + handoff.separation.releaseWindowMs;
  const atRelease = sampleAttackerRecoilPresentation(handoff.plan, releaseEnd, overrides);
  const afterRelease = sampleAttackerRecoilPresentation(handoff.plan, releaseEnd + 8, overrides);

  assert.equal(afterRelease.phase, ATTACKER_RECOIL_PRESENTATION_PHASES.IMPULSE);
  assert.ok(afterRelease.weights.armWeight >= atRelease.weights.armWeight);
  assert.ok(afterRelease.pose.releaseSeparationDistanceMeters < atRelease.pose.releaseSeparationDistanceMeters);
  assert.ok(Math.hypot(
    afterRelease.pose.weaponAimOffsetMeters.x,
    afterRelease.pose.weaponAimOffsetMeters.y,
    afterRelease.pose.weaponAimOffsetMeters.z,
  ) >= afterRelease.pose.releaseSeparationDistanceMeters);
});

test('G4.3B.5R.2.4.1 runtime source applies the separation target through the real arm IK path', () => {
  const source = fs.readFileSync(new URL('../src/combat/attacker-recoil-presentation.js', import.meta.url), 'utf8');

  assert.match(source, /SEPARATION: 'separation'/);
  assert.match(source, /releaseSeparationDistanceMeters/);
  assert.match(source, /targetWorld\.copy\(handWorld\)\.add\(aimOffset\)/);
  assert.match(source, /aimEffectorWithBone\([\s\S]*rig\.bones\['upperarm\.r'\]/);
  assert.match(source, /aimEffectorWithBone\([\s\S]*rig\.bones\['lowerarm\.r'\]/);
});
