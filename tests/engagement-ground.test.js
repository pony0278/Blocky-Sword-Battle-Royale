import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ENGAGEMENT_GROUND_STAGE,
  ENGAGEMENT_GROUND_TRANSFERS,
  createEngagementGround,
  resolveGroundTransfer,
} from '../src/combat/engagement-ground.js';
import {
  BLOCK_ROOT_DISPLACEMENT_PROFILES,
  PARRY_ROOT_DISPLACEMENT_PROFILES,
} from '../src/combat/parry-root-displacement.js';
import { ATTACK_ADVANCE_PROFILES } from '../src/combat/attack-advance.js';

const START = 2.4;
const ground = () => createEngagementGround({ startSeparationMeters: START });

test('R18Z.1 takes the ground each blow moves straight from the recoil profiles', () => {
  assert.equal(ENGAGEMENT_GROUND_STAGE, 'R18Z.1');
  // Not transcribed: if the recoil is retuned, the ground it transfers moves with it, because they
  // are the same event described once.
  assert.equal(ENGAGEMENT_GROUND_TRANSFERS.block.defenderMeters, BLOCK_ROOT_DISPLACEMENT_PROFILES.defender.peakMeters);
  assert.equal(ENGAGEMENT_GROUND_TRANSFERS.block.attackerMeters, -BLOCK_ROOT_DISPLACEMENT_PROFILES.attacker.peakMeters);
  assert.equal(ENGAGEMENT_GROUND_TRANSFERS.parry.defenderMeters, PARRY_ROOT_DISPLACEMENT_PROFILES.defender.peakMeters);
  assert.equal(ENGAGEMENT_GROUND_TRANSFERS.parry.attackerMeters, -PARRY_ROOT_DISPLACEMENT_PROFILES.attacker.peakMeters);

  // The two outcomes have to disagree about who loses ground or the parry is not a reward.
  assert.ok(
    ENGAGEMENT_GROUND_TRANSFERS.block.defenderMeters > -ENGAGEMENT_GROUND_TRANSFERS.block.attackerMeters,
    'blocking should cost the defender more ground than it costs the attacker',
  );
  assert.ok(
    -ENGAGEMENT_GROUND_TRANSFERS.parry.attackerMeters > ENGAGEMENT_GROUND_TRANSFERS.parry.defenderMeters,
    'parrying should cost the attacker more ground than it costs the defender',
  );
  assert.equal(resolveGroundTransfer('perfect-parry'), ENGAGEMENT_GROUND_TRANSFERS.parry);
  assert.equal(resolveGroundTransfer('nonsense'), null);
});

test('R18Z.1 a swing in progress moves the attacker without banking anything', () => {
  const lane = ground();
  assert.equal(lane.separationMeters, START);

  lane.setAttackerSwing(0.3);
  assert.ok(Math.abs(lane.separationMeters - (START - 0.3)) < 1e-9, 'closing the gap is the point of a step');
  // Absolute, so the same frame twice is the same position.
  lane.setAttackerSwing(0.3);
  assert.ok(Math.abs(lane.separationMeters - (START - 0.3)) < 1e-9);
  assert.equal(lane.report.attackerGroundMeters, 0, 'nothing is banked until the blow lands');
  assert.equal(lane.report.attackerSwingMeters, 0.3);
});

test('R18Z.1 a landed blow banks the step and moves both fighters for good', () => {
  const lane = ground();
  const step = ATTACK_ADVANCE_PROFILES.left.metersByContact;
  lane.setAttackerSwing(step);
  const settled = lane.settleImpact('block');

  const { attackerMeters, defenderMeters } = ENGAGEMENT_GROUND_TRANSFERS.block;
  assert.ok(Math.abs(settled.attackerGroundMeters - (step + attackerMeters)) < 1e-9);
  assert.ok(Math.abs(settled.defenderMeters - defenderMeters) < 1e-9);
  assert.equal(settled.attackerSwingMeters, 0, 'the step is spent once it is banked');
  assert.equal(settled.transfer, ENGAGEMENT_GROUND_TRANSFERS.block);

  // And it survives the reset that ends the exchange, which is the whole point: ground changes
  // hands. Before this the fighters returned to their starting marks after every blow.
  lane.releaseSwing();
  assert.ok(Math.abs(lane.separationMeters - settled.separationMeters) < 1e-9);
});

test('R18Z.1 a whiffed swing keeps no ground', () => {
  const lane = ground();
  lane.setAttackerSwing(ATTACK_ADVANCE_PROFILES.top.metersByContact);
  assert.ok(lane.separationMeters < START);
  lane.releaseSwing();
  assert.equal(lane.separationMeters, START, 'an attack that hit nothing has bought nothing');
  assert.equal(lane.settleImpact('nonsense'), null);
});

test('R18Z.1 the ledger is what the ground actually adds up to over an exchange', () => {
  // The measured arithmetic, stated once so it cannot drift: a blocked exchange closes the gap by
  // the attacker's step minus what the impact gives back. The step dwarfs the push, so pressure
  // accumulates and the defender has to spend their own movement to hold station. That is the
  // design, not an oversight -- attacking buys ground.
  const lane = ground();
  const step = ATTACK_ADVANCE_PROFILES.top.metersByContact;
  const givenBack = ENGAGEMENT_GROUND_TRANSFERS.block.defenderMeters
    - ENGAGEMENT_GROUND_TRANSFERS.block.attackerMeters;
  lane.setAttackerSwing(step);
  const after = lane.settleImpact('block');
  assert.ok(Math.abs(after.separationMeters - (START - step + givenBack)) < 1e-9);
  assert.ok(after.separationMeters < START, 'a blocked attack still gains the attacker ground');
  assert.ok(givenBack < step, 'and the impact alone cannot pay that back');
});

test('R18Z.1 a parry hands ground back to the defender', () => {
  const lane = ground();
  const step = ATTACK_ADVANCE_PROFILES.right.metersByContact;
  lane.setAttackerSwing(step);
  const blocked = createEngagementGround({ startSeparationMeters: START });
  blocked.setAttackerSwing(step);
  blocked.settleImpact('block');
  const parried = lane.settleImpact('parry');
  assert.ok(
    parried.separationMeters > blocked.separationMeters,
    'the same attack parried must leave the attacker further away than blocked',
  );
});

test('R18Z.1 reset returns the lane to its stance and carries no contact authority', () => {
  const lane = ground();
  lane.setAttackerSwing(0.4);
  lane.settleImpact('block');
  assert.notEqual(lane.separationMeters, START);
  lane.reset();
  assert.equal(lane.separationMeters, START);
  assert.equal(lane.attackerMeters, 0);
  assert.equal(lane.defenderMeters, 0);
  assert.match(lane.report.authority, /no-contact-authority/);
});
