import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GUARD_EVENT_AUTHORITY,
  GUARD_EVENTS,
  GUARD_STATES,
  LONGSWORD_GUARD_PRESENTATION,
  createGuardStateMachine,
  getGuardPresentation,
} from '../src/combat/guard-state-machine.js';
import { LONGSWORD_GUARD_BASE } from '../src/combat/longsword-guard-metadata.js';

test('G3.1 enters and exits the canonical Skyrim guard hold', () => {
  const machine = createGuardStateMachine();
  assert.equal(machine.state, GUARD_STATES.NEUTRAL);

  assert.equal(machine.send(GUARD_EVENTS.GUARD_PRESS).snapshot.state, GUARD_STATES.ENTER);
  assert.equal(machine.send(GUARD_EVENTS.ENTER_COMPLETE).snapshot.state, GUARD_STATES.HOLD);

  const hold = getGuardPresentation(GUARD_STATES.HOLD);
  assert.equal(hold.clipId, LONGSWORD_GUARD_BASE.clipId);
  assert.equal(hold.correctionLayerId, LONGSWORD_GUARD_BASE.correctionLayerId);
  assert.equal(hold.authored, true);
  assert.equal(hold.loop, true);
  assert.equal(hold.inPlace, true);

  assert.equal(machine.send(GUARD_EVENTS.GUARD_RELEASE).snapshot.state, GUARD_STATES.EXIT);
  assert.equal(machine.send(GUARD_EVENTS.EXIT_COMPLETE).snapshot.state, GUARD_STATES.NEUTRAL);
});

test('G3.1 block reaction latches guard release until recovery completes', () => {
  const machine = createGuardStateMachine();
  machine.send(GUARD_EVENTS.GUARD_PRESS);
  machine.send(GUARD_EVENTS.ENTER_COMPLETE);

  const blocked = machine.send(GUARD_EVENTS.BLOCK_CONFIRMED, { attackId: 'attack-42' });
  assert.equal(blocked.accepted, true);
  assert.equal(blocked.snapshot.state, GUARD_STATES.BLOCK_HIT);
  assert.equal(blocked.snapshot.lastOutcome, 'block');
  assert.equal(blocked.snapshot.lastTransition.authority, 'authoritative-combat');

  const released = machine.send(GUARD_EVENTS.GUARD_RELEASE);
  assert.equal(released.accepted, true);
  assert.equal(released.transitioned, false);
  assert.equal(released.snapshot.guardHeld, false);
  assert.equal(released.snapshot.state, GUARD_STATES.BLOCK_HIT);

  assert.equal(machine.send(GUARD_EVENTS.REACTION_COMPLETE).snapshot.state, GUARD_STATES.RECOVER);
  assert.equal(machine.send(GUARD_EVENTS.RECOVER_COMPLETE).snapshot.state, GUARD_STATES.EXIT);
  assert.equal(machine.send(GUARD_EVENTS.EXIT_COMPLETE).snapshot.state, GUARD_STATES.NEUTRAL);
});

test('G3.1 authoritative parry may chain into authoritative counter then return to hold', () => {
  const machine = createGuardStateMachine();
  machine.send(GUARD_EVENTS.GUARD_PRESS);
  machine.send(GUARD_EVENTS.ENTER_COMPLETE);

  assert.equal(machine.send(GUARD_EVENTS.PARRY_CONFIRMED).snapshot.state, GUARD_STATES.PARRY);
  assert.equal(machine.send(GUARD_EVENTS.COUNTER_CONFIRMED).snapshot.state, GUARD_STATES.COUNTER);
  assert.equal(machine.send(GUARD_EVENTS.COUNTER_COMPLETE).snapshot.state, GUARD_STATES.RECOVER);
  assert.equal(machine.send(GUARD_EVENTS.RECOVER_COMPLETE).snapshot.state, GUARD_STATES.HOLD);
  assert.equal(machine.snapshot.lastOutcome, 'counter');
});

test('G3.1 rejects combat outcomes outside valid guard reaction states', () => {
  const machine = createGuardStateMachine();
  const block = machine.send(GUARD_EVENTS.BLOCK_CONFIRMED);
  const parry = machine.send(GUARD_EVENTS.PARRY_CONFIRMED);
  const counter = machine.send(GUARD_EVENTS.COUNTER_CONFIRMED);

  assert.equal(block.accepted, false);
  assert.equal(parry.accepted, false);
  assert.equal(counter.accepted, false);
  assert.equal(machine.state, GUARD_STATES.NEUTRAL);
  assert.equal(machine.snapshot.lastOutcome, null);
});

test('G3.1 re-press during exit re-enters guard without transient neutral', () => {
  const machine = createGuardStateMachine();
  machine.send(GUARD_EVENTS.GUARD_PRESS);
  machine.send(GUARD_EVENTS.ENTER_COMPLETE);
  machine.send(GUARD_EVENTS.GUARD_RELEASE);
  assert.equal(machine.state, GUARD_STATES.EXIT);

  assert.equal(machine.send(GUARD_EVENTS.GUARD_PRESS).snapshot.state, GUARD_STATES.ENTER);
  assert.equal(machine.guardHeld, true);
});

test('G3.1 exposes presentation-only authority boundaries and future authoring slots', () => {
  assert.equal(GUARD_EVENT_AUTHORITY[GUARD_EVENTS.GUARD_PRESS], 'local-intent');
  assert.equal(GUARD_EVENT_AUTHORITY[GUARD_EVENTS.BLOCK_CONFIRMED], 'authoritative-combat');
  assert.equal(GUARD_EVENT_AUTHORITY[GUARD_EVENTS.PARRY_CONFIRMED], 'authoritative-combat');
  assert.equal(GUARD_EVENT_AUTHORITY[GUARD_EVENTS.COUNTER_CONFIRMED], 'authoritative-combat');

  assert.equal(LONGSWORD_GUARD_PRESENTATION[GUARD_STATES.ENTER].plannedStage, 'G3.2');
  assert.equal(LONGSWORD_GUARD_PRESENTATION[GUARD_STATES.BLOCK_HIT].plannedStage, 'G3.3');
  assert.equal(LONGSWORD_GUARD_PRESENTATION[GUARD_STATES.COUNTER].plannedStage, 'G3.4');
});

test('G3.1 tracks deterministic state age and transition sequence', () => {
  const machine = createGuardStateMachine();
  machine.update(16.67);
  machine.update(16.67);
  assert.ok(machine.snapshot.elapsedMs > 33);
  assert.equal(machine.snapshot.sequence, 0);

  machine.send(GUARD_EVENTS.GUARD_PRESS);
  assert.equal(machine.snapshot.elapsedMs, 0);
  assert.equal(machine.snapshot.sequence, 1);
  machine.send(GUARD_EVENTS.ENTER_COMPLETE);
  assert.equal(machine.snapshot.sequence, 2);
});
