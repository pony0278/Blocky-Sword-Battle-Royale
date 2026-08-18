import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuardPresentationRuntime } from '../src/combat/guard-presentation-runtime.js';
import {
  GUARD_EVENTS,
  GUARD_STATES,
  createGuardStateMachine,
} from '../src/combat/guard-state-machine.js';

function createCharacterStub() {
  const samples = [];
  const stops = [];
  const updates = [];
  const durations = new Map([
    ['SKYRIM_GUARD/shd_blockidle', 2],
    ['SKYRIM_GUARD/shd_blockhit', 0.8],
    ['SKYRIM_GUARD/shd_blockbash', 1 / 3],
    ['SKYRIM_GUARD/shd_blockbashpower', 0.7],
  ]);
  return {
    samples,
    stops,
    updates,
    rig: { bones: {} },
    getAnimationDuration(name) { return durations.get(name) || 0; },
    sampleAnimation(name, timeSeconds, options) {
      samples.push({ name, timeSeconds, options: { ...options } });
      return { name };
    },
    stopAnimation() { stops.push(true); },
    update(deltaSeconds, camera) { updates.push({ deltaSeconds, camera }); },
  };
}

function enterHold(machine, runtime) {
  machine.send(GUARD_EVENTS.GUARD_PRESS);
  runtime.sync();
  const result = runtime.update(180);
  assert.equal(result.snapshot.state, GUARD_STATES.HOLD);
}

function createHarness() {
  const machine = createGuardStateMachine();
  const character = createCharacterStub();
  const correctionWeights = [];
  const runtime = createGuardPresentationRuntime(null, {
    machine,
    character,
    applyCorrection: (weight) => correctionWeights.push(weight),
  });
  return { machine, character, correctionWeights, runtime };
}

test('G3.3.2 runtime completes Block Hit at 0.60s then reuses G3.2 Recover', () => {
  const { machine, character, runtime } = createHarness();
  enterHold(machine, runtime);

  machine.send(GUARD_EVENTS.BLOCK_CONFIRMED, { attackId: 'attack-block' });
  let result = runtime.update(599);
  assert.equal(result.snapshot.state, GUARD_STATES.BLOCK_HIT);
  assert.equal(result.report.clipId, 'SKYRIM_GUARD/shd_blockhit');
  assert.equal(result.report.counterWindowOpen, true);
  assert.ok(result.report.sourceTimeSeconds < 0.6);

  result = runtime.update(1);
  assert.equal(result.snapshot.state, GUARD_STATES.RECOVER);
  const completion = result.snapshot.lastTransition;
  assert.equal(completion.event, GUARD_EVENTS.REACTION_COMPLETE);
  assert.equal(completion.authority, 'presentation');
  assert.equal(completion.payload.reactionVariant, 'block-hit');
  assert.equal(completion.payload.sourceTimeSeconds, 0.6);

  const blockSamples = character.samples.filter((entry) => entry.name === 'SKYRIM_GUARD/shd_blockhit');
  assert.equal(blockSamples.at(-1).timeSeconds, 0.6);

  result = runtime.update(140);
  assert.equal(result.snapshot.state, GUARD_STATES.HOLD);
});

test('G3.3.2 runtime uses complete 0.333s Bash for normal Parry', () => {
  const { machine, character, runtime } = createHarness();
  enterHold(machine, runtime);

  machine.send(GUARD_EVENTS.PARRY_CONFIRMED, { attackId: 'attack-parry' });
  let result = runtime.update(1000 / 3 - 0.01);
  assert.equal(result.snapshot.state, GUARD_STATES.PARRY);
  assert.equal(result.report.clipId, 'SKYRIM_GUARD/shd_blockbash');
  assert.equal(result.report.reactionVariant, 'parry');

  result = runtime.update(0.01);
  assert.equal(result.snapshot.state, GUARD_STATES.RECOVER);
  const parrySamples = character.samples.filter((entry) => entry.name === 'SKYRIM_GUARD/shd_blockbash');
  assert.ok(Math.abs(parrySamples.at(-1).timeSeconds - (1 / 3)) < 1e-9);
});

test('G3.3.2 runtime selects and trims Bash Power for Perfect Parry', () => {
  const { machine, character, runtime } = createHarness();
  enterHold(machine, runtime);

  const parry = machine.send(GUARD_EVENTS.PARRY_CONFIRMED, { perfect: true, authorityTick: 120 });
  assert.equal(parry.snapshot.state, GUARD_STATES.PARRY);
  assert.equal(parry.snapshot.presentation.clipId, 'SKYRIM_GUARD/shd_blockbashpower');
  assert.equal(parry.snapshot.presentation.reactionVariant, 'perfect-parry');

  let result = runtime.update(240);
  assert.equal(result.snapshot.state, GUARD_STATES.PARRY);
  assert.equal(result.report.clipId, 'SKYRIM_GUARD/shd_blockbashpower');
  assert.equal(result.report.counterWindowOpen, true);

  result = runtime.update(240);
  assert.equal(result.snapshot.state, GUARD_STATES.RECOVER);
  assert.equal(result.snapshot.lastTransition.payload.reactionVariant, 'perfect-parry');
  const perfectSamples = character.samples.filter((entry) => entry.name === 'SKYRIM_GUARD/shd_blockbashpower');
  assert.equal(perfectSamples.at(-1).timeSeconds, 0.48);
});

test('G3.3.2 counter window is presentation-only and never self-confirms a Counter', () => {
  const { machine, runtime } = createHarness();
  enterHold(machine, runtime);
  machine.send(GUARD_EVENTS.PARRY_CONFIRMED);

  const result = runtime.update(100);
  assert.equal(result.report.counterWindowOpen, true);
  assert.equal(machine.state, GUARD_STATES.PARRY);
  assert.equal(machine.snapshot.lastOutcome, 'parry');
  assert.notEqual(machine.state, GUARD_STATES.COUNTER);

  const counter = machine.send(GUARD_EVENTS.COUNTER_CONFIRMED, { authorityTick: 999 });
  assert.equal(counter.accepted, true);
  assert.equal(counter.snapshot.state, GUARD_STATES.COUNTER);
  assert.equal(counter.snapshot.lastTransition.authority, 'authoritative-combat');
  runtime.sync();
});

test('G3.3.2 keeps Guard release latched through reaction and Recover', () => {
  const { machine, runtime } = createHarness();
  enterHold(machine, runtime);
  machine.send(GUARD_EVENTS.BLOCK_CONFIRMED);
  machine.send(GUARD_EVENTS.GUARD_RELEASE);

  let result = runtime.update(600);
  assert.equal(result.snapshot.state, GUARD_STATES.RECOVER);
  assert.equal(result.snapshot.guardHeld, false);

  result = runtime.update(140);
  assert.equal(result.snapshot.state, GUARD_STATES.EXIT);
  result = runtime.update(160);
  assert.equal(result.snapshot.state, GUARD_STATES.NEUTRAL);
});
