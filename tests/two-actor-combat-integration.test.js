import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSynchronizedDefenderPayload,
  createTwoActorCombatIntegration,
  TWO_ACTOR_COMBAT_PHASES,
  TWO_ACTOR_PARRY_SYNC_PROFILE,
  TWO_ACTOR_PARRY_SYNC_STAGE,
} from '../src/combat/two-actor-combat-integration.js';
import {
  createLongswordDirectionalAttackRuntime,
  LONGSWORD_ATTACK_PHASES,
} from '../src/combat/longsword-directional-attack-runtime.js';
import {
  createGuardStateMachine,
  GUARD_EVENTS,
  GUARD_STATES,
} from '../src/combat/guard-state-machine.js';

function createFakeAttackerRecoil({ completeAfter = 2 } = {}) {
  let activePlan = null;
  let updates = 0;
  let starts = 0;
  return {
    get active() { return Boolean(activePlan); },
    get starts() { return starts; },
    get updates() { return updates; },
    get snapshot() {
      return Object.freeze({ active: Boolean(activePlan), plan: activePlan, updates, starts });
    },
    start(plan) {
      if (activePlan) return Object.freeze({ accepted: false, reason: 'already-active', snapshot: this.snapshot });
      if (!plan?.planned) return Object.freeze({ accepted: false, reason: 'invalid-plan', snapshot: this.snapshot });
      activePlan = plan;
      updates = 0;
      starts += 1;
      return Object.freeze({ accepted: true, snapshot: this.snapshot });
    },
    update() {
      if (!activePlan) return Object.freeze({ justCompleted: false, snapshot: this.snapshot });
      updates += 1;
      if (updates < completeAfter) {
        return Object.freeze({ justCompleted: false, sample: { phase: 'recoil' }, snapshot: this.snapshot });
      }
      const completedPlan = activePlan;
      activePlan = null;
      return Object.freeze({
        justCompleted: true,
        completed: Object.freeze({
          sequence: completedPlan.sequence,
          readyForAttackHandoff: true,
        }),
        snapshot: this.snapshot,
      });
    },
    reset() {
      activePlan = null;
      updates = 0;
      return this.snapshot;
    },
  };
}

function authoritativeContact(velocity = { x: 4.5, y: -0.4, z: 2.2 }) {
  return Object.freeze({
    contact: true,
    geometricContact: true,
    eligible: true,
    point: Object.freeze({ x: 0.11, y: 1.14, z: 0.22 }),
    incomingVelocity: Object.freeze({ ...velocity }),
    radialDistance: 0.08,
    bladeFraction: 0.62,
    sweepAlpha: 0.44,
  });
}

function createHarness({ enterOnly = false, completeAfter = 2 } = {}) {
  const attackRuntime = createLongswordDirectionalAttackRuntime();
  const guardMachine = createGuardStateMachine();
  guardMachine.send(GUARD_EVENTS.GUARD_PRESS);
  if (!enterOnly) guardMachine.send(GUARD_EVENTS.ENTER_COMPLETE);
  const attackerRecoil = createFakeAttackerRecoil({ completeAfter });
  const sampled = [];
  const integration = createTwoActorCombatIntegration({
    attackRuntime,
    guardMachine,
    attackerRecoil,
    sampleFrozenContactPose(interruption, exchange) {
      sampled.push(Object.freeze({
        sequence: interruption.sequence,
        clipId: interruption.clipId,
        sourceTimeSeconds: interruption.sourceTimeSeconds,
        outcome: exchange?.outcome || null,
      }));
    },
  });
  return { integration, attackRuntime, guardMachine, attackerRecoil, sampled };
}

function startIntoActive(harness, direction = 'right') {
  const started = harness.integration.startAttack(direction);
  assert.equal(started.accepted, true);
  const profile = harness.attackRuntime.snapshot.action.runtime;
  harness.attackRuntime.update(profile.activeStartSeconds * 1000 + 1);
  assert.equal(harness.attackRuntime.snapshot.phase, LONGSWORD_ATTACK_PHASES.ACTIVE);
  return harness.attackRuntime.snapshot;
}

