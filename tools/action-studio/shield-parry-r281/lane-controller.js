import { createAttackAdvanceRuntime } from '../../../src/combat/attack-advance.js';
import { createEngagementGround } from '../../../src/combat/engagement-ground.js';
import { createLaneLocomotionRuntime } from '../../../src/combat/lane-locomotion.js';

// R18Z.1 — where the two fighters are standing, and nothing else.
//
// Two rules and one mechanism, kept together because they are one question. attack-advance says how
// far a swing carries the attacker; engagement-ground keeps the ledger of what each fighter has
// gained or given up; this writes the result onto the scene. Splitting them across the entry meant
// three separate calls all having to remember to re-apply, which is exactly the kind of ordering
// the entry should not be carrying.
//
// It owns no authority over whether anything was hit. It is told an outcome and moves people.
export function createShieldParryLaneController({ labScene }) {
  const advance = createAttackAdvanceRuntime();
  const defenderFeet = createLaneLocomotionRuntime();
  const attackerFeet = createLaneLocomotionRuntime();
  const ground = createEngagementGround({
    startSeparationMeters: labScene.engagementStance.separationMeters,
  });

  // Told by the caller rather than inferred. The advance runtime keeps its plan until the next
  // exchange resets it, and re-sampling it at elapsed 0 between attacks makes it look like a swing
  // that has not started yet - so asking it whether a swing is live gave the wrong answer in both
  // directions, and locked the attacker's feet from the first swing of the session onwards.
  let swingLive = false;
  function attackerFeetLocked() {
    return swingLive && advance.report?.complete !== true;
  }

  function apply() {
    labScene.setLanePositions(ground.report);
    return ground.report;
  }

  return Object.freeze({
    startAttack(direction, contactSeconds) {
      return advance.start({ direction, contactSeconds, startSeconds: 0 });
    },
    // Called every frame of a live swing, before anything reads a world position: the guard tracks
    // the attacker and the swept probe measures the blade, so both must see where the step has
    // actually carried him.
    update(elapsedSeconds, attacking = true) {
      swingLive = Boolean(attacking);
      if (!swingLive) return ground.report;
      ground.setAttackerSwing(advance.update(elapsedSeconds)?.advanceMeters ?? 0);
      return apply();
    },
    // Feet run every frame, attack or no attack, which is the point: standing still is a choice
    // somebody is making rather than the only thing available to them.
    setDefenderIntent(intent) {
      return defenderFeet.setIntent(intent);
    },
    setAttackerIntent(intent) {
      return attackerFeet.setIntent(intent);
    },
    // Both are stepped against the live gap, so the clamp that stops them walking through each
    // other is checked against where they actually are this frame rather than where they started,
    // and the second one to move sees the ground the first just took.
    walk(deltaSeconds) {
      const defenderStep = defenderFeet.update({ deltaSeconds, separationMeters: ground.separationMeters });
      if (defenderStep.meters !== 0) ground.moveDefender(defenderStep.meters);
      // R19B.1: the attacker's feet stop while a swing is still travelling. The step into the blow
      // owns their movement for those frames, and letting both drive at once would double the
      // distance every measured coverage band was taken against.
      //
      // "Still travelling" rather than "an attack exists": the advance runtime keeps its plan until
      // the next exchange resets it, so gating on that alone locked the attacker's feet from the
      // first swing of the session onwards. The step is spent at contact, and from that frame the
      // attacker owns their own feet again.
      const attackerStep = attackerFeetLocked()
        ? null
        : attackerFeet.update({ deltaSeconds, separationMeters: ground.separationMeters });
      if (attackerStep && attackerStep.meters !== 0) ground.moveAttacker(attackerStep.meters);
      if (defenderStep.meters !== 0 || attackerStep?.meters) apply();
      return Object.freeze({ defenderStep, attackerStep });
    },
    get defenderIntent() { return defenderFeet.intent; },
    get attackerIntent() { return attackerFeet.intent; },
    get attackerFeetLocked() { return attackerFeetLocked(); },
    // A landed blow is the only thing that banks ground. The outcome decides which way it moves:
    // blocking costs the defender more than the attacker, a parry costs the attacker far more.
    settle(outcome) {
      const settled = ground.settleImpact(outcome);
      if (settled) apply();
      return settled;
    },
    // The swing is released rather than the lane reset: a step that bought no contact buys no
    // ground, but ground a previous blow moved is not handed back between attacks.
    release() {
      swingLive = false;
      advance.reset();
      // Intent survives a reset -- a held key is still held. Only the swing is given up.
      ground.releaseSwing();
      return apply();
    },
    get report() { return ground.report; },
    get separationMeters() { return ground.separationMeters; },
  });
}
