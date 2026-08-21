import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  IMPACT_ACCENT_FULL_BODY_RECOIL_FUSION_STAGE,
  IMPACT_ACCENT_PHASES,
  sampleImpactAccentFusion,
} from '../src/combat/impact-accent-full-body-recoil-fusion.js';
import {
  FULL_BODY_RECOIL_FUSION_STAGE,
  ATTACKER_RECOIL_PRESENTATION_PHASES,
  sampleAttackerRecoilPresentation,
} from '../src/combat/attacker-recoil-presentation.js';
import { buildPostCouplingRecoilStaggerHandoff } from '../src/combat/post-coupling-recoil-stagger-handoff.js';

function recoilPlan(responseClass = 'parry-directional-recoil') {
  return {
    planned: true,
    sequence: 42,
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

function separationSample(responseClass = 'parry-directional-recoil', ratio = 1) {
  const outcome = responseClass === 'perfect-parry-directional-recoil' ? 'perfect-parry' : 'parry';
  const plan = recoilPlan(responseClass);
  const handoff = buildPostCouplingRecoilStaggerHandoff({
    plan,
    couplingReport: couplingReport(outcome),
    baseProfile: {
      contactHoldMs: responseClass === 'perfect-parry-directional-recoil' ? 36 : 28,
      legStrengthScale: responseClass === 'perfect-parry-directional-recoil' ? 1 : 0.78,
    },
  });
  const distance = responseClass === 'perfect-parry-directional-recoil' ? 0.095 : 0.065;
  return sampleAttackerRecoilPresentation(
    handoff.plan,
    handoff.initialElapsedMs + handoff.separation.releaseWindowMs * ratio,
    {
      ...handoff.profileOverrides,
      releaseSeparationWindowMs: handoff.separation.releaseWindowMs,
      releaseSeparationDistanceMeters: distance,
    },
  );
}

test('G4.3B.5R.2.4.2 contact accent compresses then rebounds without root motion', () => {
  const compression = sampleImpactAccentFusion({ outcome: 'parry', elapsedMs: 30, attackDirection: 'right' });
  const rebound = sampleImpactAccentFusion({ outcome: 'parry', elapsedMs: 92, attackDirection: 'right' });

  assert.equal(compression.stage, IMPACT_ACCENT_FULL_BODY_RECOIL_FUSION_STAGE);
  assert.equal(compression.phase, IMPACT_ACCENT_PHASES.COMPRESSION);
  assert.ok(compression.scale > 0.7);
  assert.ok(compression.attacker.pelvisDropMeters > 0);
  assert.ok(compression.defender.pelvisDropMeters > compression.attacker.pelvisDropMeters);
  assert.equal(rebound.phase, IMPACT_ACCENT_PHASES.REBOUND);
  assert.ok(rebound.scale < 0);
  assert.equal('rootTranslationMeters' in compression.attacker, false);
});

test('G4.3B.5R.2.4.2 Perfect Parry contact accent is stronger on the attacker than normal Parry', () => {
  const parry = sampleImpactAccentFusion({ outcome: 'parry', elapsedMs: 34, attackDirection: 'right' });
  const perfect = sampleImpactAccentFusion({ outcome: 'perfect-parry', elapsedMs: 34, attackDirection: 'right' });
  assert.ok(Math.abs(perfect.attacker.chestPitchDegrees) > Math.abs(parry.attacker.chestPitchDegrees));
  assert.ok(Math.abs(perfect.attacker.leftKneeBendDegrees) > Math.abs(parry.attacker.leftKneeBendDegrees));
});

test('G4.3B.5R.2.4.2 separation propagates weapon -> chest -> spine -> hips -> legs instead of arm-only motion', () => {
  const sample = separationSample('parry-directional-recoil', 1);

  assert.equal(sample.phase, ATTACKER_RECOIL_PRESENTATION_PHASES.SEPARATION);
  assert.equal(sample.fusionStage, FULL_BODY_RECOIL_FUSION_STAGE);
  assert.equal(sample.fusionStage, IMPACT_ACCENT_FULL_BODY_RECOIL_FUSION_STAGE);
  assert.ok(sample.weights.armWeight > sample.weights.chestWeight);
  assert.ok(sample.weights.chestWeight > sample.weights.spineWeight);
  assert.ok(sample.weights.spineWeight > sample.weights.hipsWeight);
  assert.ok(sample.weights.hipsWeight > sample.weights.legWeight);
  assert.ok(sample.weights.legWeight > 0);
  assert.deepEqual(sample.forceChain, ['weapon', 'right-arm', 'chest', 'spine', 'hips', 'legs']);
  assert.ok(Math.abs(sample.pose.chestYawDegrees) > Math.abs(sample.pose.hipsYawDegrees));
});

test('G4.3B.5R.2.4.2 Perfect Parry gets a stronger full-body recoil scale than normal Parry', () => {
  const parry = separationSample('parry-directional-recoil', 1);
  const perfect = separationSample('perfect-parry-directional-recoil', 1);

  assert.ok(parry.profile.fullBodyRecoilScale > 1);
  assert.ok(perfect.profile.fullBodyRecoilScale > parry.profile.fullBodyRecoilScale);
  assert.ok(Math.abs(perfect.pose.chestYawDegrees) > Math.abs(parry.pose.chestYawDegrees));
  assert.ok(perfect.pose.leftKneeBendDegrees > parry.pose.leftKneeBendDegrees);
});

test('G4.3B.5R.2.4.2 coupling source restores captured body pose before every accent sample and keeps arms on shield IK', () => {
  const source = fs.readFileSync(new URL('../src/combat/shield-driven-contact-coupling.js', import.meta.url), 'utf8');
  assert.match(source, /captureImpactAccentBasePose\(attackerRig\)/);
  assert.match(source, /captureImpactAccentBasePose\(defenderRig\)/);
  assert.match(source, /applyImpactAccentBodyPose\(THREE, attackerRig/);
  assert.match(source, /applyImpactAccentBodyPose\(THREE, defenderRig/);
  assert.match(source, /aimEffectorWithBone\(THREE, attackerRig\.bones\['lowerarm\.r'\]/);
  assert.match(source, /aimEffectorWithBone\(THREE, defenderRig\.bones\['lowerarm\.l'\]/);
});
