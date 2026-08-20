import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTACKER_RECOIL_PRESENTATION_PHASES,
  ATTACKER_RECOIL_PRESENTATION_PROFILES,
  ATTACKER_RECOIL_PRESENTATION_STAGE,
  sampleAttackerRecoilPresentation,
} from '../src/combat/attacker-recoil-presentation.js';

function plan(responseClass = 'parry-directional-recoil', overrides = {}) {
  return {
    stage: 'G4.3B.2',
    planned: true,
    sequence: 9,
    attackDirection: 'left',
    responseClass,
    weapon: {
      direction: { x: 0.6, y: 0.35, z: -0.72 },
      lateralSign: 1,
      strength: responseClass === 'blocked-weapon-bounce' ? 0.28 : responseClass === 'perfect-parry-directional-recoil' ? 1 : 0.68,
      deflectDegrees: responseClass === 'blocked-weapon-bounce' ? 12 : responseClass === 'perfect-parry-directional-recoil' ? 44 : 30,
    },
    body: {
      strength: responseClass === 'blocked-weapon-bounce' ? 0.12 : responseClass === 'perfect-parry-directional-recoil' ? 0.56 : 0.38,
      yawDegrees: 10,
      pitchDegrees: -7,
      rollDegrees: 2.8,
    },
    ...overrides,
  };
}

test('G4.3B.3 presentation keeps a readable frozen contact hold before recoil', () => {
  const p = plan();
  const sample = sampleAttackerRecoilPresentation(p, 12);
  assert.equal(sample.stage, ATTACKER_RECOIL_PRESENTATION_STAGE);
  assert.equal(sample.phase, ATTACKER_RECOIL_PRESENTATION_PHASES.CONTACT_HOLD);
  assert.equal(sample.weights.armWeight, 0);
  assert.equal(sample.weights.torsoWeight, 0);
  assert.equal(sample.weights.legWeight, 0);
  assert.deepEqual(sample.pose.weaponAimOffsetMeters, { x: 0, y: 0, z: 0 });
});

test('G4.3B.3 force chain makes sword arm lead torso and legs during impulse', () => {
  const p = plan();
  const profile = ATTACKER_RECOIL_PRESENTATION_PROFILES[p.responseClass];
  const elapsed = profile.contactHoldMs + (profile.impulseEndMs - profile.contactHoldMs) * 0.55;
  const sample = sampleAttackerRecoilPresentation(p, elapsed);
  assert.equal(sample.phase, ATTACKER_RECOIL_PRESENTATION_PHASES.IMPULSE);
  assert.ok(sample.weights.armWeight > sample.weights.torsoWeight);
  assert.ok(sample.weights.torsoWeight > sample.weights.legWeight);
  assert.ok(sample.pose.upperArmAimDegrees > 0);
});

test('G4.3B.3 Block stays much smaller and shorter than Parry and Perfect Parry', () => {
  const blockProfile = ATTACKER_RECOIL_PRESENTATION_PROFILES['blocked-weapon-bounce'];
  const parryProfile = ATTACKER_RECOIL_PRESENTATION_PROFILES['parry-directional-recoil'];
  const perfectProfile = ATTACKER_RECOIL_PRESENTATION_PROFILES['perfect-parry-directional-recoil'];
  assert.ok(blockProfile.settleEndMs < parryProfile.settleEndMs);
  assert.ok(parryProfile.settleEndMs < perfectProfile.settleEndMs);

  const block = sampleAttackerRecoilPresentation(plan('blocked-weapon-bounce'), blockProfile.impulseEndMs);
  const parry = sampleAttackerRecoilPresentation(plan('parry-directional-recoil'), parryProfile.impulseEndMs);
  const perfect = sampleAttackerRecoilPresentation(plan('perfect-parry-directional-recoil'), perfectProfile.impulseEndMs);
  assert.ok(block.pose.upperArmAimDegrees < parry.pose.upperArmAimDegrees);
  assert.ok(parry.pose.upperArmAimDegrees < perfect.pose.upperArmAimDegrees);
  assert.ok(block.pose.leftKneeBendDegrees < parry.pose.leftKneeBendDegrees);
  assert.ok(parry.pose.leftKneeBendDegrees < perfect.pose.leftKneeBendDegrees);
});

test('G4.3B.3 LEFT and RIGHT recoil mirror loaded leg bias', () => {
  const profile = ATTACKER_RECOIL_PRESENTATION_PROFILES['parry-directional-recoil'];
  const left = sampleAttackerRecoilPresentation(plan(), profile.impulseEndMs);
  const right = sampleAttackerRecoilPresentation(plan('parry-directional-recoil', {
    attackDirection: 'right',
    weapon: {
      ...plan().weapon,
      lateralSign: -1,
      direction: { x: -0.6, y: 0.35, z: -0.72 },
    },
    body: {
      ...plan().body,
      yawDegrees: -10,
      rollDegrees: -2.8,
    },
  }), profile.impulseEndMs);

  assert.ok(left.pose.leftKneeBendDegrees > left.pose.rightKneeBendDegrees);
  assert.ok(right.pose.rightKneeBendDegrees > right.pose.leftKneeBendDegrees);
  assert.ok(left.pose.chestYawDegrees > 0);
  assert.ok(right.pose.chestYawDegrees < 0);
});

test('G4.3B.3 TOP recoil keeps leg loading substantially symmetric', () => {
  const profile = ATTACKER_RECOIL_PRESENTATION_PROFILES['parry-directional-recoil'];
  const top = sampleAttackerRecoilPresentation(plan('parry-directional-recoil', {
    attackDirection: 'top',
    weapon: { ...plan().weapon, lateralSign: 1, direction: { x: 0.1, y: 0.9, z: -0.4 } },
  }), profile.impulseEndMs);
  assert.ok(Math.abs(top.pose.leftKneeBendDegrees - top.pose.rightKneeBendDegrees) < 1e-9);
  assert.ok(top.pose.weaponAimOffsetMeters.y > 0);
});

test('G4.3B.3 settles to zero and explicitly opens attack handoff', () => {
  const p = plan();
  const profile = ATTACKER_RECOIL_PRESENTATION_PROFILES[p.responseClass];
  const complete = sampleAttackerRecoilPresentation(p, profile.settleEndMs + 1);
  assert.equal(complete.phase, ATTACKER_RECOIL_PRESENTATION_PHASES.COMPLETE);
  assert.equal(complete.complete, true);
  assert.equal(complete.readyForAttackHandoff, true);
  assert.equal(complete.pose.upperArmAimDegrees, 0);
  assert.equal(complete.pose.chestYawDegrees, 0);
  assert.equal(complete.pose.leftKneeBendDegrees, 0);
});

test('G4.3B.3 rejects unplanned or unsupported recoil contracts', () => {
  assert.equal(sampleAttackerRecoilPresentation({ planned: false }, 50), null);
  assert.equal(sampleAttackerRecoilPresentation({ planned: true, responseClass: 'unknown' }, 50), null);
});
