import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LONGSWORD_ATTACK_PHASES,
  LONGSWORD_DIRECTIONAL_ATTACK_DEFINITIONS,
  createLongswordDirectionalAttackDefinition,
  createLongswordDirectionalAttackRuntime,
  getLongswordDirectionalAttackProfile,
} from '../src/combat/longsword-directional-attack-runtime.js';

const EXPECTED = Object.freeze({
  top: Object.freeze({ clipId: 'UAL1/Sword_Attack', contactSeconds: 0.43, durationSeconds: 1.533 }),
  right: Object.freeze({ clipId: 'UAL2/Sword_Regular_A', contactSeconds: 0.23, durationSeconds: 0.433 }),
  left: Object.freeze({ clipId: 'UAL2/Sword_Regular_B', contactSeconds: 0.30, durationSeconds: 0.533 }),
});

test('G4.1 canonical directional attacks preserve selected clips and contact timing', () => {
  for (const [direction, expected] of Object.entries(EXPECTED)) {
    const profile = getLongswordDirectionalAttackProfile(direction);
    assert.equal(profile.direction, direction);
    assert.equal(profile.clipId, expected.clipId);
    assert.equal(profile.contactSeconds, expected.contactSeconds);
    assert.equal(profile.durationSeconds, expected.durationSeconds);
    assert.ok(profile.activeStartSeconds < profile.contactSeconds);
    assert.ok(profile.activeEndSeconds > profile.contactSeconds);
    assert.ok(profile.trailStartSeconds <= profile.activeStartSeconds);
    assert.ok(profile.trailEndSeconds >= profile.activeEndSeconds);
  }
});

test('G4.1 attack definition carries direction into ActionDefinition and frame windows', () => {
  for (const direction of Object.keys(EXPECTED)) {
    const action = createLongswordDirectionalAttackDefinition(direction);
    assert.equal(action.direction, direction);
    assert.equal(action.category, 'attack');
    assert.equal(action.animationBinding.clipId, EXPECTED[direction].clipId);
    assert.equal(action.animationBinding.source, direction === 'top' ? 'ual1' : 'ual2');
    assert.equal(action.animationBinding.loop, false);
    assert.equal(action.runtime.rootRotationPolicy, 'lock');
    assert.equal(action.windows.active.length, 1);
    assert.equal(action.windows.weaponTrail.length, 1);
    assert.equal(action.windows.movement.length, 1);
    assert.equal(action.windows.cancel.length, 1);
    const contactFrame = EXPECTED[direction].contactSeconds * action.fps;
    assert.ok(action.windows.active[0].startFrame <= contactFrame);
    assert.ok(action.windows.active[0].endFrame >= contactFrame);
    assert.equal(LONGSWORD_DIRECTIONAL_ATTACK_DEFINITIONS[direction].clipId, action.clipId);
  }
});

test('G4.1 runtime exposes windup, active, recovery and returns to idle', () => {
  const runtime = createLongswordDirectionalAttackRuntime();
  assert.equal(runtime.snapshot.phase, LONGSWORD_ATTACK_PHASES.IDLE);
  const started = runtime.start('right');
  assert.equal(started.accepted, true);
  assert.equal(started.snapshot.phase, LONGSWORD_ATTACK_PHASES.WINDUP);

  const profile = started.snapshot.action.runtime;
  const intoActiveMs = profile.activeStartSeconds * 1000 + 1;
  const active = runtime.update(intoActiveMs);
  assert.equal(active.phase, LONGSWORD_ATTACK_PHASES.ACTIVE);
  assert.equal(active.direction, 'right');

  const pastActiveMs = (profile.activeEndSeconds - active.elapsedSeconds) * 1000 + 1;
  const recovery = runtime.update(pastActiveMs);
  assert.equal(recovery.phase, LONGSWORD_ATTACK_PHASES.RECOVERY);

  const completed = runtime.update(profile.durationSeconds * 1000);
  assert.equal(completed.completed, true);
  assert.equal(completed.direction, 'right');
  assert.equal(runtime.snapshot.phase, LONGSWORD_ATTACK_PHASES.IDLE);
  assert.equal(runtime.snapshot.lastCompleted.direction, 'right');
});

test('G4.1 runtime rejects overlapping attacks', () => {
  const runtime = createLongswordDirectionalAttackRuntime();
  assert.equal(runtime.start('top').accepted, true);
  const rejected = runtime.start('left');
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reason, 'attack-already-active');
  assert.equal(rejected.snapshot.direction, 'top');
});