test('G4.3B.4 resolves a Parry into defender reaction, frozen attacker and recoil plan', () => {
  const harness = createHarness();
  const active = startIntoActive(harness, 'right');
  const result = harness.integration.resolveContact({
    contact: authoritativeContact(),
    guardIntentAgeMs: 120,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.resolution.outcome, 'parry');
  assert.equal(result.resolution.attackSequence, active.sequence);
  assert.equal(result.recoilPlan.responseClass, 'parry-directional-recoil');
  assert.equal(harness.attackRuntime.interrupted, true);
  assert.equal(harness.attackRuntime.snapshot.phase, LONGSWORD_ATTACK_PHASES.INTERRUPTED);
  assert.equal(harness.guardMachine.state, GUARD_STATES.PARRY);
  assert.equal(harness.guardMachine.snapshot.lastTransition.authority, 'authoritative-combat');
  assert.equal(harness.attackerRecoil.starts, 1);
  assert.equal(harness.integration.snapshot.phase, TWO_ACTOR_COMBAT_PHASES.RECOIL);
});

test('G4.3B.5 pre-rolls defender Parry presentation without moving gameplay timing', () => {
  const harness = createHarness();
  startIntoActive(harness, 'right');
  const result = harness.integration.resolveContact({
    contact: authoritativeContact(),
    guardIntentAgeMs: 120,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.resolution.outcome, 'parry');
  assert.equal(result.defenderPayload.presentationSyncStage, TWO_ACTOR_PARRY_SYNC_STAGE);
  assert.equal(
    result.defenderPayload.presentationOffsetSeconds,
    TWO_ACTOR_PARRY_SYNC_PROFILE.presentationOffsetSeconds,
  );
  assert.equal(
    harness.guardMachine.snapshot.lastTransition.payload.presentationOffsetSeconds,
    TWO_ACTOR_PARRY_SYNC_PROFILE.presentationOffsetSeconds,
  );
  assert.equal(result.snapshot.activeExchange.defenderPresentationOffsetSeconds, 0.205);
});

test('G4.3B.5 does not pre-roll ordinary Block presentation', () => {
  const payload = buildSynchronizedDefenderPayload({
    outcome: 'block',
    defender: { payload: { outcome: 'block', grade: 'block' } },
  });
  assert.equal(payload.presentationOffsetSeconds, undefined);
  assert.equal(payload.presentationSyncStage, undefined);
});

test('G4.3B.4 bridges guard_enter so an early Perfect Parry reaches the defender Parry state', () => {
  const harness = createHarness({ enterOnly: true });
  startIntoActive(harness, 'left');
  assert.equal(harness.guardMachine.state, GUARD_STATES.ENTER);

  const result = harness.integration.resolveContact({
    contact: authoritativeContact({ x: -5.2, y: 0.1, z: 1.4 }),
    guardIntentAgeMs: 50,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.resolution.outcome, 'perfect-parry');
  assert.equal(result.snapshot.activeExchange.enterBridgeApplied, true);
  assert.equal(result.enterBridge.accepted, true);
  assert.equal(harness.guardMachine.state, GUARD_STATES.PARRY);
  assert.equal(harness.guardMachine.snapshot.lastTransition.payload.perfect, true);
  assert.equal(harness.guardMachine.snapshot.presentation.reactionVariant, 'perfect-parry');
  assert.equal(
    harness.guardMachine.snapshot.lastTransition.payload.presentationOffsetSeconds,
    TWO_ACTOR_PARRY_SYNC_PROFILE.presentationOffsetSeconds,
  );
});

test('G4.3B.4 ordinary Block uses the same exchange path but selects block-hit and short bounce', () => {
  const harness = createHarness();
  startIntoActive(harness, 'top');

  const result = harness.integration.resolveContact({
    contact: authoritativeContact({ x: 0.2, y: -6.4, z: 0.6 }),
    guardIntentAgeMs: 260,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.resolution.outcome, 'block');
  assert.equal(result.recoilPlan.responseClass, 'blocked-weapon-bounce');
  assert.equal(result.resolution.advantage.granted, false);
  assert.equal(harness.guardMachine.state, GUARD_STATES.BLOCK_HIT);
  assert.equal(harness.attackRuntime.interrupted, true);
});

test('G4.3B.4 suppresses duplicate contact frames for the same attack sequence', () => {
  const harness = createHarness();
  startIntoActive(harness, 'right');
  const first = harness.integration.resolveContact({
    contact: authoritativeContact(),
    guardIntentAgeMs: 110,
  });
  const guardSequenceAfterFirst = harness.guardMachine.snapshot.sequence;
  const second = harness.integration.resolveContact({
    contact: authoritativeContact(),
    guardIntentAgeMs: 112,
  });

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, false);
  assert.equal(second.reason, 'attack-sequence-already-resolved');
  assert.equal(second.resolution.duplicate, true);
  assert.equal(harness.attackerRecoil.starts, 1);
  assert.equal(harness.guardMachine.snapshot.sequence, guardSequenceAfterFirst);
});

test('G4.3B.4 samples the exact frozen contact pose before every additive recoil update', () => {
  const harness = createHarness({ completeAfter: 2 });
  startIntoActive(harness, 'left');
  const resolved = harness.integration.resolveContact({
    contact: authoritativeContact({ x: -4.8, y: 0.25, z: 1.9 }),
    guardIntentAgeMs: 130,
  });
  const frozenTime = harness.attackRuntime.snapshot.sourceTimeSeconds;

  const firstUpdate = harness.integration.update(1 / 60);
  assert.equal(firstUpdate.updated, true);
  assert.equal(firstUpdate.sampledFrozenPose, true);
  assert.equal(harness.sampled.length, 1);
  assert.equal(harness.sampled[0].sourceTimeSeconds, frozenTime);
  assert.equal(harness.attackRuntime.interrupted, true);

  const secondUpdate = harness.integration.update(1 / 60);
  assert.equal(secondUpdate.justCompleted, true);
  assert.equal(harness.sampled.length, 2);
  assert.equal(harness.sampled[1].sourceTimeSeconds, frozenTime);
  assert.equal(harness.attackRuntime.interrupted, false);
  assert.equal(harness.attackRuntime.snapshot.phase, LONGSWORD_ATTACK_PHASES.IDLE);
  assert.equal(harness.integration.active, false);
  assert.equal(harness.integration.snapshot.lastExchange.sequence, resolved.resolution.attackSequence);
  assert.equal(harness.integration.snapshot.lastExchange.attackerHandoffReleased, true);
});

test('G4.3B.4 ignores non-authoritative contact without mutating either actor', () => {
  const harness = createHarness();
  startIntoActive(harness, 'right');
  const guardSequence = harness.guardMachine.snapshot.sequence;

  const result = harness.integration.resolveContact({
    contact: {
      contact: false,
      geometricContact: false,
      eligible: true,
    },
    guardIntentAgeMs: 90,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'no-authoritative-contact');
  assert.equal(harness.attackRuntime.interrupted, false);
  assert.equal(harness.attackRuntime.snapshot.phase, LONGSWORD_ATTACK_PHASES.ACTIVE);
  assert.equal(harness.guardMachine.snapshot.sequence, guardSequence);
  assert.equal(harness.attackerRecoil.starts, 0);
});
